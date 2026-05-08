---
name: weekly-dev-report
description: Generate a weekly team activity report from the active Jira sprint and linked GitHub repos, with per-member achievability ratings, stuck-ticket flags, stalled-member flags, and worklog audit. The roster mixes engineers, QA, content, and consultants; titles and language stay generic so non-engineering members aren't mislabelled. Use when the user wants a weekly activity report, sprint progress audit, contributor status report, time-logged audit, or team check-in. Pulls roster from the active sprint, auto-discovers repos from Jira ticket dev-info, emails the report on --send, otherwise writes WEEKLY_REPORT.md and prints to stdout.
allowed-tools: Bash(jira:*), Bash(gh:*), Bash(git:*), Bash(curl:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(echo:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(printenv:*), Bash(printf:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(xargs:*), Read, Write, mcp__atlassian__searchJiraIssuesUsingJql, mcp__atlassian__getJiraIssue, mcp__github__list_pull_requests, mcp__github__list_commits, mcp__github__get_pull_request_reviews, mcp__github__search_issues, mcp__github__get_pull_request
---

# Weekly Activity Report

Generate a weekly activity report for every team member with tickets in the active Jira sprint. The roster typically mixes engineers, QA, content/media folks, and consultants — keep all member-facing language generic ("team member", "member", "contributor") so the report does not mislabel anyone as an engineer. The report includes per-member sprint achievability (🟢🟡🔴), ticket and PR activity, time-logged audit, and flags for stuck tickets and stalled members. Writes `WEEKLY_REPORT.md` to the current directory, prints to stdout, and on `--send` delivers via Gmail.

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

3. Compute the raw week window (**previous completed week**, never the current running week):
   - `week_end = most recent past Sunday 23:59 local` (if today is Sunday, use today − 7 days)
   - `week_start = week_end − 6 days at 00:00 local` (the Monday of that same week)
   - Apply `--week-offset N` by subtracting `7*N` days from both (0 = previous completed week, 1 = the week before that)

4. **Pick the weekly-anchor sprint** — the sprint whose tickets, transitions, PRs, and worklogs are the basis for every weekly-window metric in the report:
   - If `[week_start, week_end]` overlaps with the active sprint (any day in the window falls within `[sprint.startDate, sprint.endDate]`), the weekly-anchor sprint is the **active sprint**.
   - Otherwise (the whole weekly window falls before the active sprint — typically because the active sprint started after the previous Sunday), the weekly-anchor sprint is the **previous closed sprint** (the most recent sprint on the same board with `state=closed`). When this fallback fires, every weekly table is computed against that previous sprint's tickets and bounds, and the report header explicitly states `weekly-anchor sprint = <previous sprint name>`. Sprint-to-date metrics still target the active sprint.
   - **Clamp** the window to the chosen anchor sprint's bounds: `week_start = max(week_start, anchor.startDate)`, `week_end = min(week_end, anchor.endDate)`. Report dates in local time.
   - Never produce an empty weekly window. If clamping would invert the range under both choices, abort with an explanatory message and ask the user how to proceed.
   - Rationale: a report covering the still-running week is meaningless because the team is mid-task. But silently dropping the weekly section when the active sprint is fresh hides a full week of contribution — the previous-sprint fallback keeps the weekly view honest.

5. Compute the **sprint-to-date** window separately: `[active_sprint.startDate, today 23:59 local]`. This is used for sprint-achievability calculations and the "sprint-to-date" throughput table. Keep it distinct from the weekly window.

6. Extract the Jira server URL for browse links — prefer the env var, fall back to the jira-cli config (path varies by platform):

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

Build the **roster** = unique assignees across all active-sprint issues. Skip unassigned issues for per-member sections (but include their totals in the team rollup). Do not assume roster members are engineers — many will be QA, content, or consultants. Use generic terms ("team member", "contributor") in all human-facing output.

### Detect the QA role

Critical for attribution: when a contributor moves a ticket to `in QA`, the ticket auto-reassigns to the QA tester. This means current `fields.assignee` reflects who holds the ticket now, not who did the upstream work. To correct:

1. Count how many current-sprint issues are currently in status `in QA` per assignee.
2. The assignee with a clear majority (≥ 60% of all `in QA` tickets) is the **QA tester**. Store as `qa_user`. If no one holds a clear majority, `qa_user = null` (team has no single tester and the QA-aware rules below are skipped).
3. **Do not classify runner-up "in QA" holders as testers** — those are escalation destinations (e.g. a CTO or tech lead who gets items the primary tester couldn't resolve). They are contributors / leaders, not QA.
4. The QA user's row in the team-at-a-glance table should be labelled with a `(QA)` suffix, and their "throughput" is counted as QA validations (transitions they made to `Done`), not feature completions.

Also fetch the **previous sprint** (same board, state=closed, most recent end date) for stalled-member comparison:

```bash
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/agile/1.0/board/<BOARD_ID>/sprint?state=closed" | jq '.values | sort_by(.endDate) | last'
```

If the board ID isn't obvious, get it from the active sprint's `originBoardId`.

## Step 3: Count transitions and fetch worklogs

### Cycle time per ticket (In Progress → Code Review)

For each ticket a member transitioned **into** `Code Review` or `in QA` during the weekly window, compute the most recent prior `In Progress` start time and take the delta:

```bash
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>?expand=changelog&fields=summary" \
  | jq '{
      key: .key,
      summary: .fields.summary,
      ip_to_cr_seconds: (
        (.changelog.histories
          | map({when: .created, items: .items})
          | map(.items[] |= ({when: .when} + .))
          | .[].items[]?
          | select(.field=="status")) as $h
        | null  # placeholder — see implementation note below
      )
    }'
```

Implementation note: the cleanest way is to walk `.changelog.histories | sort_by(.created)` and remember `last_in_progress_at`. When you hit a status change `to == "Code Review"` (or `to == "in QA"` if no Code Review step happened in between), record `delta = parsed(history.created) - last_in_progress_at`. If multiple In-Progress→Code-Review cycles happened on the same ticket, take the **last full cycle that ended within the weekly window**. Skip tickets whose cycle started before the previous sprint's start date (treat as no signal).

Aggregate per member:

- `cycle_seconds[]` = list of `delta` for each ticket they transitioned in the window
- `cycle_avg_hours` = mean of `cycle_seconds[]` ÷ 3600 (or `—` if zero tickets had a measurable cycle)

This number lands in the team-at-a-glance table as the "Avg cycle (IP→CR)" column (Step 7) and surfaces in the per-member section's why-line when it's significantly above team median.

### Transition counts per member (authoritative throughput metric)

Do **not** use current `fields.assignee` for throughput. Instead, count status transitions each user made within a given window. JQL `BY <user> DURING (...)` is cheap and avoids having to pull full changelogs:

```bash
# per member, per target status, per window
jira issue list -q 'sprint = <SPRINT_ID> AND status CHANGED TO "<status>" BY "<email>" DURING ("<from>", "<to>")' \
  --plain --no-headers --no-truncate --columns KEY | grep -c "^${KEY_PREFIX}-"
```

Important: when the user is invalid or has no results, the CLI prints a `✗ No result found` line. Always filter by `grep -c "^${KEY_PREFIX}-"` (not `wc -l`) to avoid counting that line as 1. `KEY_PREFIX` is read from the sprint's first issue key (Step 4) and is **not** hardcoded.

For each member in the roster (skipping `qa_user`), count transitions to **each** of these target states, for **each** of these windows:

| Target status | Meaning |
| --- | --- |
| `Code Review` | member opened a review (first hand-off) |
| `in QA` | member finished and handed to QA |
| `Done` | member closed directly (non-QA items) |
| `REJECTED` | triage dispatch (e.g. auto-filed PROD bugs dismissed as noise) |

Also collect, per member, the **set of tickets they touched in the week** = the union of issues returned by `status CHANGED ... BY <user> DURING (<window>)` across **any** transition (any source, any target). For each ticket store `{ key, summary }`. This list feeds the new `Tickets worked` column in the team-at-a-glance table (Step 7) and the per-member detail section. Always render Jira references as `[KEY](.../browse/KEY) — short summary` so the reader has context without clicking.

Windows:

- **Weekly** = `[week_start, week_end]` (previous completed Mon → Sun)
- **Sprint-to-date** = `[sprint.startDate, today]`

For `qa_user`: count transitions to `Done` (QA validations) and to `in QA` (kick-backs / regressions logged) across the same two windows.

### Full changelog (only where needed)

Only pull full changelogs for issues flagged for stuck-ticket analysis (Step 6). Do NOT expand changelogs for every sprint issue — that's hundreds of API calls and `BY ... DURING (...)` JQL already covers the throughput question.

```bash
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>?expand=changelog"
```

### Worklogs (per-member daily breakdown)

Fetch per issue in the **weekly-anchor sprint** (paginate via the worklog endpoint, which is unbounded unlike the 20-entry issue-view field):

```bash
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>/worklog?startAt=0&maxResults=1000" | jq '.worklogs'
```

For each entry, record `{ author.accountId, author.displayName, started, timeSpentSeconds, issueKey }`. Convert `started` to local timezone before bucketing.

**Roster filter for the time table.** Drop a member from the time-logged table if they have **zero worklog entries in the trailing 28 days from today**, across any issue (not just sprint issues). Run a cheap JQL `worklogAuthor = "<accountId>" AND worklogDate >= -28d` per roster member to confirm. These are typically consultants who don't log in Jira; they remain in throughput tables but are silently absent from the time table — do not mark them red, do not list them as "0h". The report header should state how many members were dropped from the time table for this reason.

For each remaining member, compute over `[week_start, week_end]`:

- `daily_hours[date]` = sum `timeSpentSeconds / 3600` for all entries whose local-day equals `date` (one bucket per Mon, Tue, … Sun in the window — pre-fill missing days with 0)
- `total_hours` = sum across the window
- `working_days_below_7h` = count of working days (Mon–Fri inside the window) where `daily_hours[date] < 7.0`. A working day with zero entries counts as 0h and triggers the flag.
- `pattern_flag` = true if the member has **≥ 3 entries in the window** AND every entry shares the same `started` time-of-day (HH:MM, local) AND the same `timeSpentSeconds`. Below 3 entries the signal is too noisy and the flag stays false.
- `logged_tickets` = distinct list of `{ key, summary }` for every issue that received a worklog entry from this member in the window. Resolve `summary` once per key (cache it — it's the same string for every entry on that ticket). This list renders into the new `Jira logged` column on the time-logged table (Step 7).

These per-member numbers feed both the rendered "Time logged" table (Step 7) and the rating formula (Step 6).

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

## Step 5: Gather GitHub metrics per member

### Auto-map GitHub users → Jira users via PR-to-transition links

The team's PR template requires Jira keys in PR titles/bodies. Cross-referencing a PR's referenced ticket with **who moved that ticket forward in Jira** (not its current assignee) gives a reliable auto-mapping. Current assignee is unreliable because of QA reassignment: most merged-PR tickets end up assigned to `qa_user`, so assignee-based mapping mis-labels every contributor as the QA tester.

Procedure:

1. For every repo in `REPOS`, list PRs merged in the sprint-to-date window and extract any `<PROJECT>-<NUM>` keys from the PR title, body, or head branch name:

   ```bash
   gh search prs --owner <org> "<KEY_PREFIX>-" --merged --merged-at "<sprint.startDate>..<today>" \
     --json number,title,author,repository,url --limit 400
   ```

2. Build the set of `(github_login, ticket_key)` pairs from step 1.

3. For each roster member (skipping `qa_user`), list the tickets they transitioned **out of** `In Progress` or `Code Review` within the sprint-to-date window:

   ```bash
   jira issue list -q 'sprint = <SPRINT_ID> AND status CHANGED FROM "In Progress" BY "<email>" DURING ("<from>", "<to>")' --plain --no-headers --columns KEY
   jira issue list -q 'sprint = <SPRINT_ID> AND status CHANGED FROM "Code Review"  BY "<email>" DURING ("<from>", "<to>")' --plain --no-headers --columns KEY
   ```

   The union of these is this member's "I worked on it" ticket set. This bypasses QA-reassignment entirely because it asks who did the transition, not who currently holds the ticket.

4. For each `(github_login, jira_user)` pair, count the number of distinct tickets that appear in both sets. Build `score[github_login][jira_user] = overlap_count`.

5. For each GitHub login, pick the Jira user with the highest score as its mapping. Require score ≥ 2 (at least 2 overlapping tickets) to confirm. Below that, the login is `ambiguous` — still include in the report but flag it.

6. Optional override: if env var `GITHUB_USERNAME_MAP` is set (format `email1=ghuser1,email2=ghuser2`), it **overrides** the auto-detected mapping for those emails. Use this as a last-resort manual patch only.

7. If auto-mapping still leaves a member unresolved (no PRs in the window), mark their GitHub columns as `—` and add a caveat. Do not block the report.

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

Compute per member:

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

### Stalled member flag

For each member (excluding `qa_user`), flag if **all** of:

- Assigned ≤ 2 issues in the active sprint
- ≥ 50% of their active-sprint issue keys were also in the previous sprint
- Zero status transitions **authored by them** (via JQL `BY <user>`) on any sprint issue during both the week window and the full sprint-to-date window

The last condition checks **author of the transition**, not current assignee — a member who moved their last ticket to `in QA` and then got reassigned to QA should NOT be flagged as stalled.

### Per-member rating (🟢🟡🔴)

The rating is anchored on **PR throughput per working day in the weekly window**, with hardness floors from the worklog data. PRs are the primary signal because, with AI assistance, "at least one PR per working day" is the team's working baseline. Note: not every roster member is expected to ship PRs (QA, content, consultants); the rating is meaningful for engineering contributors and is suppressed for the QA row. For non-engineering members the report should call out the role mismatch in the why-line so the rating isn't misread.

Inputs (all over `[week_start, week_end]` against the **weekly-anchor sprint** chosen in Step 1):

- `prs_merged_week` = number of PRs merged within the window where this member is the **author** (the opener), resolved via the GH→Jira map from Step 5; a PR counts iff `pr.author.login` maps to their Jira identity. The user who clicked merge does **not** get credit — that belongs to a separate `Reviews` / `merged-for-others` metric. Count merges only (not opens or closes-without-merge), and exclude bot/automation accounts.
- `working_days_in_week` = count of Mon–Fri inside `[week_start, week_end]` (typically 5; will be smaller if the window was clamped at a sprint boundary).
- `pr_per_day` = `prs_merged_week / working_days_in_week`.
- `worklog_short_day` = true if any working day in the window has `daily_hours < 7.0` (from the worklog section). False (and irrelevant) if the member was dropped from the time table for the 28-day-no-entries rule.
- `worklog_pattern_flag` = the `pattern_flag` from the worklog section.
- `is_stalled` = stalled-member flag from this section above.

Rating rules (apply in order, first match wins):

- 🔴 **Red** if any: `is_stalled`, OR `pr_per_day < 0.5` (i.e. fewer than one PR every other working day).
- 🟡 **Yellow** if any: `pr_per_day < 1.0` (at least one PR every other day, but less than one PR per day), OR `worklog_short_day`, OR `worklog_pattern_flag`.
- 🟢 **Green** otherwise (`pr_per_day ≥ 1.0` AND no worklog flags).

The PR threshold is **per working day**. For a normal 5-working-day week:

- 🟢 ≥ 5 PRs merged
- 🟡 3 or 4 PRs merged (or ≥ 5 but with a worklog flag)
- 🔴 ≤ 2 PRs merged (or ⚠️ Stalled)

For a clamped 4-working-day week, the corresponding bands are ≥ 4 / 2–3 / ≤ 1, and so on.

One-line "why" per rating: state the worst driver. Examples:

- `"Red — 1 PR / 5 working days = 0.2/day"`
- `"Red — ⚠️ Stalled (1 carryover ticket, 0 transitions sprint-to-date)"`
- `"Yellow — 4 PRs / 5 working days = 0.8/day"`
- `"Yellow — 6 PRs but Wed = 4h logged (< 7h)"`
- `"Yellow — 7 PRs but every worklog entry is 09:00 / 8h exactly"`
- `"Green — 8 PRs / 5 working days = 1.6/day"`

**Carve-outs.**

- `qa_user` is not rated on this scale — their row shows QA-specific metrics (validations done, regressions logged).
- A member who was excluded from the time table for the 28-day rule (consultant) is rated on PRs alone — both worklog flags evaluate to false for them.
- Members flagged as **content team** or any other non-engineering role in the report's per-member caveats (e.g. via project memory) should still be rated, but the why-line must call out the role mismatch so the reader does not interpret a 🔴 as poor performance.

## Step 7: Render the report

Write to `WEEKLY_REPORT.md` in the current working directory, and print the same content. Every visual line break between sections, paragraphs, stats, and table captions must be a `<br>` (end-of-line or own-line) so markdown renderers don't collapse consecutive lines. Format:

````markdown
# Weekly Activity Report

**Active sprint:** <active sprint name> (sprint-to-date metrics) <br>
**Weekly-anchor sprint:** <same as active, OR "previous closed sprint <name>" if the fallback fired> <br>
**Weekly window:** <week_start> → <week_end> (<N> working days; previous completed Mon → Sun, clamped to weekly-anchor sprint bounds) <br>
**Sprint-to-date window:** <active_sprint.startDate> → <today> <br>
**Sprint ends:** <active_sprint.endDate> <br>
**Team rating:** <🟢|🟡|🔴> <br>
**QA:** <qa_user displayName, or "not detected"> <br>
**Time table:** <K of M members in scope; X dropped under the 28-day no-entries rule (consultants / non-loggers)>

<Two-sentence overall summary: sprint % complete, notable flags, roster-level hours coverage if low.>

## Team at a glance (weekly throughput)

Throughput is measured by status transitions authored by each user during the weekly window. Current `fields.assignee` is NOT used here (tickets auto-reassign when moved to in QA). The PR column counts merges where the member was the **author** of the PR (the opener), not the user who clicked merge — so when a tech lead merges someone else's PR, credit goes to the opener.

**Inclusion filter:** drop a roster member from this table if they had **zero status transitions AND zero authored-merged PRs** in the weekly window. Those rows aren't contribution activity; carrying them as 🔴 just adds noise. Dropped members may still appear in:

- the **Time logged** table (if they meet the 28-day worklog rule), and
- the **⚠️ Stalled members** section below (if they have an active sprint ticket that hasn't moved at all this sprint).

The header should state how many roster members were dropped under this filter so the reader knows the table is filtered, e.g. "_4 roster members omitted (no Jira movement and no authored PRs this week — see Stalled section if applicable)_".

`qa_user` is exempt from this filter and always shown if they had any activity.

| Team member | Rating | → Code Review | → in QA | → Done | → REJECTED | PRs authored & merged | PRs/day | Tickets/day | Avg cycle (IP→CR) | Why |
| --- | --- | ---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:| --- |
| Alice | 🟢 | 4 | 3 | 0 | 0 | 6 | 1.2 | 1.4 | 18h | Green — 6 PRs / 5 working days = 1.2/day |
| Bob | 🔴 | 0 | 0 | 0 | 0 | 1 | 0.2 | 0.2 | — | Red — 1 PR / 5 working days = 0.2/day |
| Jamie (QA) | — | — | 2 | 20 | — | — | — | 4.4 | n/a | QA validations |

Rows sorted: 🔴 first, 🟡 next, 🟢 last, `qa_user` last. Break ties by `PRs authored & merged` descending, then `→ in QA` descending.

Column rules:

- `Tickets/day` = (count of distinct tickets touched by transitions in the week) ÷ working days. Reflects how many *different* pieces of work the member moved, complementing `PRs/day` which only counts merges.
- `Avg cycle (IP→CR)` = average of `(Code Review timestamp − last In Progress timestamp)` for tickets the member transitioned to Code Review (or to in QA when they skipped CR) during the window. Shown in hours when < 48h, in days otherwise. `—` when the member moved no tickets through that gate this week.

Keep the table focused on numbers — the **list of tickets each member transitioned this week** lives in the per-member detail section below (Step 7 / per-member detail), not in this table. That keeps each row to a single line and prevents the table from growing horizontally past the screen.

## Time logged (week window)

Members with **zero worklog entries in the trailing 28 days from today** are omitted from this table — typically consultants who don't log to Jira. The header notes how many were dropped under that rule.

| Team member | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Total | Flags | Jira logged |
| --- | ---:| ---:| ---:| ---:| ---:| ---:| ---:| ---:| --- | --- |
| Alice | 8.0 | 7.5 | 7.5 | 8.0 | 8.0 | — | — | 39.0 | — | • [DEV-1201](url) — Add X endpoint <br> • [DEV-1205](url) — Fix Y bug |
| Bob | 4.0 | 8.0 | 8.0 | 8.0 | 8.0 | — | — | 36.0 | ⚠️ Mon < 7h | • [DEV-1310](url) — Refactor auth |
| Carol | 8.0 | 8.0 | 8.0 | 8.0 | 8.0 | — | — | 40.0 | ⚠️ every entry is 09:00 / 8h exactly | • [DEV-1599](url) — Maintenance bucket |

Render rules:

- One row per member still in scope after the 28-day filter, sorted by total hours descending.
- `Sat`/`Sun` columns show `—` when there are no entries (weekend work is allowed but not expected; never flagged).
- Working-day cells (Mon–Fri inside the window) showing `< 7h` are bolded so the eye can scan the column.
- Flags column lists, comma-separated: any working day under 7h (e.g. `⚠️ Wed < 7h`); the pattern flag if active (e.g. `⚠️ every entry is HH:MM / Nh exactly`); both if both apply.
- If the entire team triggers the pattern flag, surface a header note ("⚠️ Worklog entry pattern across team — verify clocking practice") rather than tagging every row individually.
- `Jira logged` column = bullet list of every distinct ticket that received a worklog entry from the member in the window, formatted `[KEY](url) — summary`. One bullet per row, `<br>` between bullets. If a member logged on > 8 distinct tickets, show the 8 with the most hours and append `… (+N more)`.

## Sprint-to-date throughput

Same columns as above but covering `[sprint.startDate, today]`. This is the view that correctly credits members for work that has since been reassigned to QA.

## Who holds what now (current-assignee snapshot)

A separate, lower-priority table showing current `fields.assignee` counts by status. Useful for "what is in my queue" but explicitly labelled as a holdings snapshot, not throughput. Keep this below the throughput tables so readers don't confuse the two.

## Releases this week (Jira ↔ GitHub reconciliation)

For the weekly window, fetch:

1. **Jira releases** — for each in-scope project (typically the project that owns the active sprint, e.g. DEV):

   ```bash
   curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/project/<PROJECT_KEY>/versions" \
     | jq --arg ws "$WEEK_START" --arg we "$WEEK_END" \
          '[.[] | select(.released==true and (.releaseDate // "") >= $ws and (.releaseDate // "") <= $we) | {name, releaseDate, description, projectId}]'
   ```

2. **GitHub releases / tags** — per repo discovered in Step 4:

   ```bash
   gh release list --repo <owner>/<repo> --limit 50 --json tagName,publishedAt,name
   gh api "repos/<owner>/<repo>/tags?per_page=100" --jq '.[] | {tag: .name, sha: .commit.sha}'
   ```

   Filter by `publishedAt` falling inside the weekly window (`gh release list` is the cleanest source; raw tags fall back when no formal release was created).

3. **Reconcile** — match Jira version names to GitHub tag/release names. Normalize aggressively (case-insensitive, strip leading `v`, allow trailing `-rc`/`-beta` suffix variants). For each Jira release, expected counterparts are:

   - exact tag in the relevant repo(s) — green ✅
   - GitHub release exists but tag spelling differs (e.g. Jira `12.4.0` vs GitHub `v12.4.0`) — yellow ⚠️ "name normalization" (still considered matched)
   - no GitHub tag/release within the window — red ❌ "Jira marks released, GitHub has no tag"
   - GitHub tag without a Jira release version — yellow ⚠️ "untracked GitHub release"

Render:

| Release | Date | Jira project / version | GitHub repo / tag | Status |
| --- | --- | --- | --- | --- |
| 12.4.0 | 2026-04-29 | DEV / 12.4.0 (Android) | ugroupmedia/pnp-android / v12.4.0 | ✅ matched |
| 8.1.2 | 2026-04-30 | DEV / 8.1.2 (API) | ugroupmedia/pnp-api / 8.1.2 | ⚠️ name normalized (Jira `8.1.2` ↔ GitHub `8.1.2`) |
| n/a | 2026-04-28 | _(missing)_ | ugroupmedia/pnp-web-next / 2026.04.28-rc | ⚠️ untracked GitHub release |
| 1.5.0 | 2026-05-01 | DEV / 1.5.0 (Scripts) | _(none)_ | ❌ Jira released, no GitHub tag |

If neither Jira nor GitHub had any releases in the window, render the section as a single line: "_No releases this week._" Do not omit the section entirely — its absence is itself information.

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

## Per-member detail

### Alice — 🟢

_On track. 4 of 6 tickets moved to Done this week._

**Tickets transitioned this week** (full list — bullet per ticket, format `[KEY](url) — summary`):

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

<Repeat per member, 🔴 → 🟡 → 🟢>
````

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
- **Partial data is fine.** If one member's GitHub data fails to resolve, mark their row "GitHub data unavailable" and continue. The report is better incomplete than missing.
- **Roster source is authoritative.** If someone has no active-sprint tickets but did GitHub work this week, they are NOT in the report. The sprint is the lens.
- **Generic role language.** The roster mixes engineers, QA, content/media folks, and consultants. Never call the report or its rows "developers" or assume engineering as a default — use "team member", "member", "contributor", or the explicitly detected role (`QA`, content team, consultant). The rendered title is "Weekly Activity Report", not "Weekly Developer Report".
- **Throughput via transitions, never assignee.** Current `fields.assignee` is a holdings signal, not a throughput signal, because the workflow auto-reassigns tickets at `in QA`. The Team-at-a-glance and per-member sections must derive throughput from `status CHANGED TO <X> BY <user> DURING (...)`.
- **QA role auto-detected, not hardcoded.** Never hardcode a tester's name or email in the skill. Always detect via the majority-holder rule in Step 2 and label their row `(QA)`. Secondary "in QA" holders (e.g. a CTO receiving escalations) are contributors / leaders, not QA.
- **Weekly = previous completed Mon → Sun.** Never report on the currently running week; it is meaningless because work is mid-flight. When that window falls entirely outside the active sprint (the active sprint is brand-new), use the previous closed sprint as the **weekly-anchor sprint** instead of producing an empty report — see Step 1 item 4.
- **Per-day PR threshold drives the rating.** 🟢 ≥ 1 PR per working day, 🟡 ≥ 0.5/day, 🔴 < 0.5/day or ⚠️ Stalled. Worklog flags (any working day < 7h, or every entry sharing the same start-time + duration) cap a member at 🟡. See Step 6.
- **Time table omits no-clock consultants.** Drop a member from the time-logged table if they have zero worklog entries in the trailing 28 days. They stay in the throughput tables and are still rated on PRs.
- **Throughput table omits non-contributors.** Drop a roster member from the team-at-a-glance and per-member sections if they had zero Jira transitions AND zero authored-merged PRs in the weekly window. Those rows are not contribution activity. They may still show up in the Time-logged table (if they clocked) or the Stalled section (if they hold a sprint ticket that hasn't moved). The report header should state the count of dropped rows.
- **PR credit goes to the author, never the merger.** A PR counts for whoever opened it, even when someone else hits the merge button. "Merged X PRs for other people" is a separate metric and belongs in a Reviews / merged-for-others column, not in the member's authored-PR count.
- **Always cite Jira tickets with key + summary.** Every Jira reference rendered in the report — in tables, bullets, why-lines, captions, anywhere — must read `[KEY](.../browse/KEY) — short summary`. A bare `DEV-1234` link is not enough; the reader needs the title to understand without clicking. Truncate summaries to ~80 chars if needed but never omit them.
- **Releases reconciled across Jira and GitHub.** The Releases-this-week section must compare Jira `released==true` versions in the window with GitHub tags / releases in the same window and surface mismatches. If neither system has releases in the window, render an explicit "_No releases this week._" line — do not silently omit the section.
- **No skill / process meta-commentary in the rendered report.** The output is a status report for the team — never include sections like "Skill changes shipped this run", "Implementation notes", "TODOs for the script", or any other description of how the report was produced. Those belong in commit messages and the skill source itself, not in `WEEKLY_REPORT.md`. The report ends after the per-member detail and the trailing "Preview written to WEEKLY_REPORT.md. Re-run with --send to email." line.
- **Working days.** When computing `days_left` and `expected_hours`, exclude Saturdays and Sundays. Do not attempt to detect holidays.
- **Env vars referenced** (document at the top of output if any are unset and affect the run):
  - `WEEKLY_DEV_REPORT_TO` — required when `--send` is used; primary email recipient
  - `WEEKLY_DEV_REPORT_CC` — optional additional email recipients (comma-separated)
  - `GITHUB_USERNAME_MAP` — optional `email=ghuser` manual override on top of auto-mapping (Step 5)
  - `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` — required for curl-based Jira calls (dev-info, changelog, worklog); if unset, try `jira` CLI equivalents
