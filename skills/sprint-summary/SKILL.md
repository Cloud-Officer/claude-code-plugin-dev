---
name: sprint-summary
description: Summarize sprint work items grouped by repo and ~3-day blocks. Use when the user wants a sprint summary, a sprint scope report or sprint scope overview broken into work blocks, work summary, sprint breakdown, or wants to see what work is planned in a sprint. Fetches tasks and bugs from Jira (excludes stories), estimates effort from descriptions, and groups items into approximately 3-day work blocks per repository.
allowed-tools: Bash(jira:*), Bash(git:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(echo:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(xargs:*), Read, Write, mcp__atlassian__searchJiraIssuesUsingJql, mcp__atlassian__getJiraIssue, mcp__atlassian__editJiraIssue
---

# Sprint Summary

Generate a sprint work summary grouped by repository with items organized into approximately 3-day work blocks.

## Arguments

Parse arguments from the user's invocation:

- No flag (default) — compute estimates for items that have none, use them in the report, and write nothing to Jira. The run is read-only; the user must explicitly opt in to writes.
- `--write-estimates` — after computing them, save the estimates back to Jira as the original estimate on items that had none (Step 4.3). Without this flag, never call `jira issue edit` or `mcp__atlassian__editJiraIssue`.

## Run from the target repo's directory (direnv)

The `jira` CLI authenticates with the `JIRA_URL`/`JIRA_EMAIL`/`JIRA_API_TOKEN` that [direnv](https://direnv.net/) loads from the `.envrc` of the **current working directory**. Run it from a directory whose `.envrc` belongs to a different project/account and it authenticates as the wrong account — the command fails, or summarizes the wrong sprint.

**Before any `jira` command, make the relevant repo/workspace the working directory in its own step:**

```bash
cd /path/to/target-repo        # or, when already inside it: cd "$(git rev-parse --show-toplevel)"
```

Run the `cd` as a **separate** Bash call — never chain it as `cd … && jira …`. direnv reloads `.envrc` on the next prompt, so the *following* calls get the right token; a command on the same line as the `cd` still runs with the old environment. MCP tools (`mcp__atlassian__*`) captured their credentials when Claude started and are unaffected.

## MCP Tools with Fallbacks

This skill uses MCP tools when available and falls back gracefully if they are unavailable or return errors.

### Jira Access

**Prefer MCP tools** (`mcp__atlassian__*`) when available. If MCP tools are not available (tool not found errors), **fall back to the `jira` CLI**.

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Search sprint issues | `mcp__atlassian__searchJiraIssuesUsingJql` with `sprint = <ID>` | `jira sprint list <ID> --raw` |
| Get issue details | `mcp__atlassian__getJiraIssue` | `jira issue view <KEY> --raw` |
| Update estimate | `mcp__atlassian__editJiraIssue` | `jira issue edit <KEY> --no-input -o "Original Estimate=<HOURS>h"` |

**Note:** When using MCP tools, use JQL queries to filter sprint issues: `sprint = <SPRINT_ID> AND issuetype in (Task, Bug) AND status not in (Done, Closed, Resolved, "Ready to Test", "In QA", Testing)`.

## Step 1: Identify Sprint

1. **Determine the sprint**: The user provides a sprint ID or name. If not provided, use the current active sprint:

   ```bash
   jira sprint list --state active --table --plain --no-headers --columns ID,NAME,START,END
   ```

   If multiple active sprints exist, ask the user which one to use.

2. **Record the sprint's start and end dates.** Step 7 derives capacity from them, so never assume a sprint length. When the user named a specific sprint, drop `--state active` from the command above and take the row whose ID matches.

3. **Extract the Jira server URL** for building browse links — prefer the env var, fall back to the jira-cli config (path varies by platform):

   ```bash
   JIRA_SERVER="${JIRA_URL:-$(grep -h '^server:' \
     ~/.config/.jira/.config.yml \
     ~/.jira/.config.yml \
     "${XDG_CONFIG_HOME:-$HOME/.config}/.jira/.config.yml" \
     2>/dev/null | head -n1 | awk '{print $2}')}"
   ```

   If `$JIRA_SERVER` is empty, ask the user for the Jira base URL.

## Step 2: Fetch Sprint Items

Fetch all issues in the sprint as raw JSON, filtering to only tasks and bugs:

```bash
jira sprint list <SPRINT_ID> --raw | jq '[.[] | select(.fields.issuetype.name != "Story" and .fields.issuetype.name != "Epic" and .fields.issuetype.name != "Sub-task") | select(.fields.status.name | test("(?i)qa|ready.to.test|ready.for.test|testing|done|closed|resolved") | not)]'
```

**Excluded statuses**: Items in QA, testing, done, or similar states are already completed and must not appear in the report. Exclude any status matching: QA, Ready to Test, Ready for Test, Testing, In QA, Done, Closed, Resolved.

If the above doesn't return the right structure, try:

```bash
jira sprint list <SPRINT_ID> --plain --no-headers --no-truncate --columns TYPE,KEY,SUMMARY,STATUS,ASSIGNEE,PRIORITY
```

Then for each issue that is a Task or Bug, fetch full details:

```bash
jira issue view <ISSUE-KEY> --raw
```

For each item, extract:

- **Key**: e.g., `DEV-1234`
- **Type**: Task or Bug
- **Summary**: the issue title
- **Status**: current status
- **Assignee**: the person assigned to the item
- **Original Estimate**: `fields.timeoriginalestimate` (in seconds, divide by 3600 for hours)
- **Description**: the full description text (for effort estimation if no estimate exists)
- **Priority**: priority level

## Step 3: Detect Repository Grouping

For each item, determine its repository/project group from the summary using this precedence:

1. **Bracket prefix**: If summary starts with `[repo-name]`, extract `repo-name`
2. **Team field**: If the Jira item has a team or component field, use that
3. **Known prefix pattern**: If summary starts with a known word prefix (e.g., "web", "api", "mobile", "infra", "backend", "frontend", "ios", "android", "devops", "data"), use that prefix
4. **Fallback**: Use "General" as the group name

Normalize group names: all lowercase (e.g., `pnp-api`, `android`, `compliance`).

## Step 4: Estimate Effort for Each Item

For each item, check if a time estimate already exists in Jira:

1. **If `timeoriginalestimate` is set**: Use it directly. Convert seconds to days (divide by 28800 for 8-hour days). Skip AI estimation for this item.

2. **If no estimate exists**: Read the summary and description and pick exactly one of the six emittable values below. These six are the **only** values this skill may produce — never 0.75, never 1.5, never 4, never "5+".

   | Estimated Days | Select when the described change is |
   | -------------- | ----------------------------------- |
   | 0.25 | a one-line edit, a copy/text change, or a config/flag value change only |
   | 0.5 | confined to one file, adding no new interface (no new endpoint, screen, table, or public function) |
   | 1 | a few files inside one module, adding no new interface |
   | 2 | spread across several files in one module, or adding one endpoint, screen, or job |
   | 3 | spanning two or more modules, or changing an interface other code already calls |
   | 5 | crossing a service or repository boundary, or changing a database schema or data contract |

   **Tie-break**: when the description fits two rows, take the larger of the two. When the description is too vague to place at all, take 2.

   Consider these factors when choosing **between two adjacent rows** — they never produce a value outside the six above:
   - **Priority/severity**: Higher priority bugs often indicate complexity
   - **Keywords**: "refactor", "migrate", "redesign", "overhaul" suggest larger effort
   - **Scope words**: "all", "every", "entire", "complete" suggest larger scope
   - **Specificity**: Very specific tasks ("change button color") are smaller than vague ones ("improve performance")

3. **Save estimates back to Jira — only with `--write-estimates`**: By default the computed estimate is used in the report and nothing is written to Jira. When the user passed `--write-estimates`, save each computed estimate as the original estimate in hours:

   ```bash
   jira issue edit <ISSUE-KEY> --no-input -o "Original Estimate=<HOURS>h"
   ```

   Convert days to hours (multiply by 8). This makes subsequent runs use the saved estimate directly. Without the flag, skip this command entirely — the estimate stays local to the report and is recomputed next run.

## Step 5: Group Items into ~3-Day Blocks

Within each repository group, organize items into blocks of approximately 3 working days:

1. **Classify each item by delivery target** before grouping:
   - **Production deployment**: code changes, bug fixes, dependency updates, config changes that ship to production
   - **Staging/QA only**: features needing validation before production
   - **No deployment**: documentation, evaluations, reports, test strategy, planning, CI-only changes
2. **Never mix delivery targets in the same group**. Items that deploy to production must not be grouped with items that don't. This ensures each group has a clear, unambiguous delivery line.
3. **Sort items by estimated effort** (largest first) within each delivery target
4. **Create groups using bin-packing**:
   - If a single item is 3+ days, it becomes its own group
   - Otherwise, combine smaller items of the same delivery target until the group totals approximately 3 days (2.5 - 3.5 range is acceptable)
   - Don't split a single item across groups

## Step 6: Format the Report

Output the report in this exact format:

```text
**1. [<repo>] <One-sentence summary of all work in this group>**
   - <Brief description of item 1> [<ISSUE-KEY>](<SERVER_URL>/browse/<ISSUE-KEY>)
   - <Brief description of item 2> [<ISSUE-KEY>](<SERVER_URL>/browse/<ISSUE-KEY>)
   - Delivers: <delivery summary>

<br>

**2. [<repo>] <One-sentence summary of next group>**
   - <Brief description of item> [<ISSUE-KEY>](<SERVER_URL>/browse/<ISSUE-KEY>)
   - Delivers: <delivery summary>
```

### Formatting Rules

- Group titles are numbered sequentially starting at 1 across the entire report (not per repo)
- Bullets are indented (3 spaces) under the group title so they appear nested one level below the numbered heading
- No blank line between the group title and the first bullet
- Always insert a `<br>` on its own line after the last bullet of a group (the delivers line) and before the next group title to force visual separation
- Each group title is a bold line with the number and repo name: `**1. [repo] Summary sentence**`
- The repo name MUST appear on every group title, even when consecutive groups share the same repo
- Each item is a bullet point with a concise description (not the raw Jira summary — rephrase for clarity) followed by the Jira link
- The Jira link uses markdown format: `[ISSUE-KEY](https://server/browse/ISSUE-KEY)`
- If an item is a solo 3+ day group, still format it as a bullet under its summary
- The delivery summary is the last bullet in the group: `- Delivers: ...`
- Never use italic (`_text_`) or emphasis anywhere in the report — all text is plain

### Delivery Summary (last bullet of each group)

The last bullet of each group MUST start with one of these three prefixes — no exceptions:

1. `Production deployment` — for groups where code ships to production:
   - `- Delivers: Production deployment — fixes 3 critical bugs affecting API stability.`
   - `- Delivers: Production deployment — expanded Dependabot coverage and updated dependencies.`
2. `Staging only` — for groups where code deploys but not yet to production:
   - `- Delivers: Staging only — new moderation pipeline requires QA validation before production.`
3. `No deployment` — for groups with no code deployment (docs, evaluations, reports, CI, planning):
   - `- Delivers: No deployment — benchmark report with BI query accuracy metrics.`
   - `- Delivers: No deployment — CI caching and workflow improvements.`
   - `- Delivers: No deployment — evaluation report for open-source LLM alternatives.`
   - `- Delivers: No deployment — migration plan document. Blocked pending dependency upgrades.`

Never use vague descriptions like "CI improvements and security review" or "dependency updates and test strategy". Because items with different delivery targets are never grouped together (see Step 5), every group has exactly one delivery target.

Use the Jira item status (e.g., "In Code Review", "In Progress", "Done") and description to infer deployment readiness.

## Step 7: Present to User

1. Write the full report to `SPRINT.md` in the current directory
2. Also print the formatted report directly to the conversation
3. At the end, add a brief stats line:

   ```text
   Sprint: <sprint name> | <sprint working days> working days x 0.8 = <effective days> effective days per developer | <total items> items | ~<total estimated days> days of work | ~<FTE> full-time developers
   ```

   **Capacity**: `sprint working days` = Mon-Fri within `[sprint start, sprint end]` from Step 1. `effective days` = that count x 0.8 (developers are loaded at 80%). **FTE** = total estimated days / effective days, rounded to one decimal. Example: a 10-working-day sprint gives 8 effective days, so 53 days of work = ~6.6 full-time developers.

   If the sprint dates could not be resolved, fall back to 16 effective days and say so in the stats line: `... | 16 effective days per developer (sprint dates unavailable, 1-month sprint assumed) | ...`.

4. After the stats line, add a **per-person load breakdown** table. Sum the estimated days for all items assigned to each person and compare against the effective days capacity (the example below uses 16):

   ```text
   | Assignee | Est. Days | Load | Status |
   | -------- | --------- | ---- | ------ |
   | Alice    | 15.5      | 97%  | OK     |
   | Bob      | 20.0      | 125% | OVER   |
   | Charlie  | 10.0      | 63%  | UNDER  |
   | Unassigned | 8.0     | -    | -      |
   ```

   **Load calculation**: `(estimated days / effective days) x 100`, rounded to nearest percent — the same `effective days` used for the FTE line, never a hardcoded 16.

   **Status icons**:
   - `OK` (70%-100% load) — properly loaded
   - `OVER` (>100% load) — overloaded, at risk
   - `UNDER` (<70% load) — underloaded, has capacity

   List overloaded persons first, then OK, then underloaded. Unassigned items go last with no status.

5. After the load table, state on its own line how the computed estimates were handled, counting only the items that had no estimate in Jira:

   ```text
   Estimates: <N> items estimated, not written to Jira (re-run with --write-estimates to save them).
   ```

   When `--write-estimates` was passed, say so instead:

   ```text
   Estimates: <N> items estimated and saved to Jira as Original Estimate.
   ```

## Important Rules

- **Exclude stories**: Only include Tasks and Bugs (and any sub-types of these). Never include Stories or Epics.
- **Effort estimation**: Use existing Jira time estimates when present. Only estimate when no estimate exists, and emit one of the six values 0.25, 0.5, 1, 2, 3, 5 days — nothing between and nothing above.
- **Write scope**: The skill is read-only by default. The only modification it can ever make to Jira is saving time estimates on items that have none, and only when the user passed `--write-estimates`. Never create, delete, move, or change status of any Jira issues.
- **Timeout**: Set 15 second timeout on jira commands. If a command hangs, it may be misconfigured.
- **Link format**: Always use the server URL from the Jira config file, not a hardcoded URL.
- **Grouping flexibility**: The ~3-day target is approximate. Groups of 2-4 days are acceptable. Prefer logical grouping (related items together) over exact day counts when items are thematically related.
- **Plain descriptions**: Rephrase Jira summaries into clear, readable descriptions. Remove bracket prefixes, ticket-speak, and jargon.
