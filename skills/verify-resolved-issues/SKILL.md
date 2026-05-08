---
name: verify-resolved-issues
description: Audit issues in a "resolved" / "fixed" / "done" state that have not been closed yet, verify the fix actually exists in the current codebase, then either close them with a detailed summary or kick them back to the original resolver with an explanation. Use when the user wants to verify resolved issues, audit resolved tickets, audit closed issues, check fixed bugs, close stale resolved issues, clean up the resolved column, sweep resolved issues, sweep done tickets, verify fixes, confirm resolutions, validate that fixed issues are really fixed, or review the resolved-but-not-closed backlog. Works against GitHub Issues if enabled on the repo, otherwise against Jira. Handles Jira projects with separate "Resolved" → "Closed" workflow as well as projects that use a single terminal state.
allowed-tools: Bash(gh:*), Bash(jira:*), Bash(git:*), Bash(curl:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(mkdir:*), Bash(printf:*), Bash(rm:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*), Read, Grep, Glob, Write, Edit, mcp__github__list_issues, mcp__github__get_issue, mcp__github__search_issues, mcp__github__add_issue_comment, mcp__github__update_issue, mcp__github__get_pull_request, mcp__github__get_pull_request_files, mcp__github__list_commits, mcp__atlassian__searchJiraIssuesUsingJql, mcp__atlassian__getJiraIssue, mcp__atlassian__addCommentToJiraIssue, mcp__atlassian__transitionJiraIssue, mcp__atlassian__getTransitionsForJiraIssue
---

# Verify Resolved Issues

Audit every issue currently sitting in a "resolved / fixed / done" state but not yet closed. For each one, decide whether the fix is actually present in the current codebase, then either close it with a detailed summary or send it back to its original resolver with a precise explanation of what is missing.

The whole point of this skill is to break the silent failure mode where an issue gets marked "resolved" but the fix is incomplete, reverted by a later merge, or never matched the acceptance criteria in the first place. The "Resolved" lane in Jira and the "open + linked-PR-merged" set in GitHub are both notorious holding pens for this kind of drift. This skill verifies before it closes.

## Arguments

Parse arguments from the user's invocation:

- `--dry-run` (default) — print the planned action per candidate issue without writing comments or transitioning. Always default to dry-run; the user must explicitly opt in to writes.
- `--apply` — actually post comments, transition, and reassign. Without this flag, do nothing destructive.
- `--project <KEY>` — Jira only. Override the default project. If omitted, the skill uses **only** the user's default Jira project (from `jira` CLI config). Never audit across multiple projects unless the user explicitly says to.
- `--sprint <ID|name|"all">` — Jira only. Defaults to the **active sprint** of the default project. Pass an explicit sprint ID/name to target a different one, or `"all"` to drop the sprint filter (rare — only when the user explicitly wants a backlog-wide sweep).
- `--repo <owner/name>` — GitHub only. Restrict to a single repo. Defaults to the current `git remote origin` repo.
- `--key <KEY|#NUM>` — audit a single issue by key (`DEV-123`) or GitHub issue number (`#456`). Bypasses the candidate search and ignores `--project`/`--sprint`.
- `--limit N` — cap the number of candidate issues processed (default 50). Use this to keep first runs cheap.
- `--since <date>` — only consider issues that entered the resolved state on or after this date (ISO `YYYY-MM-DD`). Defaults to no lower bound.

**Default Jira scope is intentionally narrow: one project, one sprint.** Auditing every project the user can see, or the entire historical backlog, generates massive amounts of API traffic and noise — and most resolved-but-not-closed drift happens within the current sprint anyway, where the codebase still resembles the time of the fix. Broader scope is opt-in via `--project` (different project) or `--sprint all` (full backlog).

If `--apply` is set, **confirm with the user once** before the first write, listing the count of close-candidates and reopen-candidates. The cost of mass-mistakes here (mis-assigning, falsely reopening) is high, and a single confirmation is cheap.

## MCP Tools with Fallbacks

Prefer MCP tools when available; fall back to CLIs and `curl` when MCP returns tool-not-found or repeated errors. Both tracker integrations follow the same fallback pattern as `create-issue` and `weekly-dev-report` skills in this repo.

### GitHub Access

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Check issues enabled | `mcp__github__list_issues` succeeds | `gh repo view --json hasIssuesEnabled --jq '.hasIssuesEnabled'` |
| List candidate issues | `mcp__github__list_issues` / `mcp__github__search_issues` | `gh issue list --state open --label "fixed,resolved" --json ...` and `gh search issues "is:open is:issue linked:pr" --json ...` |
| Get issue detail | `mcp__github__get_issue` | `gh issue view <NUM> --json number,title,body,labels,assignees,state,createdAt,updatedAt,timelineItems` |
| Get linked PRs | `mcp__github__get_issue` (timelineItems) | `gh issue view <NUM> --json closedByPullRequestsReferences,timelineItems` |
| Get PR diff/files | `mcp__github__get_pull_request_files` | `gh pr view <PR> --json files,mergeCommit,mergedBy,author,state,merged,mergedAt` |
| Add comment | `mcp__github__add_issue_comment` | `gh issue comment <NUM> --body-file comment.md` |
| Close issue | `mcp__github__update_issue` (state=closed) | `gh issue close <NUM> --comment-from-file comment.md` |
| Reopen + reassign | `mcp__github__update_issue` (state=open, assignees) | `gh issue reopen <NUM>` then `gh issue edit <NUM> --add-assignee <user>` |

### Jira Access

| Operation | MCP Tool | CLI / REST Fallback |
| --- | --- | --- |
| List candidate issues | `mcp__atlassian__searchJiraIssuesUsingJql` | `jira issue list -q '<JQL>' --plain --no-headers --no-truncate --columns KEY,STATUS,SUMMARY,ASSIGNEE` |
| Get issue + changelog | `mcp__atlassian__getJiraIssue` (request `changelog`) | `curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>?expand=changelog,renderedFields"` |
| List project statuses | n/a via MCP | `curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/project/<KEY>/statuses"` |
| List issue transitions | `mcp__atlassian__getTransitionsForJiraIssue` | `curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>/transitions"` |
| Add comment | `mcp__atlassian__addCommentToJiraIssue` | `jira issue comment add <KEY> --no-input --template comment.md` or `curl -X POST .../issue/<KEY>/comment` with ADF body |
| Transition | `mcp__atlassian__transitionJiraIssue` | `curl -X POST -u ... -H 'Content-Type: application/json' -d '{"transition":{"id":"<TID>"}}' "$JIRA_URL/rest/api/3/issue/<KEY>/transitions"` |
| Reassign | n/a (use issue update) | `curl -X PUT -u ... -d '{"fields":{"assignee":{"accountId":"<ID>"}}}' "$JIRA_URL/rest/api/3/issue/<KEY>"` or `jira issue assign <KEY> <email>` |

If `$JIRA_URL`, `$JIRA_EMAIL`, `$JIRA_API_TOKEN` are missing for `curl`, try the `jira` CLI instead. If both fail, ask the user to set credentials rather than guessing.

## Step 1: Detect tracker

Mirror the detection used by `create-issue`:

1. `basename $(git rev-parse --show-toplevel)` — repo name for context.
2. `gh repo view --json hasIssuesEnabled --jq '.hasIssuesEnabled'`:
   - `true` → run the **GitHub** flow.
   - `false` → run the **Jira** flow.
3. If `--repo` or `--project` is passed, honor it directly without inferring tracker from the cwd.

If both are passed, that's a contradiction — ask the user which they meant.

---

## GitHub Flow

### Step 2-G: Find candidate issues

GitHub doesn't have a true "Resolved" lane, so the candidates are open issues whose fix landed but never got the issue closed. Use the union of these queries:

```bash
# Open issues whose linked PRs are merged (the most reliable signal)
gh search issues --repo <owner>/<repo> "is:issue is:open linked:pr" \
  --json number,title,labels,assignees,updatedAt,url --limit 200

# Open issues labeled "fixed" / "resolved" / "done" (project conventions vary)
gh issue list --repo <owner>/<repo> --state open \
  --label "fixed" --json number,title,labels,assignees,updatedAt,url
gh issue list --repo <owner>/<repo> --state open \
  --label "resolved" --json number,title,labels,assignees,updatedAt,url
gh issue list --repo <owner>/<repo> --state open \
  --label "done" --json number,title,labels,assignees,updatedAt,url
```

Then for each candidate, confirm via `gh issue view <NUM> --json closedByPullRequestsReferences,timelineItems` whether it has at least one **merged** PR. If it has none, drop it — open issues without merged-PR linkage are not "resolved" yet.

Apply `--since`, `--limit` filters at this stage.

### Step 3-G: Identify resolver and fix

For each candidate:

1. Find the closing PR(s) — `closedByPullRequestsReferences` is the closed-by list. Filter to those with `state = MERGED`.
2. Resolver = the merged PR's `author.login` (preferred) or `mergedBy.login` if the author is a bot. Track both — if they differ, the comment should mention both ("authored by X, merged by Y").
3. From the PR get `mergeCommit.oid`, the list of `files`, and the head/base refs.
4. Pull the diff: `gh pr diff <PR_NUM> --repo <owner>/<repo>` for review.

### Step 4-G: Verify in current codebase

For each candidate, decide whether the merged PR's intent matches what the issue described AND whether the changes are still present on the default branch.

1. **Read the issue body and acceptance criteria.** Extract concrete claims: "Button X should do Y", "Endpoint /foo returns 404 when ...", file paths, function names.
2. **Read the affected files in the current working tree** at the paths the PR touched. Don't trust the PR diff alone — a later commit may have reverted or reshaped it.
3. **Cross-check** that the behavior the issue described is reflected in code now:
   - If the issue named functions/files: read those files and confirm the described behavior is implemented.
   - If the PR added tests: run them (or at minimum locate and read them — `grep -r "<test name>" <test dirs>`).
   - If the issue was a regression bug: search for the old pattern that was supposed to be removed; if it's still there, the fix didn't take.
4. **If a linter or test runner is configured**, run it against the affected paths only — don't run the whole suite unless cheap. Look for regressions specifically related to the fix.

Decide one of three outcomes: **VERIFIED** (fix matches issue + present in codebase), **NOT_VERIFIED** (missing, partial, reverted, or never matched the issue's intent), or **SKIP_NEEDS_MANUAL** (the issue's correctness cannot be determined from code alone — it requires a human tester to confirm).

`SKIP_NEEDS_MANUAL` covers cases where reading code can't yield a confident verdict: visual / pixel / layout bugs, animation timing, cross-browser or device-specific rendering, end-to-end UX flows behind auth or third-party services, performance perception, audio/video, accessibility behavior with assistive tech, anything depending on a live external integration or staging environment. **When this is the outcome, do nothing** — no comment, no transition, no reassignment. Just record it as skipped in the report so a human can pick it up. A drive-by audit comment on a UX bug helps no one and clutters the ticket.

### Step 5-G: Act

Compose comments using the templates below. In `--dry-run`, print them to stdout (one block per issue) with the planned action and stop.

**On VERIFIED** — close the issue:

```bash
# MCP preferred
mcp__github__add_issue_comment ...
mcp__github__update_issue --state closed --state_reason completed
# CLI fallback
gh issue close <NUM> --comment-from-file comment.md --reason completed
```

**On NOT_VERIFIED** — comment, ensure the issue is open, reassign to the resolver:

```bash
# MCP preferred
mcp__github__add_issue_comment ...
mcp__github__update_issue --assignees '["<resolver-login>"]'
# CLI fallback
gh issue comment <NUM> --body-file comment.md
gh issue edit <NUM> --add-assignee <resolver-login>
# also remove a misleading "fixed"/"resolved" label, if present
gh issue edit <NUM> --remove-label "fixed" --remove-label "resolved" --remove-label "done"
```

GitHub doesn't have a "To Do" workflow column on plain Issues — reassignment + label cleanup is the equivalent. If the repo uses a Project (v2) board, mention in the comment that the resolver should drag it back to the Todo column.

---

## Jira Flow

### Step 2-J: Resolve the single project and sprint to audit

The Jira flow is **scoped to one project and one sprint**. Resolve them up front and use them everywhere:

1. **Project**: if `--project <KEY>` was passed, use it. Otherwise read the default project from the `jira` CLI config:

   ```bash
   PROJECT=$(grep -h '^project:' \
     ~/.config/.jira/.config.yml \
     ~/.jira/.config.yml \
     "${XDG_CONFIG_HOME:-$HOME/.config}/.jira/.config.yml" \
     2>/dev/null | head -n1 | awk '{print $2}')
   ```

   If no default is configured and `--project` wasn't passed, ask the user for the project key — never silently fall back to "all projects". Looping over every project the user can read is wrong by default: it's slow, noisy, and not what the user asked for.

2. **Sprint**: if `--sprint <ID|name>` was passed, resolve that. Otherwise default to the **active sprint** of the project's primary board:

   ```bash
   jira sprint list --state active --table --plain --no-headers --columns ID,NAME,START,END
   ```

   If multiple active sprints exist for the project (multi-team boards), ask the user which one. Only `--sprint all` removes the sprint filter — and only when the user explicitly opts in.

3. **Workflow topology** (one project, so one fetch): query the project's statuses and classify them. Workflows vary — some use `Resolved → Closed`, some `Done` only, some `Fixed → Verified → Closed` — so don't hardcode names:

   ```bash
   curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/project/$PROJECT/statuses" \
     | jq '[.[] | {issuetype: .name, statuses: [.statuses[] | {name, id, category: .statusCategory.key}]}]'
   ```

   The `statusCategory.key` field is the authoritative grouping — every Jira status belongs to one of:

   - `new` — initial workflow states (To Do, Open, Backlog, Selected for Development)
   - `indeterminate` — work-in-progress states (In Progress, Code Review, In QA, Blocked)
   - `done` — terminal states (Done, Closed, Resolved, Fixed, Verified, Won't Do, Cancelled)

   Classify the project's `done`-category statuses into two buckets:

   - **Penultimate-resolved**: terminal statuses that mean "fix is in but not yet ratified" — typically named `Resolved`, `Fixed`, `Done`, or `Verified` when followed by a `Closed`. Heuristic: a `done`-category status is penultimate-resolved if at least one **other** `done`-category status exists in the same workflow that isn't `Won't Do` / `Cancelled` / `Rejected`.
   - **Final-closed**: the truly terminal status. Heuristic: with multiple `done` statuses, the one named `Closed` (or the only one without an outbound transition, per the transitions API) is final. With a single `done` status, that status IS final-closed and there is no penultimate gap to audit — say so once and stop.

### Step 3-J: Build candidate JQL

Build one JQL query, scoped to the resolved project + sprint:

```jql
project = $PROJECT
  AND sprint = $SPRINT_ID                              -- omit only when --sprint all
  AND status in ("Resolved", "Fixed", "Done", ...)     -- penultimate-resolved names from Step 2-J
  AND statusCategoryChangedDate >= "<--since>"          -- only if --since is set
ORDER BY statusCategoryChangedDate DESC
```

Run via JQL search (paginate past 100):

```bash
mcp__atlassian__searchJiraIssuesUsingJql ...
# or
jira issue list -q "<JQL>" --plain --no-headers --no-truncate \
  --columns KEY,STATUS,ASSIGNEE,SUMMARY --paginate
```

Apply `--limit` after sorting by most-recently-resolved-first. Most-recent first matters: a 6-month-old "Resolved" ticket is much more likely to have been overtaken by code changes, so processing recent ones first surfaces clean closes faster and gives you signal early about workflow misconfigurations.

### Step 4-J: Identify the resolver

The resolver is the user who transitioned the issue **into** its current resolved status. Pull the changelog:

```bash
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>?expand=changelog" \
  | jq '[.changelog.histories[] | {author: .author, created, items: [.items[] | select(.field == "status")]}] | map(select(.items | length > 0))'
```

The `author` of the most recent `status` change whose `toString` is the current status is the resolver. Capture `accountId`, `displayName`, and `emailAddress` — you need `accountId` for reassignment via REST.

Do **not** fall back to current `fields.assignee` for the resolver. Many workflows auto-reassign on transition (e.g., `→ in QA` reassigns to the QA tester). The current assignee at "Resolved" is often a QA validator, not the dev who fixed it. Always derive resolver from the changelog.

### Step 5-J: Find the related code changes

Use the Jira dev-info API to find linked PRs, branches, and commits:

```bash
ID=$(curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>" | jq -r '.id')
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  "$JIRA_URL/rest/dev-status/latest/issue/detail?issueId=$ID&applicationType=GitHub&dataType=pullrequest" \
  | jq '.detail[0].pullRequests[]? | {url, status, author: .author.name, lastUpdate}'
```

Filter to merged PRs. Repeat for `dataType=branch` and `dataType=repository` if needed. From the PR URL extract `owner/repo/PR#` and switch to GitHub MCP / `gh` to read the diff and files (same as Step 4-G).

If dev-info is empty, fall back to a GitHub search for the issue key in PR titles/bodies/branches: `gh search prs --owner <org> "<KEY>" --merged --json repository,number,title,author,url`.

### Step 6-J: Verify in current codebase

Same procedure as **Step 4-G**, including the three-way outcome: **VERIFIED**, **NOT_VERIFIED**, or **SKIP_NEEDS_MANUAL**. Read the issue description and acceptance criteria, read the touched files in the current working tree, confirm the described behavior is present, run tests/linters narrowly if useful. If the ticket's correctness cannot be determined from code alone (visual/UX bugs, third-party integrations, device-specific behavior — see Step 4-G), mark **SKIP_NEEDS_MANUAL** and **do nothing on the ticket** — no comment, no transition, no reassignment. Skipped tickets only show up in the report.

The Jira description format is ADF (Atlassian Document Format) — when fetched via MCP it's typically rendered to text already; via REST you may need `?expand=renderedFields` and read `renderedFields.description` (HTML) or walk the `description` ADF tree. Acceptance criteria often live in a custom field — try `customfield_10100` (Atlassian default) and grep the issue's `fields` for keys whose name contains `Acceptance`.

### Step 7-J: Act

In `--dry-run`, print the planned action per issue and stop.

**On VERIFIED** — comment, then transition to the project's final-closed status:

1. Get available transitions for **this** issue (transitions are workflow-specific and depend on current status):

   ```bash
   curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>/transitions" \
     | jq '.transitions[] | {id, name, to: .to.name, toCategory: .to.statusCategory.key}'
   ```

2. Pick the transition whose `to.name` matches the project's final-closed status from Step 2-J. Don't pick by transition name (`"Close Issue"` vs `"Mark as Closed"` varies). Match on `to.name`. If the only available `done`-category transition leads back into a non-final state (e.g. only `→ Reopen` is available), that means the workflow doesn't allow direct closure from this user account — comment with the audit summary anyway and leave the transition to a human, noting the limitation in the comment.

3. Post the closing comment first, then trigger the transition. Comment-then-transition is the right order because some workflows fire automation on transition that immediately archives or notifies — you want the audit summary already on the ticket when that happens.

**On NOT_VERIFIED** — comment, transition back to the workflow's initial state, reassign to the resolver:

1. The "back to To Do" target = the `new`-category status that is the **start** of the workflow. From Step 2-J, the project's `new`-category statuses are known. Pick the one that is reachable as a transition target from the current resolved state (call `/transitions` and look for a `to.statusCategory.key == "new"` entry). If multiple candidates exist, prefer in this order: `To Do`, `Open`, `Backlog`, `Selected for Development`, then any other `new` status.

2. If no `new`-category transition is available directly from the resolved state (some workflows force you through "Reopened" first), take whichever transition leads back out of `done`-category, then post the comment noting that a human will need to move it the rest of the way.

3. Reassign to the resolver via REST:

   ```bash
   curl -X PUT -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
     -H 'Content-Type: application/json' \
     -d "{\"fields\":{\"assignee\":{\"accountId\":\"<RESOLVER_ACCOUNT_ID>\"}}}" \
     "$JIRA_URL/rest/api/3/issue/<KEY>"
   ```

4. Order: comment → reassign → transition. The comment must be on the ticket before reassignment so the resolver gets the notification with full context, not a bare "you've been assigned" ping.

---

## Comment Templates

The comments you post are the load-bearing artifact of this skill. A vague comment ("looks fixed!", "doesn't seem fixed") is worse than no comment, because it pollutes the audit trail. Be concrete: name files, line numbers, commits, and tests.

### Template: VERIFIED — Closing comment

```markdown
## Audit: verified fixed — closing

This issue was reviewed against the current state of the codebase and is confirmed resolved.

**Fix landed in:**
- {{repo}}#{{pr_number}} ({{merge_commit_short_sha}}) by @{{resolver}}, merged {{merged_at}}

**What was changed:**
- `{{file_path}}:{{line_range}}` — {{one-line summary of the change}}
- (...one bullet per significant file)

**How it satisfies the acceptance criteria:**
- "{{quoted criterion}}" → addressed by `{{file_path}}:{{line}}` ({{brief explanation}})
- (...one bullet per criterion)

**Tests covering this fix:**
- `{{test_file}}::{{test_name}}` — {{what it asserts}}
- (or: "No automated test added; manual verification only — recommend follow-up to add coverage.")

Closing.
```

### Template: NOT_VERIFIED — Reopen / kick-back comment

```markdown
## Audit: fix could not be verified — re-opening

This issue was marked resolved on {{resolved_date}} by @{{resolver}}, but the fix could not be confirmed against the current codebase.

**What I checked:**
- Linked PR(s): {{repo}}#{{pr_number}} (merged {{merged_at}})
- Files reviewed in current tree: `{{file_path}}` ({{lines_read}})
- Tests run: {{test command and result}} — or "no tests run, see below"

**What I expected to find (per the issue description):**
> {{quoted acceptance criterion or behavior described in the issue}}

**What is actually present:**
- `{{file_path}}:{{line}}` — {{exactly what is there now and why it doesn't match}}
- (or: file/symbol referenced in the issue no longer exists in the tree — appears to have been removed by `{{later_commit_sha}}`)

**Reproduction (if applicable):**
1. {{steps to demonstrate the issue still occurs}}

@{{resolver}} — reassigning to you. Could you either (a) point to the change that addresses this and re-resolve, or (b) re-open the work? If the issue was descoped or is no longer valid, please leave a comment and close as Won't Do.
```

Substitute every `{{placeholder}}` with concrete data — never leave a placeholder in a posted comment.

---

## Output (dry-run)

When `--apply` is not set, write a single Markdown summary to stdout (and, if it's longer than ~30 lines, also to `verify-resolved-issues-report.md` in the cwd so the user can reread it):

```markdown
# Verify Resolved Issues — Dry Run

Tracker: {{GitHub | Jira}}
Scope: {{repo `owner/name` for GitHub, or `project=<KEY>, sprint=<NAME or "all">` for Jira}}
Candidates evaluated: N
  ✓ Verified (would close): X
  ✗ Not verified (would reopen + reassign): Y
  — Skipped — needs manual tester: M
  — Skipped — insufficient signal: Z

## Verified — would close
- [{{KEY}}] {{summary}} — fix in {{repo}}#{{pr}} → would post: «one-line preview» → transition to "{{final_closed}}"

## Not verified — would reopen + reassign to resolver
- [{{KEY}}] {{summary}} — gap: {{one-line gap}} → reassign to @{{resolver}}, transition to "{{initial_state}}"

## Skipped — needs manual tester
- [{{KEY}}] {{summary}} — {{why this can't be confirmed from code alone, e.g. "UI rendering bug — needs visual QA", "Stripe webhook flow — needs sandbox replay"}}

## Skipped — insufficient signal
- [{{KEY}}] {{reason — e.g. "no merged PR linked", "single terminal state — nothing to audit", "ambiguous resolver"}}
```

After writing the report in dry-run mode, end with the literal line:

> Re-run with `--apply` to post comments and transition issues.

When `--apply` runs, replace "would close" / "would reopen" with "closed" / "reopened" and append per-issue success/failure status.

---

## Important Rules

- **Default to read-only.** No comments, transitions, or reassignments without `--apply`. The user must opt in to writes every run.
- **Default Jira scope is one project, one sprint.** Use the `jira` CLI's default project and the active sprint on its primary board. Never iterate across all visible projects, and never sweep historical sprints, unless the user explicitly passed `--project` for a different project or `--sprint all` for a backlog-wide pass. Wide scope is the single biggest source of noise and API spam in this skill — the narrow default exists to keep runs fast, focused, and verifiable.
- **Confirm once before the first write.** When `--apply` is set, present the summary and ask for confirmation before any tracker mutation. Don't ask per-issue — that's nag-spam — but do ask once.
- **Resolver is from the changelog, never from current assignee.** Workflows that auto-reassign on transition (very common for QA hand-offs) will give you wrong answers if you read `fields.assignee`. Always derive from `status` change history.
- **Workflow status names are not portable.** Don't hardcode `"Resolved"` or `"Closed"` as global constants. Use `statusCategory.key` (`new` / `indeterminate` / `done`) and per-project workflow introspection. The same word means different things in different projects.
- **Match transitions by `to.name`, not transition name.** Transition names like `"Close Issue"` are inconsistent across workflows. The `to.name` (target status) is what you actually care about.
- **Verify against the working tree, not just the PR diff.** A PR can land and later be reverted, refactored, or partially undone. The issue is fixed only if the behavior is in the **current code**.
- **If a fix is not verifiable from code alone, skip it silently.** Visual/UX bugs, third-party integration flows, device-specific rendering, and anything else that needs a human tester to confirm must be marked `SKIP_NEEDS_MANUAL` and left untouched — no comment, no transition, no reassignment. Only the dry-run report mentions them, so a human can take it from there.
- **Be concrete in comments.** Posted comments must include actual file paths, line numbers, commit SHAs, and quoted acceptance criteria. Vague audit comments degrade trust in future audit runs.
- **Comment before transition.** Especially on Jira where automation may fire on transition, the audit comment must already be on the ticket when the workflow change happens.
- **Preserve existing labels and fields you didn't touch.** When closing or reopening, only change what the audit decision dictates: state, the assignee on a kick-back, the misleading "fixed/resolved" label on a GitHub kick-back. Don't strip unrelated labels, fix-versions, or sprint assignments.
- **Skip projects with a single terminal state.** If a project's workflow has only one `done`-category status, there is no "resolved-but-not-closed" gap to audit. Note it once in the report and move on; don't error.
- **No silent truncation.** If `--limit` cut off candidates, say so explicitly in the report header. The user should never have to guess whether a list is complete.
