---
name: weekly-dev-report
description: Generate a weekly developer activity report from the active Jira sprint and linked GitHub repos, with per-dev achievability ratings, stuck-ticket flags, stalled-dev flags, and worklog audit. Use when the user wants a weekly dev report, sprint progress audit, developer status report, time-logged audit, or team check-in. Pulls roster from the active sprint, auto-discovers repos from Jira ticket dev-info, emails the report on --send, otherwise writes WEEKLY_REPORT.md and prints to stdout.
allowed-tools: Bash(jira:*), Bash(gh:*), Bash(git:*), Bash(curl:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(echo:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(printenv:*), Bash(printf:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(xargs:*), Read, Write, mcp__atlassian__searchJiraIssuesUsingJql, mcp__atlassian__getJiraIssue, mcp__github__list_pull_requests, mcp__github__list_commits, mcp__github__get_pull_request_reviews, mcp__github__search_issues, mcp__github__get_pull_request
---

# Weekly Developer Report

Generate a weekly activity report for every developer with tickets in the active Jira sprint. The report includes per-dev sprint achievability (🟢🟡🔴), ticket and PR activity, time-logged audit, and flags for stuck tickets and stalled developers. Writes `WEEKLY_REPORT.md` to the current directory, prints to stdout, and on `--send` delivers via Gmail.

## Arguments

Parse arguments from the user's invocation:

- `--dry-run` (default) — write `WEEKLY_REPORT.md` and print to stdout. Do not send email.
- `--send` — after generating, email the report. Primary recipient comes from env var `WEEKLY_DEV_REPORT_TO` (required when `--send` is used); additional recipients from env var `WEEKLY_DEV_REPORT_CC` (comma-separated, may be empty/unset). If `WEEKLY_DEV_REPORT_TO` is unset, abort with a message asking the user to set it.
- `--week-offset N` — run the report for N weeks ago (0 = this week, 1 = last week, default 0).
- `--sprint <ID|name>` — override sprint detection (rare; usually the active sprint is correct).

If the user did not pass `--send`, treat the run as a preview. Never send email unless `--send` is present.

## MCP Tools with Fallbacks

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Search sprint issues | `mcp__atlassian__searchJiraIssuesUsingJql` with `sprint in openSprints()` | `jira sprint list --state active --raw` then `jira sprint list <ID> --raw` |
| Get issue with changelog | `mcp__atlassian__getJiraIssue` (request fields + changelog) | `curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>?expand=changelog"` |
| Get worklogs for issue | n/a via MCP | `curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>/worklog"` |
| Get dev-info (linked PRs) | n/a via MCP | `curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/dev-status/latest/issue/detail?issueId=<ID>&applicationType=GitHub&dataType=pullrequest"` |
| List PRs in a repo | `mcp__github__list_pull_requests` | `gh pr list --repo <owner>/<repo> --state all --search '...' --json ...` |
| List commits | `mcp__github__list_commits` | `gh api repos/<owner>/<repo>/commits?author=<user>&since=...&until=...` |
| Reviews given by user | `mcp__github__search_issues` (q: `is:pr reviewed-by:<user> updated:...`) | `gh search prs --reviewed-by <user> --updated <from>..<to> --json ...` |

**Always prefer MCP first.** On tool-not-found or repeated error, fall back to CLI. If `$JIRA_URL`, `$JIRA_EMAIL`, `$JIRA_API_TOKEN` are needed for curl and missing, try the `jira` CLI instead. If that also fails, ask the user to check credentials.

## Step 1: Resolve sprint and week window

1. Find the active sprint (or honor `--sprint`):

   ```bash
   jira sprint list --state active --table --plain --no-headers --columns ID,NAME,START,END
   ```

   If multiple active sprints exist, ask which one.

2. Extract `startDate` and `endDate` from the sprint (they are ISO timestamps). Source them from the raw sprint JSON:

   ```bash
   jira sprint list <SPRINT_ID> --raw | jq -r '.[0] // empty' >/dev/null  # confirm ID resolves
   # Sprint metadata:
   curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/agile/1.0/sprint/<SPRINT_ID>" | jq '{name, startDate, endDate, state}'
   ```

3. Compute the week window (**previous completed week**, never the current running week):
   - `week_end = most recent past Sunday 23:59 local` (if today is Sunday, use today − 7 days)
   - `week_start = week_end − 6 days at 00:00 local` (the Monday of that same week)
   - Apply `--week-offset N` by subtracting `7*N` days from both (0 = previous completed week, 1 = the week before that)
   - **Clamp** to sprint bounds: `week_start = max(week_start, sprint.startDate)`, `week_end = min(week_end, sprint.endDate)`. Report dates in local time.
   - Rationale: a report covering the still-running week is meaningless because devs are mid-task. Always anchor on a completed Mon → Sun.

4. Compute the **sprint-to-date** window separately: `[sprint.startDate, today 23:59 local]`. This is used for sprint-achievability calculations and the "sprint-to-date" throughput table. Keep it distinct from the weekly window.

5. Extract the Jira server URL for browse links — prefer the env var, fall back to the jira-cli config (path varies by platform):

   ```bash
   JIRA_SERVER="${JIRA_URL:-$(grep -h '^server:' \
     ~/.config/.jira/.config.yml \
     ~/.jira/.config.yml \
     "${XDG_CONFIG_HOME:-$HOME/.config}/.jira/.config.yml" \
     2>/dev/null | head -n1 | awk '{print $2}')}"
   ```

   If `$JIRA_SERVER` is empty, ask the user for the Jira base URL.

## Step 2: Build the roster

Fetch every issue in the active sprint (all types except Epics and Sub-tasks). Note that `jira sprint list` caps at 100 results per page, so paginate using key cursor until fewer than 100 are returned:

```bash
# first page
jira sprint list <SPRINT_ID> --plain --no-headers --no-truncate --columns TYPE,KEY,STATUS,ASSIGNEE > /tmp/sprint.tsv
# subsequent pages, using last key as cursor
last=$(tail -1 /tmp/sprint.tsv | awk -F'\t' '{print $2}')
while :; do
  jira issue list -q "sprint = <SPRINT_ID> AND key < '$last'" --plain --no-headers --no-truncate --columns TYPE,KEY,STATUS,ASSIGNEE > /tmp/page.tsv
  cnt=$(wc -l < /tmp/page.tsv); [ "$cnt" -eq 0 ] && break
  cat /tmp/page.tsv >> /tmp/sprint.tsv
  [ "$cnt" -lt 100 ] && break
  last=$(tail -1 /tmp/page.tsv | awk -F'\t' '{print $2}')
done
```

Extract per issue:

- `key`, `id`, `fields.summary`, `fields.status.name`, `fields.issuetype.name`
- `fields.assignee.accountId`, `fields.assignee.displayName`, `fields.assignee.emailAddress`
- `fields.timeoriginalestimate`, `fields.timeestimate`, `fields.customfield_*` for story points (try `fields.customfield_10016` and `fields.customfield_10002` — pick whichever is numeric)
- `fields.customfield_*` for Sprint (array of sprint objects including historical sprints)

Build the **roster** = unique assignees across all active-sprint issues. Skip unassigned issues for per-dev sections (but include their totals in the team rollup).

### Detect the QA role

Critical for attribution: when a dev moves a ticket to `in QA`, the ticket auto-reassigns to the QA tester. This means current `fields.assignee` reflects who holds the ticket now, not who did the dev work. To correct:

1. Count how many current-sprint issues are currently in status `in QA` per assignee.
2. The assignee with a clear majority (≥ 60% of all `in QA` tickets) is the **QA tester**. Store as `qa_user`. If no one holds a clear majority, `qa_user = null` (team has no single tester and the QA-aware rules below are skipped).
3. **Do not classify runner-up "in QA" holders as testers** — those are escalation destinations (e.g. a CTO or tech lead who gets items the primary tester couldn't resolve). They are devs/leaders, not QA.
4. The QA user's row in the team-at-a-glance table should be labelled with a `(QA)` suffix, and their "throughput" is counted as QA validations (transitions they made to `Done`), not dev completions.

Also fetch the **previous sprint** (same board, state=closed, most recent end date) for stalled-dev comparison:

```bash
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/agile/1.0/board/<BOARD_ID>/sprint?state=closed" | jq '.values | sort_by(.endDate) | last'
```

If the board ID isn't obvious, get it from the active sprint's `originBoardId`.

## Step 3: Count transitions and fetch worklogs

### Transition counts per dev (authoritative throughput metric)

Do **not** use current `fields.assignee` for throughput. Instead, count status transitions each user made within a given window. JQL `BY <user> DURING (...)` is cheap and avoids having to pull full changelogs:

```bash
# per dev, per target status, per window
jira issue list -q 'sprint = <SPRINT_ID> AND status CHANGED TO "<status>" BY "<email>" DURING ("<from>", "<to>")' \
  --plain --no-headers --no-truncate --columns KEY | grep -c "^${KEY_PREFIX}-"
```

Important: when the user is invalid or has no results, the CLI prints a `✗ No result found` line. Always filter by `grep -c "^${KEY_PREFIX}-"` (not `wc -l`) to avoid counting that line as 1. `KEY_PREFIX` is read from the sprint's first issue key (Step 4) and is **not** hardcoded.

For each dev in the roster (skipping `qa_user`), count transitions to **each** of these target states, for **each** of these windows:

| Target status | Meaning |
| --- | --- |
| `Code Review` | dev opened a review (first hand-off) |
| `in QA` | dev finished and handed to QA |
| `Done` | dev closed directly (non-QA items) |
| `REJECTED` | triage dispatch (e.g. auto-filed PROD bugs dismissed as noise) |

Windows:

- **Weekly** = `[week_start, week_end]` (previous completed Mon → Sun)
- **Sprint-to-date** = `[sprint.startDate, today]`

For `qa_user`: count transitions to `Done` (QA validations) and to `in QA` (kick-backs / regressions logged) across the same two windows.

### Full changelog (only where needed)

Only pull full changelogs for issues flagged for stuck-ticket analysis (Step 6). Do NOT expand changelogs for every sprint issue — that's hundreds of API calls and `BY ... DURING (...)` JQL already covers the throughput question.

```bash
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>?expand=changelog"
```

### Worklogs

Fetch per issue (paginate: the issue-view worklog field caps at 20, but the worklog endpoint returns all):

```bash
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>/worklog?startAt=0&maxResults=1000" | jq '.worklogs'
```

Sum `timeSpentSeconds` per `author.accountId` where `started` is within `[week_start, week_end]`. Convert to hours (÷ 3600).

**Worklog coverage gate**: after aggregating, count how many devs in the roster logged > 0 hours. If fewer than 50% did, mark the hours column `low confidence` in the rendered table header and disable the `hours_ratio` arm of the rating formula for this run. Do not silently degrade — explicitly note it.

## Step 4: Discover linked GitHub repos

For each sprint issue, query the Jira dev-info API to find linked PRs:

```bash
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/dev-status/latest/issue/detail?issueId=<ID>&applicationType=GitHub&dataType=pullrequest" \
  | jq '.detail[0].pullRequests[]? | {url, status, author: .author.name, updated: .lastUpdate}'
```

Also check branches and commits:

```bash
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/dev-status/latest/issue/detail?issueId=<ID>&applicationType=GitHub&dataType=branch"
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/dev-status/latest/issue/detail?issueId=<ID>&applicationType=GitHub&dataType=repository"
```

From the PR URLs (e.g. `https://github.com/cloud-officer/foo/pull/123`), extract `owner/repo`. Build `REPOS` = the unique set across all sprint issues.

**If `REPOS` is empty** (dev-info not configured), fall back to: scan PR titles/branches for Jira keys via GitHub search:

```bash
gh search prs --owner cloud-officer "DEV-" --json repository,title,url --limit 200
```

Adjust `cloud-officer` and the ticket key prefix as appropriate (read prefix from the sprint's first issue key).

## Step 5: Gather GitHub metrics per dev

### Auto-map GitHub users → Jira users via PR-to-transition links

The team's PR template requires Jira keys in PR titles/bodies. Cross-referencing a PR's referenced ticket with **who moved that ticket forward in Jira** (not its current assignee) gives a reliable auto-mapping. Current assignee is unreliable because of QA reassignment: most merged-PR tickets end up assigned to `qa_user`, so assignee-based mapping mis-labels every dev as the QA tester.

Procedure:

1. For every repo in `REPOS`, list PRs merged in the sprint-to-date window and extract any `<PROJECT>-<NUM>` keys from the PR title, body, or head branch name:

   ```bash
   gh search prs --owner <org> "<KEY_PREFIX>-" --merged --merged-at "<sprint.startDate>..<today>" \
     --json number,title,author,repository,url --limit 400
   ```

2. Build the set of `(github_login, ticket_key)` pairs from step 1.

3. For each Jira user in the roster (skipping `qa_user`), list the tickets they transitioned **out of** `In Progress` or `Code Review` within the sprint-to-date window:

   ```bash
   jira issue list -q 'sprint = <SPRINT_ID> AND status CHANGED FROM "In Progress" BY "<email>" DURING ("<from>", "<to>")' --plain --no-headers --columns KEY
   jira issue list -q 'sprint = <SPRINT_ID> AND status CHANGED FROM "Code Review"  BY "<email>" DURING ("<from>", "<to>")' --plain --no-headers --columns KEY
   ```

   The union of these is this dev's "I worked on it" ticket set. This bypasses QA-reassignment entirely because it asks who did the transition, not who currently holds the ticket.

4. For each `(github_login, jira_user)` pair, count the number of distinct tickets that appear in both sets. Build `score[github_login][jira_user] = overlap_count`.

5. For each GitHub login, pick the Jira user with the highest score as its mapping. Require score ≥ 2 (at least 2 overlapping tickets) to confirm. Below that, the login is `ambiguous` — still include in the report but flag it.

6. Optional override: if env var `GITHUB_USERNAME_MAP` is set (format `email1=ghuser1,email2=ghuser2`), it **overrides** the auto-detected mapping for those emails. Use this as a last-resort manual patch only.

7. If auto-mapping still leaves a dev unresolved (no PRs in the window), mark their GitHub columns as `—` and add a caveat. Do not block the report.

Never map via current `fields.assignee`, never guess by email local-part, never call `gh api users/<guess>`.

For each repo in `REPOS` and each resolved GitHub user, collect within `[week_start, week_end]`:

```bash
# PRs opened, merged, closed
gh pr list --repo <owner>/<repo> --state all --search "author:<user> created:<from>..<to>" --json number,title,state,createdAt,mergedAt,closedAt,url

# Commits authored
gh api "repos/<owner>/<repo>/commits?author=<user>&since=<from>T00:00:00Z&until=<to>T23:59:59Z" --paginate | jq '[.[] | {sha, message: .commit.message, date: .commit.author.date}]'

# Reviews given (across all in-scope repos — query once per user, not per repo)
gh search prs --reviewed-by <user> --updated "<from>..<to>" --json repository,number,title,url | jq --arg repos "<comma-joined-repos>" '[.[] | select((.repository.nameWithOwner) as $r | ($repos | split(",") | index($r) != null))]'

# Stale PRs (owned by user, awaiting review, older than 3 days)
gh pr list --repo <owner>/<repo> --author <user> --state open --json number,title,createdAt,updatedAt,reviewDecision,isDraft,url \
  | jq --arg cutoff "$(date -v-3d -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '3 days ago' +%Y-%m-%dT%H:%M:%SZ)" \
       '[.[] | select(.isDraft|not) | select(.reviewDecision != "APPROVED") | select(.updatedAt < $cutoff)]'
```

Compute per dev:

- `prs_opened`, `prs_merged`, `prs_closed_unmerged`
- `commits_count`
- `reviews_given` — unique PRs they reviewed (authored by others)
- `median_cycle_time_hours` — median of `mergedAt - createdAt` for PRs merged in window
- `stale_prs` — list (rendered in a team-wide section, grouped by author)

## Step 6: Compute flags

### Stuck ticket flag 🚩

Find candidate stuck tickets via JQL, paginating past the 100-result API cap using key cursor:

```bash
last="<ISSUE_PREFIX>-99999999"
while :; do
  jira issue list -q "sprint = <SPRINT_ID> AND sprint in closedSprints() AND updated < -14d AND key < '$last'" \
    --plain --no-headers --no-truncate --columns KEY,ASSIGNEE,SUMMARY,UPDATED > /tmp/stuck_page.tsv
  cnt=$(wc -l < /tmp/stuck_page.tsv); [ "$cnt" -eq 0 ] && break
  cat /tmp/stuck_page.tsv >> /tmp/stuck.tsv
  [ "$cnt" -lt 100 ] && break
  last=$(tail -1 /tmp/stuck_page.tsv | awk -F'\t' '{print $1}')
done
```

**Never** report a truncated stuck-ticket list. If pagination was needed, the report must show every stuck ticket, not just the first 100.

For each candidate, confirm the stricter rule — all of:

- Appeared in ≥ 3 distinct sprints (current + ≥ 2 prior) — derived from changelog Sprint field history
- No status transition in the last 7 days (from now, not the week window)
- No worklog entry AND no comment in the last 7 days

Fetch comments if needed:

```bash
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>/comment" | jq '[.comments[] | {created, author: .author.displayName}] | sort_by(.created) | last'
```

### Stalled developer flag

For each dev (excluding `qa_user`), flag if **all** of:

- Assigned ≤ 2 issues in the active sprint
- ≥ 50% of their active-sprint issue keys were also in the previous sprint
- Zero status transitions **authored by them** (via JQL `BY <user>`) on any sprint issue during both the week window and the full sprint-to-date window

The last condition checks **author of the transition**, not current assignee — a dev who moved their last ticket to `in QA` and then got reassigned to Pavlo should NOT be flagged as stalled.

### Sprint achievability per dev (🟢🟡🔴)

Computed from transition data, not from current `fields.assignee`.

Inputs:

- `remaining_sp` = sum of story-point estimates for sprint issues **not yet transitioned to `in QA` or `Done` by anyone**. Story points come from `customfield_10016` or `customfield_10002`; fall back to hour estimates ÷ 8; fall back to issue count × 1. Assignment is resolved via: (a) current assignee if not the QA user, else (b) the user who most recently transitioned the ticket into an active status (`In Progress` / `Code Review`).
- `days_left` = working days between `today` and `sprint.endDate` (weekdays only)
- `velocity_sp_per_day` = `(SP transitioned to "in QA" by this dev in the previous sprint) ÷ (working days in that sprint)`. If no prior data, use `team_avg_velocity × 0.8`.
- `wip` = count of tickets currently in `In Progress` that this dev **last moved** (JQL `status was "In Progress" CHANGED BY <user>` then current status filter). Do not use raw assignee — a ticket reassigned to QA must not count toward a dev's WIP.
- `expected_hours` = 40 × (working days elapsed in sprint ÷ total working days in sprint)
- `logged_hours` = sum of their worklogs since `sprint.startDate`
- `hours_ratio` = `logged_hours ÷ expected_hours` — **disabled** when the worklog-coverage gate (Step 3) triggered.

Rating rules (apply in order, first match wins):

- 🔴 **Red** if any: `remaining_sp > velocity_sp_per_day × days_left`, OR (hours_ratio enabled AND `< 0.80`), OR a stuck ticket is assigned to them, OR `wip ≥ 4`
- 🟡 **Yellow** if any: `remaining_sp > velocity_sp_per_day × days_left × 0.8`, OR (hours_ratio enabled AND `< 0.90`), OR `wip ≥ 3`
- 🟢 **Green** otherwise

One-line "why" per rating: state the single highest-severity driver (e.g. `"Red — 13 SP left, 3 days, velocity 2 SP/day"` or `"Yellow — WIP of 3 tickets"`).

`qa_user` is not rated on this scale — their row shows QA-specific metrics (validations done, regressions logged).

## Step 7: Render the report

Write to `WEEKLY_REPORT.md` in the current working directory, and print the same content. Every visual line break between sections, paragraphs, stats, and table captions must be a `<br>` (end-of-line or own-line) so markdown renderers don't collapse consecutive lines. Format:

```markdown
# Weekly Developer Report

**Sprint:** <sprint name> <br>
**Weekly window:** <week_start> → <week_end> (previous completed Mon → Sun) <br>
**Sprint-to-date window:** <sprint.startDate> → <today> <br>
**Sprint ends:** <sprint.endDate> <br>
**Team rating:** <🟢|🟡|🔴> <br>
**QA:** <qa_user displayName, or "not detected"> <br>
**Hours column:** <high confidence | low confidence — N of M devs logged worklogs>

<Two-sentence overall summary: sprint % complete, notable flags, roster-level hours coverage if low.>

## Team at a glance (weekly throughput)

Throughput is measured by status transitions authored by each user during the weekly window. Current `fields.assignee` is NOT used here (tickets auto-reassign when moved to in QA).

| Developer | Rating | → Code Review | → in QA | → Done | → REJECTED | Hours logged | PRs merged | Reviews | Why |
| --- | --- | ---:| ---:| ---:| ---:| ---:| ---:| ---:| --- |
| Alice | 🟢 | 4 | 3 | 0 | 0 | 38.5 | 3 | 5 | On track |
| Bob | 🔴 | 0 | 0 | 0 | 0 | 12.0 | 0 | 1 | Red — 18 SP left, 4 days, velocity 2 SP/day |
| Pavlo (QA) | — | — | 2 | 20 | — | 19.5 | — | — | QA validations |

Rows sorted: 🔴 first, 🟡 next, 🟢 last, `qa_user` last. Break ties by `→ in QA` descending.

## Sprint-to-date throughput

Same columns as above but covering `[sprint.startDate, today]`. This is the view that correctly credits devs for work that has since been reassigned to QA.

## Who holds what now (current-assignee snapshot)

A separate, lower-priority table showing current `fields.assignee` counts by status. Useful for "what is in my queue" but explicitly labelled as a holdings snapshot, not throughput. Keep this below the throughput tables so readers don't confuse the two.

## 🚩 Stuck tickets (carryover with no activity)

| Ticket | Assignee | Sprints bounced | Last status change | Last worklog |
| --- | --- | --- | --- | --- |
| [DEV-1234](<SERVER>/browse/DEV-1234) | Bob | 4 | 2026-03-15 | 2026-03-18 |

Omit section entirely if no stuck tickets.

## 🐢 Review bottlenecks

| PR | Author | Repo | Age | Status |
| --- | --- | --- | --- | --- |
| [#123](url) | Alice | cloud-officer/foo | 5 days | CHANGES_REQUESTED |

Top 10 oldest open non-draft PRs across in-scope repos, awaiting review or with changes requested. Omit if empty.

## Per-developer detail

### Alice — 🟢

_On track. 4 of 6 tickets moved to Done this week._

**Tickets in sprint**
- [DEV-1201](url) — Add X endpoint — **Done** (moved Wed)
- [DEV-1205](url) — Fix Y bug — **In Review**
- ...

**Pull requests (cloud-officer/foo)**
- [#142](url) — Merged Tue — "Add X endpoint" — DEV-1201
- [#145](url) — Open, awaiting review — DEV-1205

**Worklog:** 38.5h / 40h expected pro-rata

---

### Bob — 🔴  ⚠️ Stalled

_Only 2 sprint tickets, both carried over from previous sprint with no status change this week. 12h logged against 40h expected._

(same sub-sections as above)

---

<Repeat per dev, 🔴 → 🟡 → 🟢>
```

Rendering rules:

- Every Jira key is a link: `[DEV-1234](<SERVER>/browse/DEV-1234)`
- Every PR is a link to its GitHub URL
- Times and dates in local timezone, formatted `YYYY-MM-DD` (no time unless needed for staleness)
- Never include internal JSON, shell output, or debug info in the rendered report
- Escape pipes (`|`) in table cells

## Step 8: Deliver

If run without `--send`:

1. Write `WEEKLY_REPORT.md` to the current directory
2. Print the file contents to stdout
3. End with a single line: `Preview written to WEEKLY_REPORT.md. Re-run with --send to email.`

If run with `--send`:

1. Build the recipient list: primary = `$WEEKLY_DEV_REPORT_TO` (abort if unset); append each address from `WEEKLY_DEV_REPORT_CC` (comma-separated, ignore empty entries, dedupe)
2. Subject: `Weekly Dev Report — <sprint name> — <week_start> to <week_end>`
3. Body: the rendered Markdown. If the available Gmail transport supports HTML, render the Markdown to HTML first (simple conversion: tables → `<table>`, headings → `<hN>`, links → `<a href>`); otherwise send as plain text with Markdown preserved.
4. Try delivery in this order:
   - Any available Google Workspace MCP tool whose name matches `mcp__*gmail*send*` or `mcp__google*workspace*gmail*` — discover via the tool list at runtime, do not hardcode
   - `gmail send` CLI if installed (`which gmail`)
   - `gcloud` SMTP relay if configured
5. On success, print `Sent to: <list>`. On failure, leave `WEEKLY_REPORT.md` in place, print the error, and instruct the user to send manually.

## Important rules

- **No Jira writes.** This skill only reads from Jira. Never create, edit, transition, or comment on issues.
- **No GitHub writes.** Never comment, merge, close, or otherwise modify PRs or issues.
- **No email unless `--send` is explicitly passed.** A run without that flag must be a pure preview.
- **Secrets.** Never print `JIRA_API_TOKEN`, GitHub tokens, or email addresses from `WEEKLY_DEV_REPORT_CC` into the report body or stdout. Recipient list is OK to echo on successful send.
- **Timeout.** 20-second timeout on each `jira`, `curl`, and `gh` call. Network flakes happen; retry once, then log a warning and continue rather than aborting the whole run.
- **Partial data is fine.** If one dev's GitHub data fails to resolve, mark their row "GitHub data unavailable" and continue. The report is better incomplete than missing.
- **Roster source is authoritative.** If someone has no active-sprint tickets but did GitHub work this week, they are NOT in the report. The sprint is the lens.
- **Throughput via transitions, never assignee.** Current `fields.assignee` is a holdings signal, not a throughput signal, because the workflow auto-reassigns tickets at `in QA`. The Team-at-a-glance and per-dev sections must derive throughput from `status CHANGED TO <X> BY <user> DURING (...)`.
- **QA role auto-detected, not hardcoded.** Never hardcode a tester's name or email in the skill. Always detect via the majority-holder rule in Step 2 and label their row `(QA)`. Secondary "in QA" holders (e.g. a CTO receiving escalations) are devs/leaders, not QA.
- **Weekly = previous completed Mon → Sun.** Never report on the currently running week; it is meaningless because work is mid-flight.
- **Working days.** When computing `days_left` and `expected_hours`, exclude Saturdays and Sundays. Do not attempt to detect holidays.
- **Env vars referenced** (document at the top of output if any are unset and affect the run):
  - `WEEKLY_DEV_REPORT_TO` — required when `--send` is used; primary email recipient
  - `WEEKLY_DEV_REPORT_CC` — optional additional email recipients (comma-separated)
  - `GITHUB_USERNAME_MAP` — optional `email=ghuser` manual override on top of auto-mapping (Step 5)
  - `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` — required for curl-based Jira calls (dev-info, changelog, worklog); if unset, try `jira` CLI equivalents
