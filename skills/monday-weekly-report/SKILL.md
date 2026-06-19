---
name: monday-weekly-report
description: Generate a weekly project-status report from one or more monday.com boards — general project tracking, not engineering throughput. Covers per-board health, owner activity (role-aware), items moved this week, overdue and due-soon work, stuck/blocked and stale items, upcoming milestones, and a date-driven delivery-risk assessment with a concrete catch-up plan. Role-aware (owner / contributor / stakeholder / external / other, confirmed once and cached) and runs against a past-full-week or week-to-date window so it can be run any day. Use when the user wants a weekly project report, project status report, monday board status, project health check, delivery-risk assessment, or stakeholder update from monday.com. Writes PROJECT_REPORT.md and prints to stdout; emails on --send.
allowed-tools: mcp__monday__get_board_schema, mcp__monday__get_board_items_by_name, mcp__monday__list_users_and_teams, mcp__monday__all_monday_api, mcp__monday__get_graphql_schema, mcp__monday__get_type_details, AskUserQuestion, Read, Write, Bash(jq:*), Bash(echo:*), Bash(mkdir:*), Bash(date:*), Bash(printf:*), Bash(ls:*), Bash(cat:*)
---

# Weekly Project Report (monday.com)

Generate a weekly project-status report for one or more monday.com boards. This is **general project tracking** — owners, statuses, due dates, and milestones — **not** engineering throughput, so keep all language generic ("owner", "contributor", "item") and never assume a board is a software project. The report includes a **date-driven delivery-risk assessment with a concrete catch-up plan**, per-board health rollups, **role-aware** owner activity (each owner's role is confirmed once and cached), items moved this week, overdue / due-soon work, stuck / stale items, and upcoming milestones. Writes `PROJECT_REPORT.md` to the current directory, prints to stdout, and on `--send` delivers via email.

This skill is **read-only**. It never creates, edits, moves, or deletes monday boards, items, columns, groups, or updates.

## Arguments

Parse arguments from the user's invocation:

- `--dry-run` (default) — write `PROJECT_REPORT.md` and print to stdout. Do not send email.
- `--send` — after generating, email the report. Primary recipient comes from env var `MONDAY_WEEKLY_REPORT_TO` (required when `--send` is used); additional recipients from `MONDAY_WEEKLY_REPORT_CC` (comma-separated, may be empty/unset). If `MONDAY_WEEKLY_REPORT_TO` is unset, abort and ask the user to set it.
- `--window <past|current>` — choose the weekly window. `past` (default) = the **previous completed** Mon→Sun (a fixed 7-day week; stable for scheduled emails). `current` = **week-to-date**: this week's Monday through today (a partial week, fewer than 7 days unless run on Sunday) so the report can be run any day. When omitted in an interactive preview, the skill asks (Step 1). A `--send` / non-interactive run defaults to `past`.
- `--week-offset N` — run for N weeks ago (0 = the week described by `--window`, 1 = the week before, default 0).
- `--board <id|name>` — board to include. Repeatable. When omitted, resolve boards via cache, then env var, then interactive prompt (Step 2).
- `--reconfirm-boards` — ignore the cached board set and re-resolve / re-prompt for which boards to include (Step 2).
- `--reconfirm-roles` — force the interactive role prompt for **every** owner, ignoring the cache (Step 4).
- `--reconfirm-statuses` — force the interactive status-mapping prompt for **every** board, ignoring the cache (Step 3.5).

If the user did not pass `--send`, treat the run as a preview. Never send email unless `--send` is present. Interactive prompts (window, board pick, roles, status mapping) only happen in a preview/interactive run — a `--send` run never prompts and instead falls back to cached values plus auto-detected defaults.

## Authentication (monday hosted MCP)

This skill uses the **monday MCP server only** — there is no monday CLI fallback. The server is **not bundled** in the plugin's `.mcp.json`; it is registered **per folder** with `claude mcp add` (local scope):

```bash
export MONDAY_TOKEN="your_monday_api_token"   # avatar → Developers → My access tokens
claude mcp add monday --transport http https://mcp.monday.com/mcp --header 'Authorization: Bearer ${MONDAY_TOKEN}'
```

All tool calls execute as that user and are subject to their monday.com permissions. **If `mcp__monday__*` tools are not available** (tool-not-found errors), the server has not been added or `MONDAY_TOKEN` is unset — inform the user, point them at the `claude mcp add` command above, and stop. Do not attempt any other data source.

## MCP tools and the snapshot-vs-activity-log split

This skill calls **read tools only**. The write-capable monday tools (`create_*`, `change_item_column_values`, `move_item_to_group`, `delete_*`, `create_update`) are deliberately **excluded from `allowed-tools`** so the read-only guarantee is enforced by configuration, not just prose. `all_monday_api` is a general GraphQL passthrough that *could* mutate — **only ever issue read queries through it** (`query { … }`, never `mutation`).

| Operation | Tool | Notes |
| --- | --- | --- |
| Get board schema (columns + groups) | `mcp__monday__get_board_schema` | Discover status / people / date column IDs — never guess them. Available in every setup. |
| Targeted item lookup by name | `mcp__monday__get_board_items_by_name` | Returns matching items with column values. Used for narrow lookups; **not** a full-board dump. |
| List users and teams | `mcp__monday__list_users_and_teams` | Resolve `user_id` → owner display names. |
| Full GraphQL — board list, bulk items, activity logs | `mcp__monday__all_monday_api` (+ `get_graphql_schema`, `get_type_details`) | **Dynamic API — may be disabled.** Present only if the server was started with `--enable-dynamic-api-tools true`. This is the backbone for enumerating boards, paging all items on a board, and reading activity logs. |

**Read paths (which tool supplies what):**

- **Board enumeration** (Step 2, interactive pick) — query `all_monday_api` (`query { boards(limit: N) { id name } }`) when the dynamic API is available. When it is **not**, the skill cannot list boards itself — ask the user to name or ID the boards (or set `MONDAY_WEEKLY_REPORT_BOARDS` / pass `--board`).
- **Bulk item pull** (Step 5) — page all items on a board via `all_monday_api` (`items_page`) when available. When the dynamic API is off, fall back to `get_board_items_by_name` for the specific items/groups of interest and note in the header that coverage is limited to looked-up items.

**Attribution mode (hybrid — decided for this skill):**

- **Activity-log mode** — when `all_monday_api` is available, read the board **activity log** for precise "who moved which item to which status during the week":

  ```graphql
  query { boards(ids: [<BOARD_ID>]) {
    activity_logs(from: "<WEEK_START_ISO>", to: "<WEEK_END_ISO>") {
      user_id event data created_at
    }
  } }
  ```

  Status-change events carry the column id, previous and new label, and `user_id` — the monday analog of "transition BY user DURING". Resolve `user_id` via `list_users_and_teams`.

- **Snapshot mode (fallback)** — when the dynamic API (and thus `activity_logs`) is unavailable, derive weekly movement from each item's `updated_at` and its latest updates/comments: an item counts as "touched this week" if `updated_at` falls in the window. Coarser — you know it changed, not exactly what or by whom (attribute to the current owner).

**State the active attribution mode in the report header** (e.g. `Attribution: snapshot (updated_at) — board activity log unavailable`). Always try activity-log mode first, fall back silently to snapshot mode, and disclose it. For the richest report, recommend the user enable the dynamic API tools. Never block the report because the dynamic API is off — degrade and disclose.

## Step 1: Resolve the weekly window

Reuse the dev-report window logic.

1. **Determine the mode** (`past` or `current`):
   - If `--window` was passed, honor it.
   - Else if this is a non-interactive / `--send` run, use `past`.
   - Else (interactive preview) **and** today is mid-week (not the end of a completed week), **ask the user** with AskUserQuestion — one question, `multiSelect: false`, header `Window`:
     - Question: "This week is still in progress — which weekly window do you want?"
     - Option A (first, default): **Past full week (Mon–Sun)** — the last completed 7-day week.
     - Option B: **Week-to-date (this Mon → today)** — partial current week; lets you run the report any day.
   - If today is Sunday end-of-day the two windows coincide; skip the prompt and use `past`.

2. **Compute the raw window:**
   - **`past`:** `week_end = most recent past Sunday 23:59 local` (if today is Sunday, use today − 7 days); `week_start = week_end − 6 days at 00:00 local`.
   - **`current`:** `week_start = this week's Monday 00:00 local`; `week_end = today 23:59 local` (now). Partial — fewer than 7 days, possibly only 1–4 working days.
   - Apply `--week-offset N` to either mode by subtracting `7*N` days from both bounds.
   - Record `window_mode` and a human label for the header. ISO-format `week_start` / `week_end` for the activity-log query.

3. **Partial-week handling (`current` mode only):** today is in progress — exclude it from any "per-day" rate and from stale/overdue *new-today* penalties. If completed working days < 2 (a Monday/Tuesday run), mark per-day figures **provisional** in the header. Stuck/stale/overdue detection uses trailing-N-days or due-date comparisons and is unaffected by the window mode.

## Step 2: Select boards

Boards are the lens (the monday analog of a Jira sprint). Resolve the set in this precedence:

1. `--board <id|name>` arguments (repeatable) — if present, use exactly these.
2. Cached board set in `boards.json` (Step "Caches") — reuse unless `--reconfirm-boards` was passed.
3. Env var `MONDAY_WEEKLY_REPORT_BOARDS` — comma-separated board IDs or names.
4. Otherwise, **interactive prompt** (preview runs only):
   - If `all_monday_api` is available, enumerate boards (`query { boards(limit: 100) { id name } }`) and ask which to include with AskUserQuestion (`multiSelect: true`, header `Boards`).
   - If the dynamic API is **not** available, the skill cannot list boards — ask the user to type the board IDs or names directly (and suggest setting `MONDAY_WEEKLY_REPORT_BOARDS` so future runs don't re-ask).
   - Cache the chosen set to `boards.json`.

Resolve each name to a numeric board ID (via the `boards` query when available, else `get_board_schema`/`get_board_items_by_name` confirmation). If a name is ambiguous (multiple matches), ask the user to disambiguate by ID. Support **multiple boards** — every section is computed per board and rolled up across boards in the at-a-glance view.

For a non-interactive `--send` run with no `--board`, no cache, and no `MONDAY_WEEKLY_REPORT_BOARDS`, abort with a message asking the user to set `MONDAY_WEEKLY_REPORT_BOARDS` or pass `--board`.

## Step 3: Discover each board's schema

For every selected board, call `get_board_schema` and locate, by **type** (not by guessing IDs):

- **status column(s)** (`type: status`/`color`) — the primary progress signal. A board may have more than one; pick the one whose labels look like a workflow (contains a Done-like and an In-progress-like label). If two are equally plausible, ask the user once which is the tracking status (cache it with the status mapping, Step 3.5).
- **people / owner column** (`type: people`) — who owns the item.
- **date / timeline column** (`type: date` or `type: timeline`) — the due-date signal that drives delivery risk. Prefer a timeline (start+end) if present; else the date column. A board may legitimately have none.
- **groups** — top-level groupings (often phases / workstreams / priorities); used for the per-group health rollup.
- **dependency column** (`type: dependency`, optional) — if present, captures item-to-item dependencies; enables the dependency-aware risk and "re-sequence" recommendations. Skip those clauses entirely when no dependency column exists.

Record per board: `board_id`, `board_name`, `status_col_id`, `people_col_id`, `date_col_id` (or null), `dependency_col_id` (or null), and the group list. If a board has **no date column**, note it — its delivery-risk subsection will render "*no date column — risk not assessed*" rather than aborting.

## Step 3.5: Confirm status mapping per board (cached)

monday status labels are board-specific ("Working on it", "Stuck", "Done", "Waiting for review", "Won't do", …). The report needs to know which labels mean what. Confirm once per board and cache.

**Buckets** to map every status label into:

| Bucket | Meaning |
| --- | --- |
| `done` | terminal / complete (e.g. Done, Closed, Shipped, Approved) |
| `in_progress` | actively being worked (e.g. Working on it, In progress, In review) |
| `stuck` | blocked / needs attention (e.g. Stuck, Blocked, Waiting) |
| `not_started` | queued / not begun (e.g. Not started, Backlog, To do, empty) |
| `cancelled` | dropped, excluded from completion math (e.g. Won't do, Cancelled, Duplicate) |

**Auto-detect defaults** from label text and monday's default green/orange/red/grey colors: green or "done/closed/complete/shipped/approved" → `done`; red or "stuck/blocked/waiting/on hold" → `stuck`; orange/yellow or "working/progress/review/doing" → `in_progress`; grey/empty or "not started/backlog/to do/new" → `not_started`; "won't/cancel/duplicate/reject" → `cancelled`.

**Load the status cache** (JSON, keyed by `board_id`): `${MONDAY_WEEKLY_REPORT_STATUSES:-$HOME/.config/monday-weekly-report/statuses.json}`. Read with the Read tool (treat a missing file as `{}`).

**Decide who to prompt:** a board needs confirmation if it is not in the cache, OR `--reconfirm-statuses` was passed. If interactive and confirmation is needed, use AskUserQuestion — one question per ambiguous label (batch ≤ 4 per call), `header` = the label (≤ 12 chars), options = the five buckets with the auto-detected default listed first and " (detected)" appended. Labels whose auto-detection is unambiguous (exact "Done"/"Stuck"/"Not Started") can be accepted without prompting; only prompt for the uncertain ones.

**Persist** the confirmed mapping back to the status cache (`mkdir -p` the parent dir first). **Non-interactive / `--send` runs never prompt** — use the cache if present, else auto-detection, and note in the header how many boards used auto-detected mappings.

## Step 4: Confirm owner roles (cached)

Every owner (person appearing in the people column across the selected boards) has a **role** that determines how they are tracked. Confirm once, cache, reuse — including on headless `--send` runs.

### Role catalog

| Role | Key | Tracked on | Behavior |
| --- | --- | --- | --- |
| Owner / Lead | `owner` | full activity + on-time delivery of their items | accountable; flagged when their items slip or stall |
| Contributor | `contributor` | activity + their items' movement | does the work; tracked |
| Stakeholder / Sponsor | `stakeholder` | not rated on throughput (shows `—`) | manager/exec; only flagged when an item they own is blocking others |
| External / Vendor | `external` | relaxed expectations; not penalized for low weekly movement | part-time / outside the org |
| Other (do-not-track) | `other` | not rated (shows `—`); excluded from activity rollups | **but still flagged if their items aren't moving** — stuck/stale/overdue checks still run and surface in the delivery-risk section |

### Load the role cache

Roles persist as JSON keyed by monday `user_id`: `${MONDAY_WEEKLY_REPORT_ROLES:-$HOME/.config/monday-weekly-report/roles.json}`. Read with the Read tool (missing → `{}`). Each entry:

```json
{ "12345678": { "name": "Dana Lee", "role": "owner", "confirmedAt": "2026-06-19" } }
```

### Decide who to prompt

An owner needs confirmation if they are not in the cache, OR `--reconfirm-roles` was passed. If everyone is cached and the flag was not passed, skip prompting.

**Auto-detected default (pre-selected):** an owner who owns ≥ 5 active items across the boards → `owner`; an owner whose name/team marks them external (no auto-signal — default `contributor`); everyone else → `contributor`. A cached role always wins as the pre-selection unless `--reconfirm-roles` forces a fresh choice. (These are only defaults; the human picks `stakeholder` / `external` / `other` as needed.)

### Prompt (interactive runs only)

Only when the run is a preview and the session is interactive. Use **AskUserQuestion**, batching owners ≤ 4 per call:

- One question per owner. `header` = first name (≤ 12 chars). `question` = e.g. `What is Dana Lee's role on this project?`.
- Options (`multiSelect: false`): **Owner / Lead**, **Contributor**, **Stakeholder / Sponsor**, **External / Vendor**, **Other (don't track, notify if stuck)**. List the auto-detected default first with " (detected)" appended.
- Map any free-text "Other" answer to the closest role key, defaulting to `other`.

### Persist

Merge answers into the role cache and write it back (`mkdir -p` the parent dir first). Stamp `confirmedAt` with today's date. Never delete entries for owners not in scope this run; only add/update.

### Non-interactive fallback (`--send` or no TTY)

Do not prompt. Use the cached role if present, else the auto-detected default. In the report header, disclose how many owners used an auto-default, e.g. `Roles: 7 confirmed, 2 auto-defaulted (run a preview to confirm)`.

Carry the resolved `owner_role` for every owner into Steps 6–7.

## Step 5: Pull items and weekly movement

For each board, fetch items with their status, owner, date/timeline values, `updated_at`, and latest update text. Page all items via `all_monday_api` (`items_page`) when the dynamic API is available; otherwise fall back to `get_board_items_by_name` for the items/groups of interest and note the limited coverage in the header. Record per item:

- `id`, `name`, `group`, `board_id`, `board_name`
- `status_label` → mapped `status_bucket` (Step 3.5)
- `owner_ids` → `owner` display names → `owner_role`
- `due` = end of timeline, or the date column value (or null)
- `updated_at`
- `last_update` = most recent update/comment `{ author, created_at, text }` if any

### Weekly movement (hybrid)

- **Activity-log mode:** from `activity_logs(from, to)`, collect per owner the status changes they authored in the window: `→ done` (completed), `→ in_progress` (started), `→ stuck` (flagged blocked), and item creations. Attribute to the `user_id` on the event.
- **Snapshot mode:** an item is "touched this week" if `updated_at ∈ [week_start, week_end]`. Attribute to the current owner(s). Bucket coarsely: items now in `done` and touched this week → "completed this week"; items now in `stuck` and touched → "flagged stuck this week"; others touched → "advanced this week".

In `current` (week-to-date) mode, exclude changes whose only timestamp is *today* from any per-day rate (today is in progress); they still appear in the "moved this week" counts.

## Step 6: Compute health, risk, and flags

### Per-board / per-group health

For each board (and each group within it):

- counts by bucket: `done`, `in_progress`, `stuck`, `not_started`, `cancelled`
- `completion_pct = done / (total − cancelled)`
- `overdue_count`, `due_soon_count` (see below)
- board health: 🔴 if `stuck_count > 0` and `overdue_count > 0` (or completion far behind, see risk); 🟡 if any overdue **or** any stuck; 🟢 otherwise.

### Delivery risk (date-driven — the project-goal analog)

Risk is measured against **due dates / timelines** (the decision for this skill). Compute per board, then roll up:

1. **Overdue** = items with `due < today` and `status_bucket ∉ {done, cancelled}`.
2. **Due-soon** = items with `today ≤ due ≤ today + 7 days` and `status_bucket ∉ {done, cancelled}`.
3. **Slip risk per item** = overdue, OR due-soon while still `not_started`/`stuck`, OR (only when the board has a dependency column) `stuck` while blocking a dependent item.
4. **Project-goal status** (per board, then worst-of for the rollup):
   - 🔴 **Off track** — any overdue item that is `not_started`/`stuck`, OR `overdue_count` ≥ 20% of non-done items, OR a milestone (Step "Milestones") is past its target and not done.
   - 🟡 **At risk** — due-soon items still `not_started`/`stuck`, OR `overdue_count` between 1 and 20% of non-done items.
   - 🟢 **On track** — no overdue and no at-risk due-soon items.
   - Board with **no date column**: status = "n/a — no date column"; still report health and stuck/stale.
5. **At-risk items** list — each with item, board, owner (+role), due, status, the reason, and a **recommended action**.
6. **Catch-up plan** — a short, **prioritized** list; every step names specific items and people. Levers: re-balance ownership (overloaded/stuck owner → owner with capacity), escalate stuck items to a `stakeholder`, pull in an `external`/vendor, re-sequence dependencies (only when a dependency column exists), or **recommend** moving a low-priority item's due date / descope. **Recommend only — never modify monday** (read-only skill). If 🟢 with no at-risk items, the plan is a single "On track" line.

### 🚩 Stuck / blocked items

Items with `status_bucket == stuck`, OR items in `in_progress`/`not_started` with **no `updated_at` change and no update/comment in the last 14 days** (calendar days from today, independent of the window). For `other`-role owners, additionally flag **any** of their items with no movement in 14 days (the "do-not-track but notify if not moving" rule).

### 🐢 Stale items

Top items (across boards) with the oldest `updated_at` among non-`done`/`cancelled` items — the "nothing is happening here" list. **Exclude items already shown in the 🚩 Stuck / blocked section** so the same item isn't double-listed. Cap at the 10 oldest and say so.

### Stalled owners

Flag an owner (excluding `stakeholder` and `external`) who owns ≥ 1 non-done item and authored **zero** weekly movement (activity-log mode) or had **zero** touched items this week (snapshot mode) across both the week and the trailing 14 days. `other`-role owners are surfaced via their non-moving items, not as a "stalled owner" rating.

## Step 7: Render the report

Write `PROJECT_REPORT.md` to the current directory and print the same content. Use `<br>` for every visual line break inside header/stat blocks so renderers don't collapse lines. Every monday item is rendered with its **name and ID** (and a board reference when ambiguous): `**<item name>** (id <ID>, <board>)`. Format:

````markdown
# Weekly Project Report

**Boards:** <board A>, <board B> <br>
**Weekly window:** <week_start> → <week_end> (<window_mode>: <"previous completed Mon → Sun" | "week-to-date, this Mon → today — partial, today in progress">; <N> working days<, provisional if early-week>) <br>
**Project health:** <🟢 On track | 🟡 At risk | 🔴 Off track> — <overdue_count> overdue, <due_soon_count> due within 7 days <br>
**Attribution:** <activity-log (precise) | snapshot (updated_at) — board activity log unavailable> <br>
**Roles:** <K confirmed, X auto-defaulted (run a preview to confirm)> <br>
**Status mapping:** <K boards confirmed, X auto-detected>

<Two-sentence overall summary: overall health, the biggest risk, and the single most important catch-up action.>

## 🎯 Delivery risk & recommended actions

**Project goal status:** <🟢 On track | 🟡 At risk | 🔴 Off track> <br>
**Due-date posture:** <overdue_count> overdue, <due_soon_count> due in ≤ 7 days, across <board count> board(s) <br>
**Verdict:** <one sentence: on pace, or "N items overdue, M due-soon still not started — needs action on X">

### At-risk items

| Item | Board | Owner (role) | Due | Status | Why at risk | Recommended action |
| --- | --- | --- | --- | --- | --- | --- |
| **Vendor contract sign-off** (id 998877, Ops) | Ops | Dana (stakeholder) | 2026-06-15 | Stuck | 4 days overdue, blocks launch | Escalate to <sponsor>; set a decision deadline this week |
| **Landing page copy** (id 112233, Marketing) | Marketing | Priya (external) | 2026-06-22 | Not started | Due in 3 days, not begun | Re-balance to Sam, or confirm vendor start date today |

### Catch-up plan (prioritized)

1. <concrete action naming items + people>
2. <…>

If 🟢 on track with no at-risk items, replace both subsections with: "🟢 **On track** — no delivery risks flagged. All dated items are on schedule." Do not omit the section.

## Project health at a glance

Per board (and a roll-up row). `Completion` excludes cancelled items.

| Board / group | Health | Done | In progress | Stuck | Not started | Completion | Overdue | Due ≤7d |
| --- | --- | ---:| ---:| ---:| ---:| ---:| ---:| ---:|
| Ops | 🟡 | 12 | 5 | 1 | 3 | 57% | 1 | 2 |
| Marketing | 🔴 | 4 | 6 | 2 | 8 | 20% | 3 | 4 |
| **All boards** | 🔴 | 16 | 11 | 3 | 11 | 39% | 4 | 6 |

## Owner activity this week (role-aware)

Owners with role `stakeholder`, `external`, or `other` are not rated on weekly movement (their cell shows `—` with a note); they appear if they have activity or non-moving items.

| Owner | Role | Items completed | Items advanced | Flagged stuck | Items owned (open) | Note |
| --- | --- | ---:| ---:| ---:| ---:| --- |
| Sam | Owner / Lead | 3 | 4 | 0 | 9 | On track |
| Dana | Stakeholder | — | — | — | 2 | Sponsor — not rated; owns 1 blocking item |
| Priya | External / Vendor | 1 | 1 | 0 | 3 | Vendor — relaxed cadence |

(In snapshot attribution mode, "completed / advanced / flagged stuck" are derived from `updated_at` + current status and are approximate — the header states this.)

## Items moved this week

Grouped by board. New items, completions, and status changes inside the window.

- **Ops** — completed: **Server migration** (id …); started: **Q3 budget draft** (id …); flagged stuck: **Vendor sign-off** (id …)
- **Marketing** — …

## Overdue & due-soon

| Item | Board | Owner (role) | Due | Status | Days |
| --- | --- | --- | --- | --- | ---:|
| **Vendor contract sign-off** (id …) | Ops | Dana (stakeholder) | 2026-06-15 | Stuck | +4 overdue |
| **Landing page copy** (id …) | Marketing | Priya (external) | 2026-06-22 | Not started | −3 (due soon) |

## 🚩 Stuck / blocked items

| Item | Board | Owner (role) | Status | Last movement |
| --- | --- | --- | --- | --- |
| **Vendor contract sign-off** (id …) | Ops | Dana (stakeholder) | Stuck | 2026-05-30 |

Include `other`-owner items with no movement in 14 days, noted `untracked owner — item not moving`. Omit the section if empty.

## 🐢 Stale items (no movement)

Top 10 oldest non-done items by `updated_at`. Omit if empty.

| Item | Board | Owner (role) | Status | Last updated |
| --- | --- | --- | --- | --- |

## Milestones / upcoming deadlines

Items flagged as milestones (a milestone column/label if the board has one, else items due within the next 14 days). Show readiness vs target date.

| Milestone | Board | Target date | Status | On track? |
| --- | --- | --- | --- | --- |

## Per-owner detail

Each heading: `### <Name> — <Role>`. For `stakeholder` / `external` / `other`, note the role so low movement is not misread.

### Sam — Owner / Lead

_On track. Completed 3 items, advanced 4._

- **Server migration** (id …) — **Done** (moved Wed)
- **Q3 budget draft** (id …) — In progress, due 2026-06-30

---

<Repeat per owner: 🔴/at-risk owners first, then on-track, then non-rated roles last>
````

Rendering rules:

- Every item is shown with its **name and ID**; add the board when the same name could appear on multiple boards.
- Dates in local timezone, `YYYY-MM-DD`. Overdue shown as `+N overdue`, due-soon as `−N (due soon)`.
- Never include raw JSON, GraphQL, tokens, or debug output in the rendered report.
- Escape pipes (`|`) in table cells.
- Boards lacking a date column: render their delivery-risk line as "*no date column — risk not assessed*" but still include them in health, stuck, and stale sections.

## Step 8: Deliver

If run **without** `--send`:

1. Write `PROJECT_REPORT.md` to the current directory.
2. Print the file contents to stdout.
3. End with: `Preview written to PROJECT_REPORT.md. Re-run with --send to email.`

If run **with** `--send`:

1. Build the recipient list: primary = `$MONDAY_WEEKLY_REPORT_TO` (abort if unset); append each address from `MONDAY_WEEKLY_REPORT_CC` (comma-separated, ignore empties, dedupe).
2. Subject: `Weekly Project Report — <board names> — <week_start> to <week_end>`.
3. Body: the rendered Markdown (render to simple HTML if the transport supports it; otherwise plain text with Markdown preserved).
4. Try delivery in this order: any available Google Workspace MCP tool matching `mcp__*gmail*send*` or `mcp__google*workspace*gmail*` (discover at runtime, do not hardcode); then a `gmail` CLI if installed; then a configured SMTP relay.
5. On success, print `Sent to: <list>`. On failure, leave `PROJECT_REPORT.md` in place, print the error, and tell the user to send manually.

## Caches

All caches live under `~/.config/monday-weekly-report/` (override paths via the env vars below). Create the directory with `mkdir -p` before writing. Read with the Read tool, treating a missing file as empty.

- `roles.json` — `user_id → { name, role, confirmedAt }` (Step 4)
- `statuses.json` — `board_id → { <label>: <bucket> }` (Step 3.5)
- `boards.json` — last interactively-selected board set (Step 2), so reruns don't re-prompt

## Important rules

- **Read-only.** Never create, edit, move, or delete monday boards, items, columns, groups, or updates, and never call write-capable monday tools (`create_*`, `change_item_column_values`, `move_item_to_group`, `delete_*`, `create_update`). This skill only reads.
- **No email unless `--send`.** A run without that flag is a pure preview.
- **Secrets.** Never print `MONDAY_TOKEN` or the `MONDAY_WEEKLY_REPORT_CC` addresses into the report or stdout. The recipient list may be echoed on a successful send.
- **Boards are the lens.** Someone with no items on the selected boards is not in the report — the boards define scope.
- **Generic, non-engineering language.** This is project tracking, not dev throughput. Use "owner", "contributor", "item", "board" — never "developer", "PR", "commit", or "sprint".
- **Weekly window: `past` (default) or `current`.** Default to the previous completed Mon→Sun (stable for scheduled emails). `current` (week-to-date) is an explicit opt-in via `--window current` or the Step 1 prompt, with today excluded from per-day figures and early-week results marked provisional.
- **Roles & status mappings: confirmed once, then cached.** Re-prompt only for new entries, or for everyone with `--reconfirm-roles` / `--reconfirm-statuses`. Never prompt on a `--send` / non-interactive run — fall back to cache + auto-defaults and disclose the gap in the header.
- **Role-aware tracking.** `owner`/`contributor` are tracked on activity and on-time delivery; `stakeholder` and `external` are not rated on weekly movement; `other` is not rated **but** its non-moving items are still surfaced ("untracked owner — item not moving").
- **Delivery risk is date-driven, actionable, and read-only.** The 🎯 section states project-goal status (🟢/🟡/🔴) from overdue / due-soon items, lists the specific at-risk items, and gives a prioritized catch-up plan whose every step names concrete items and people. Re-balancing, escalation, and descope are **recommendations only** — never write to monday.
- **Attribution mode is disclosed.** State whether weekly movement came from the precise activity log or the coarser `updated_at` snapshot, so the reader knows the precision.
- **Graceful degradation.** A board missing a date or status column does not abort the run — skip the part that needs it with an explicit note and report everything else.
- **No skill / process meta-commentary in the report.** The output is a status report — never include "how this was generated", TODOs, or implementation notes. The report ends after per-member detail and the trailing preview/send line.
- **Env vars referenced** (document at the top of output if any are unset and affect the run):
  - `MONDAY_TOKEN` — required; personal access token for the hosted MCP server
  - `MONDAY_WEEKLY_REPORT_BOARDS` — optional comma-separated board IDs/names; used when `--board` and the board cache are absent
  - `MONDAY_WEEKLY_REPORT_TO` — required when `--send` is used; primary email recipient
  - `MONDAY_WEEKLY_REPORT_CC` — optional additional recipients (comma-separated)
  - `MONDAY_WEEKLY_REPORT_ROLES` / `MONDAY_WEEKLY_REPORT_STATUSES` — optional cache path overrides
