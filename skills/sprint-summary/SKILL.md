---
name: sprint-summary
description: Summarize sprint work items grouped by repo and ~3-day blocks. Use when the user wants a sprint summary, sprint report, sprint overview, work summary, sprint breakdown, or wants to see what work is planned in a sprint. Fetches tasks and bugs from Jira (excludes stories), estimates effort from descriptions, and groups items into approximately 3-day work blocks per repository.
allowed-tools: Bash(jira:*), Bash(git:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(echo:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(xargs:*), Read, Write, mcp__atlassian__searchJiraIssuesUsingJql, mcp__atlassian__getJiraIssue, mcp__atlassian__editJiraIssue, mcp__atlassian__addWorklogToJiraIssue
---

# Sprint Summary

Generate a sprint work summary grouped by repository with items organized into approximately 3-day work blocks.

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
   jira sprint list --state active --table --plain --no-headers --columns ID,NAME
   ```

   If multiple active sprints exist, ask the user which one to use.

2. **Extract the Jira server URL** for building browse links:

   ```bash
   grep '^server:' ~/.config/.jira/.config.yml | awk '{print $2}'
   ```

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

2. **If no estimate exists**: Read the summary and description and estimate the effort in working days using these heuristics:

   | Indicator | Estimated Days |
   | --------- | -------------- |
   | Trivial fix, typo, config change, simple toggle | 0.25 - 0.5 days |
   | Small bug fix, minor UI change, small refactor | 0.5 - 1 day |
   | Medium feature, moderate bug, API endpoint, integration | 1 - 2 days |
   | Large feature, complex bug, multi-component change | 2 - 3 days |
   | Very large task, architectural change, major feature | 3 - 5 days |
   | Epic-sized work, full system redesign | 5+ days |

   Consider these factors when estimating:
   - **Priority/severity**: Higher priority bugs often indicate complexity
   - **Keywords**: "refactor", "migrate", "redesign", "overhaul" suggest larger effort
   - **Scope words**: "all", "every", "entire", "complete" suggest larger scope
   - **Specificity**: Very specific tasks ("change button color") are smaller than vague ones ("improve performance")

3. **Save AI estimates back to Jira**: For items where the estimate was AI-generated, save it to Jira as the original estimate in hours:

   ```bash
   jira issue edit <ISSUE-KEY> --no-input -o "Original Estimate=<HOURS>h"
   ```

   Convert days to hours (multiply by 8). This ensures subsequent runs use the saved estimate directly.

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
   Sprint: <sprint name> | <total items> items | ~<total estimated days> days of work | ~<FTE> full-time developers
   ```

   **FTE calculation**: Assume a 1-month sprint with developers loaded at 80%. That gives 20 working days x 0.8 = 16 effective days per developer. Divide total estimated days by 16 and round to one decimal. Example: 106 days / 16 = ~6.6 full-time developers.

4. After the stats line, add a **per-person load breakdown** table. Sum the estimated days for all items assigned to each person and compare against the 16 effective days capacity:

   ```text
   | Assignee | Est. Days | Load | Status |
   | -------- | --------- | ---- | ------ |
   | Alice    | 15.5      | 97%  | OK     |
   | Bob      | 20.0      | 125% | OVER   |
   | Charlie  | 10.0      | 63%  | UNDER  |
   | Unassigned | 8.0     | -    | -      |
   ```

   **Load calculation**: `(estimated days / 16) x 100`, rounded to nearest percent.

   **Status icons**:
   - `OK` (70%-100% load) — properly loaded
   - `OVER` (>100% load) — overloaded, at risk
   - `UNDER` (<70% load) — underloaded, has capacity

   List overloaded persons first, then OK, then underloaded. Unassigned items go last with no status.

## Important Rules

- **Exclude stories**: Only include Tasks and Bugs (and any sub-types of these). Never include Stories or Epics.
- **Effort estimation**: Use existing Jira time estimates when present. Only AI-estimate when no estimate exists, and save the AI estimate back to Jira.
- **Write scope**: The only modification this skill makes to Jira is saving time estimates on items that have none. Never create, delete, move, or change status of any Jira issues.
- **Timeout**: Set 15 second timeout on jira commands. If a command hangs, it may be misconfigured.
- **Link format**: Always use the server URL from the Jira config file, not a hardcoded URL.
- **Grouping flexibility**: The ~3-day target is approximate. Groups of 2-4 days are acceptable. Prefer logical grouping (related items together) over exact day counts when items are thematically related.
- **Plain descriptions**: Rephrase Jira summaries into clear, readable descriptions. Remove bracket prefixes, ticket-speak, and jargon.
