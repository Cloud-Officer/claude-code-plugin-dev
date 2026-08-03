---
name: doc-tracker-coverage
description: Verify that every item (and its sub-tasks) listed in a section of a Google Doc has a matching equivalent in monday.com and/or Jira, per team. Reads a planning/roadmap doc as the source of truth, resolves each team to its tracker(s) (Monday board(s) and/or Jira project(s), confirmed once and cached), fuzzy-matches doc items to tracker items, and writes a read-only coverage report listing matched / missing / ambiguous items with a best-effort sub-task ratio. Use when the user wants to check a Google Doc against Monday/Jira, confirm a roadmap or plan is tracked, audit tracker coverage of a doc, find untracked items, reconcile a planning doc with the trackers, or verify items exist in Monday and/or Jira for each team. The downstream weekly-dev-report (Jira) and monday-weekly-report (Monday) then track the matched items. Writes COVERAGE_REPORT.md and prints to stdout.
allowed-tools: AskUserQuestion, Read, Write, WebFetch, mcp__monday__get_board_schema, mcp__monday__get_board_items_by_name, mcp__monday__list_users_and_teams, mcp__monday__all_monday_api, mcp__monday__get_graphql_schema, mcp__monday__get_type_details, mcp__atlassian__searchJiraIssuesUsingJql, mcp__atlassian__getJiraIssue, mcp__claude_ai_Google_Drive__authenticate, mcp__claude_ai_Google_Drive__complete_authentication, Bash(jira issue list:*), Bash(jira project list:*), Bash(curl:*), Bash(jq:*), Bash(echo:*), Bash(printf:*), Bash(mkdir:*), Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(grep:*), Bash(sed:*), Bash(tr:*), Bash(sort:*), Bash(uniq:*)
---

# Doc → Tracker Coverage

Read a **section of a Google Doc** (a planning / roadmap / scope doc) as the **source of truth** and verify that every item it lists — and, best-effort, each item's sub-tasks — has a matching equivalent in **monday.com and/or Jira**, resolved **per team**. Produce a read-only **coverage report** (`COVERAGE_REPORT.md`) that lists, per team, which doc items are *matched*, *missing*, or *ambiguous*, with a sub-task coverage ratio for each matched item. The downstream `weekly-dev-report` (Jira) and `monday-weekly-report` (monday.com) then track the matched items.

This skill is **read-only**. It never creates, edits, moves, or deletes anything in Google Docs, monday.com, or Jira. When it finds a gap, it **reports** it — creating the missing tracker item is a manual follow-up for the user.

## Arguments

Parse arguments from the user's invocation:

- `--doc <url|id>` — the Google Doc to read (full URL or document ID). If omitted, ask the user for it (Step 1).
- `--section <heading>` — the heading whose content to verify (matched case-insensitively). The skill extracts everything under that heading down to the next heading of the same or higher level. If omitted, list the doc's top-level headings and ask which section (Step 1).
- `--team <name>` — restrict the run to one team (repeatable). When omitted, every team found in the section is processed.
- `--tracker <monday|jira|both>` — override the per-team tracker resolution for **all** teams this run (rare; normally each team's tracker(s) come from the cache / interactive confirmation in Step 3).
- `--reconfirm-teams` — ignore the cached team→tracker mapping and re-prompt for every team (Step 3).
- `--threshold <0..1>` — minimum normalized match score to count a doc item as *matched* (default `0.82`). Scores between this and `0.6` are reported as *ambiguous* (needs a human to confirm); below `0.6` is *missing*.

This skill has **no `--send` / email mode** — it writes `COVERAGE_REPORT.md` and prints it. It is a verification pass, not a recurring stakeholder email.

## What "covered" means (the rules, decided for this skill)

- **Per-team mix.** Each team is tracked in monday.com, Jira, or **both**. A team's tracker set is resolved once and cached (Step 3). A doc item is *matched* for that team if it has an equivalent in **any** of the team's configured trackers (monday OR jira when the team uses both — the item need not exist in both unless the user says so via notes).
- **Parent required; sub-tasks best-effort.** The top-level doc item **must** have a tracker equivalent to count as *matched*. Sub-tasks do **not** hard-fail coverage: report the sub-task match as a **ratio** (e.g. `3/5 sub-tasks tracked`) and list which sub-tasks are missing, but a matched parent with unmatched sub-tasks is still *matched (partial sub-tasks)*, not *missing*.
- **Read-only gap report.** Missing and ambiguous items are surfaced for the user to act on. The skill never creates the missing items.

## Authentication & data sources

Three independent sources. Resolve each at the start; if one is unavailable, degrade and disclose rather than abort the whole run.

### Google Doc (source of truth)

There is **no single guaranteed** Docs tool — discover the read path at runtime in this order, use the first that works, and record which one supplied the content:

1. **A Google Workspace Docs MCP tool** — discover via the tool list any tool whose name matches `mcp__*docs*get*`, `mcp__*workspace*docs*`, or `mcp__*drive*` (the optional `workspace-mcp` server). Prefer a "get document" tool; pass the document ID. This returns the structured doc (headings + nested lists) — the richest input.
2. **The `claude.ai Google Drive` MCP** — if `mcp__claude_ai_Google_Drive__*` tools are present but only `authenticate` / `complete_authentication` are exposed, the server is not yet authorized: call `mcp__claude_ai_Google_Drive__authenticate`, give the user the returned URL, and on their callback URL call `mcp__claude_ai_Google_Drive__complete_authentication`. After authorization the server's real read tools appear — use them to fetch the document.
3. **`WebFetch`** — only works for a doc the user has made link-readable or **published to the web** (`File → Share → Publish to web`, or a `/export?format=txt` / `?format=html` link). WebFetch fails on private docs (it has no credentials); do not retry it on a 401/403.
4. **Ask the user to paste** the section text directly into the chat as the last resort. Note in the report header that the source was a manual paste (structure may be lower-fidelity).

The Workspace Docs MCP read tools (path 1) and the `claude.ai Google Drive` read tools that appear after authorization (path 2) are **discovered at runtime** and so cannot be pre-listed in `allowed-tools` — expect a one-time permission prompt the first time one is called. Only `WebFetch` and the two `claude_ai_Google_Drive` auth tools are pre-granted.

Extract the **document ID** from a URL like `https://docs.google.com/document/d/<DOC_ID>/edit` (the path segment after `/d/`).

### monday.com (hosted MCP)

Uses the **monday MCP server only** — no CLI fallback. It is **not bundled**; it is registered **per folder** with `claude mcp add` (local scope):

```bash
export MONDAY_TOKEN="your_monday_api_token"   # avatar → Developers → My access tokens
claude mcp add monday --transport http https://mcp.monday.com/mcp --header 'Authorization: Bearer ${MONDAY_TOKEN}'
```

If `mcp__monday__*` tools are absent (tool-not-found), the server is not added or `MONDAY_TOKEN` is unset. Only fail the **monday side** of teams configured for monday — disclose it in the report ("monday unavailable — monday-tracked teams not verified") and still verify the Jira side. The write-capable monday tools are **excluded from `allowed-tools`**. `all_monday_api` *is* granted — board enumeration and bulk item paging need it — and it is a general GraphQL passthrough that *could* mutate, so read-only on that one tool is a **prompt-level rule, not a configuration guarantee**: **only ever issue read queries through it** (`query { … }`, never `mutation`).

### Jira (MCP first, curl/CLI fallback) — run from the target repo's directory (direnv)

Prefer `mcp__atlassian__*`. On tool-not-found or repeated error, fall back to the `jira` CLI / `curl`. The CLI / `curl` paths authenticate with `JIRA_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN`, which [direnv](https://direnv.net/) loads from the **current working directory**'s `.envrc`. Before any `jira` / `curl` Jira call, make the target repo the working directory **in its own Bash call** (direnv reloads on the next prompt — a `cd … && curl …` on one line still uses the old token):

```bash
cd /path/to/target-repo        # separate call; never chain `cd … && curl …`
```

MCP tools captured their credentials at startup and are unaffected by the working directory. If both MCP and curl fail for a Jira-configured team, disclose it and verify only that team's monday side.

| Operation | MCP tool | CLI / curl fallback |
| --- | --- | --- |
| Search issues by text in a project | `mcp__atlassian__searchJiraIssuesUsingJql` (`project = <KEY> AND text ~ "<terms>"`) | `jira issue list -p<KEY> -q'text ~ "<terms>"' --plain --no-headers` |
| Get an issue + sub-tasks | `mcp__atlassian__getJiraIssue` (request `subtasks` field) | `curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/issue/<KEY>?fields=summary,subtasks"` |

## Step 1: Resolve the doc and the section

1. **Doc:** from `--doc`, or ask. Extract the document ID.
2. **Fetch** the document via the source ladder above.
3. **Section:** if `--section` was given, locate that heading (case-insensitive, trimmed); else list the doc's top-level headings and ask the user which section with AskUserQuestion (`header` = `Section`, `multiSelect: false`). Extract the content from that heading down to the next heading of equal-or-higher level.
4. Record `doc_title`, `doc_id`, `section_heading`, and which **source** supplied the content (for the report header).

## Step 2: Parse the section into teams → items → sub-tasks

The section is the source of truth. Parse it into a structured plan. **Detect the structure rather than assuming one** — confirm once if ambiguous:

- **Teams** are usually sub-headings within the section, a bold lead-in line, or a column/cell label. If the section has no obvious team grouping, treat it as a **single implicit team** and ask the user for that team's name (it still needs a team → tracker mapping in Step 3).
- **Items** are the top-level list entries (bullets, numbers, or table rows) under a team.
- **Sub-tasks** are the nested entries beneath an item (indented bullets, a checklist, or a "sub:"/"- [ ]" convention). Capture them but treat them as best-effort (the coverage rule above).

Normalize each item/sub-task **title** for matching: strip leading list markers / checkboxes (`-`, `*`, `[ ]`, `[x]`, `1.`), trailing owner/date annotations in parentheses or after `—`, collapse whitespace, lowercase. Keep the **original** text too (the report shows the original).

If the parse is ambiguous (e.g. it's unclear whether a level is a team, an item, or a sub-task), show the user your interpreted outline (teams → item counts) **once** via a short AskUserQuestion confirmation before proceeding. Never silently guess a structure that changes the counts.

Record per item: `team`, `title` (original), `norm_title`, `subtasks[]` (each with original + norm). De-duplicate identical items within a team.

## Step 3: Resolve each team → tracker(s) (cached, confirm once)

Every team maps to a **tracker set**: zero or more monday boards and zero or more Jira projects. Confirm once per team, cache, reuse.

**Load the team cache** (JSON, keyed by lowercased team name): `${DOC_TRACKER_COVERAGE_TEAMS:-$HOME/.config/doc-tracker-coverage/teams.json}`. Read with the Read tool (missing → `{}`). Each entry:

```json
{ "platform": { "monday_boards": ["1234567890"], "jira_projects": ["PLAT"], "confirmedAt": "2026-06-19" } }
```

**Decide who to prompt:** a team needs confirmation if it is not in the cache, OR `--reconfirm-teams` was passed. `--tracker` overrides the *kind* of tracker for all teams this run but you still need the concrete board IDs / project keys.

**Auto-propose** before prompting so the human usually just confirms:

- **monday:** if `all_monday_api` is available, enumerate boards (`query { boards(limit: 100) { id name } }`) and propose the board whose name best matches the team name (normalized). Otherwise the skill cannot list boards — ask the user to type the board ID(s).
- **Jira:** list projects (`mcp__atlassian__searchJiraIssuesUsingJql` can't list projects directly — use `curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/project/search" | jq '.values[] | {key,name}'`, or `jira project list`) and propose the project whose key/name best matches the team. If only the Atlassian MCP is available (it captured credentials at startup) and the Jira env vars are unset, the skill cannot enumerate projects this way — ask the user to type the project key(s) directly, the same graceful fallback as the monday board case above. Matching in Steps 4–5 still works via the MCP once the key is known.

**Prompt (interactive runs):** for each team needing confirmation, use AskUserQuestion (`header` = team name ≤ 12 chars). Ask which tracker(s) the team uses — offer **monday**, **Jira**, **Both**, and **Skip (not tracked)** — with the auto-proposed match named in the option description. Then confirm the specific board ID(s) / project key(s) (accept the proposed default, or the user types the correct ones). Batch ≤ 4 teams per call and **loop** until every unconfirmed team is resolved.

**Persist** the confirmed mapping back to `teams.json` (`mkdir -p` the parent dir first), stamping `confirmedAt`. A team mapped to **Skip** is recorded and excluded from verification (listed in the report as *not tracked — skipped*).

**Non-interactive fallback:** if there is no TTY and a team is uncached, use the auto-proposed mapping, mark it `auto: true`, and disclose in the header how many teams used an auto-proposed mapping.

## Step 4: Pull candidate tracker items per team

For each team (skipping `Skip` teams), fetch the candidate item set from its configured trackers:

- **monday** — for each board: pull all items (`id`, `name`, plus subitems `id`/`name`) via `all_monday_api` `items_page` when the dynamic API is available (page until `cursor` is null; verify the unique-id count against `items_count`). When the dynamic API is off, fall back to `get_board_items_by_name` querying each doc item's key terms (narrower — note the limited coverage in the report). Resolve the board's subitems column from `get_board_schema` so sub-task names come back.
- **Jira** — for each project: search issues with a text query built from the doc item terms (`project = <KEY> AND text ~ "<terms>"`), and for promising hits fetch `subtasks` to get sub-task summaries. Prefer a broader pull (e.g. all open + recently-closed issues in the project) when the project is small, so matching isn't limited to one search phrase.

Build, per team, a flat candidate list of `{ tracker, id, name, norm_name, subtasks:[{id,name,norm}] }`.

## Step 5: Match doc items to tracker items

For each doc item in a team, score it against that team's candidate tracker items and pick the best:

- **Normalized exact match** (norm_title == norm_name) → score `1.0`.
- **Containment** (one normalized string contains the other) → `0.9`.
- **Token overlap** — Jaccard / Dice over the normalized word sets, ignoring stopwords and list noise → the overlap ratio. (A short, generic title like "Testing" needs a higher bar — require ≥ 2 shared significant tokens, not just one, before trusting a token-overlap match.)

Classify each item by its best score against `--threshold` (default `0.82`):

- `score ≥ threshold` → **matched**. Record the matching tracker item (tracker + id + name).
- `0.6 ≤ score < threshold` → **ambiguous** — record the top 1–2 candidates so a human can confirm or reject. Never silently treat ambiguous as matched.
- `score < 0.6` → **missing** — no equivalent found.

For a **matched** item, compute the **sub-task ratio**: for each doc sub-task, match it (same scoring) against the matched tracker item's sub-tasks; `tracked = count(matched sub-tasks)`, ratio `tracked / total`. List the unmatched sub-task titles. A matched parent with `tracked < total` is **matched (partial sub-tasks)** — still matched, not missing.

For a team configured for **both** trackers: a parent counts as matched if it matches in **either** tracker. If it matches in one but not the other, note `tracked in monday, absent in Jira` (or vice-versa) so the user can decide whether parity matters — but do not downgrade it to missing.

## Step 6: Render the coverage report

Write `COVERAGE_REPORT.md` to the current directory and print the same content. Every tracker item is rendered with its **name and ID**. Format:

````markdown
# Doc → Tracker Coverage

**Source doc:** <doc_title> (id <doc_id>) — section "<section_heading>" <br>
**Doc source:** <Workspace Docs MCP | claude.ai Drive | WebFetch (published) | manual paste> <br>
**Teams:** <team A>, <team B> (<N> tracked, <M> skipped) <br>
**Trackers:** monday <available|unavailable>, Jira <available|unavailable> <br>
**Match threshold:** <0.82> (ambiguous band 0.60–0.82) <br>
**Generated:** <YYYY-MM-DD>

<Two-sentence summary: overall coverage %, and the single biggest gap (which team / how many missing).>

## Coverage at a glance

| Team | Tracker(s) | Items | Matched | Ambiguous | Missing | Sub-task coverage |
| --- | --- | ---:| ---:| ---:| ---:| --- |
| Platform | monday + Jira | 12 | 9 | 1 | 2 | 28/40 sub-tasks |
| Growth | Jira | 6 | 6 | 0 | 0 | 11/11 sub-tasks |
| **All teams** | — | 18 | 15 | 1 | 2 | 39/51 |

`Coverage % = matched / (items − skipped)`. Ambiguous and missing are **not** counted as covered.

## ❌ Missing — no tracker equivalent

Grouped by team. These doc items have no match and are the action list.

### Platform (monday + Jira)
- **Implement SSO token refresh** — no match in board *Platform* (id 1234567890) or project PLAT. _Action: create it in the team's tracker._
- **Audit log retention policy** — no match. _Action: …_

## ⚠️ Ambiguous — needs human confirmation

| Doc item | Team | Best candidate (tracker, id) | Score | Confirm? |
| --- | --- | --- | ---:| --- |
| **Rate limiting** | Platform | "API rate limits" (monday, id 998877) | 0.71 | Same work? |

## ✅ Matched

Grouped by team. Parents with incomplete sub-tasks show the ratio and the missing sub-tasks.

### Platform (monday + Jira)
- **Implement SSO token refresh** ✓ → "SSO token refresh" (Jira PLAT-214) — **5/5 sub-tasks**
- **Billing webhooks** ✓ → "Billing webhooks v2" (monday, id 776655) — **2/4 sub-tasks** <br>
  missing sub-tasks: _retry queue_, _dead-letter alerting_
- **Search reindex** ✓ → "Search reindex" (Jira PLAT-230) — tracked in Jira, **absent in monday** (team uses both)

## ⏭️ Skipped teams (not tracked)

- **Design** — mapped to *Skip* in the team cache. Re-include with `--reconfirm-teams`.
````

Rendering rules:

- Every tracker item shows **name and ID** (monday `id <N>`, Jira issue key). Doc items show their **original** text, not the normalized form.
- Omit a section that is empty (e.g. no ambiguous items → drop the ⚠️ section), except keep **❌ Missing** with an explicit "none — full coverage 🎉" line when there are no gaps.
- Escape pipes (`|`) in table cells. Dates `YYYY-MM-DD`, local time.
- Never print `MONDAY_TOKEN`, `JIRA_API_TOKEN`, OAuth URLs/codes, raw GraphQL/JQL, or other debug output into the report.
- If a tracker was unavailable, the teams it would have covered are marked *unverified (tracker unavailable)* rather than *missing* — absence of data is not absence of the item.

## Caches

Under `~/.config/doc-tracker-coverage/` (override via `DOC_TRACKER_COVERAGE_TEAMS`). Create with `mkdir -p` before writing. Read with the Read tool, treating a missing file as empty.

- `teams.json` — `team (lowercased) → { monday_boards:[], jira_projects:[], confirmedAt, auto? }`. `Skip` teams are stored with empty arrays and a `skip: true` flag.

## Important rules

- **Read-only, everywhere.** Never write to Google Docs, monday.com, or Jira. Missing items are **reported**, never created — and never call write-capable monday tools or Jira mutations. Verifying coverage must not change the trackers it is auditing.
- **The doc is the source of truth.** Coverage is measured as "does the tracker contain what the doc lists" — not the reverse. Extra tracker items that aren't in the doc are **not** flagged (out of scope); only doc items drive the report.
- **Parent required, sub-tasks best-effort.** A doc item is matched only if its top-level entry has a tracker equivalent. Sub-tasks are reported as a ratio with the missing ones named, but never downgrade a matched parent to *missing* over sub-tasks.
- **Per-team tracker resolution, confirmed once and cached.** Each team uses monday, Jira, both, or Skip. Resolve interactively the first time (proposing the best-matching board/project), then reuse the cache; re-prompt only for new teams or with `--reconfirm-teams`.
- **Ambiguous ≠ matched.** Only count an item as covered when the match score clears the threshold. Mid-confidence matches go in the ⚠️ section for a human to confirm — never inflate coverage by accepting weak matches.
- **Degrade and disclose.** If a tracker (or the doc source) is unavailable, verify what you can, mark the rest *unverified*, and state it in the header — never abort the whole run, and never report *missing* for a team whose tracker you couldn't reach.
- **Hands off to the weekly reports.** This skill confirms coverage; it does not track progress. Once items are matched, `weekly-dev-report` (Jira) and `monday-weekly-report` (monday) report on their movement.
- **Env vars referenced** (note at the top of output if any needed one is unset):
  - `MONDAY_TOKEN` — required for monday-tracked teams (hosted MCP)
  - `JIRA_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` — required for the Jira curl/CLI fallback
  - `DOC_TRACKER_COVERAGE_TEAMS` — optional team-cache path override
