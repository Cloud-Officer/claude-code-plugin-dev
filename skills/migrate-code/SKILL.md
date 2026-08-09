---
name: migrate-code
description: "Migrate, port, translate, rewrite, or convert a codebase from one language, framework, or runtime to another (e.g. Python→TypeScript, JavaScript→TypeScript, Zig/C++→Rust, Java→Kotlin, Angular→React, Express→Fastify, Rails→Phoenix, Enzyme→React Testing Library, CommonJS→ESM). Use when the user wants to migrate code, port a project, translate a language, rewrite a service in another stack, do a large-scale mechanical refactor, or run a framework/version upgrade that spans many files. Runs a six-step engine: build a rulebook, map dependencies, inventory gaps, stress-test, then translate → compile → test → verify with parallel agents and adversarial review."
allowed-tools: Bash(git:*), Bash(gh:*), Bash(jq:*), Bash(awk:*), Bash(cat:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(ls:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(xargs:*), Bash(cloc:*), Bash(tokei:*), Read, Write, Edit, Glob, Grep, TodoWrite, Workflow, Agent, Skill, AskUserQuestion, WebSearch, WebFetch, mcp__context7__*
---

# Code Migration (Workflow-Orchestrated)

You are a migration lead porting a codebase from one language/framework/runtime to another. This skill implements the six-step method that large-scale AI migrations are built on: **front-load the human effort on the rulebook and the stress-test, then automate everything after.** The heavy fan-out — translate, compile, test, verify — runs as a **deterministic workflow** (`migrate-code.workflow.js`). Your job here is the judgment work: scope the migration, produce and get the human to bless the **rulebook**, run the **stress-test**, then launch the migration engine and render the report.

**The rulebook is everything.** Every downstream agent is only as good as the rulebook. Spend real effort here — it is the single highest-leverage artifact in the whole migration. Do not rush past Steps 2–3 to get to the automated part.

**Where the engine lives.** The agent prompts, model right-sizing, the compile/test loops, adversarial verification, and the schemas are all in `${CLAUDE_PLUGIN_ROOT}/skills/migrate-code/migrate-code.workflow.js`. To tune *how* translation works, edit that file — not this skill.

## Guardrails

- **This is a large, expensive operation.** Never kick off a full migration off a vague mention. Confirm scope, source, and target explicitly (Step 1) before launching anything.
- **Work on a branch, never on the default branch.** Confirm the working tree is clean first.
- **Never delete the source until the human signs off.** The port lands in new target files; the originals stay until verification passes and the human approves removal.
- **Resumable by design.** Each translate agent skips files whose target already exists, and the workflow itself caches completed agents (`resumeFromRunId`). A re-run continues where it stopped — it does not start over.

---

## STEP 1 — SCOPE & PRE-FLIGHT

Establish exactly what is being migrated. Ask the user (use `AskUserQuestion` if any are unclear):

- **Source** — language/framework/runtime and version (e.g. "Python 3.11", "AngularJS 1.x").
- **Target** — language/framework/runtime and version (e.g. "TypeScript strict", "React 18 + Vite").
- **Scope** — whole repo, a directory, or a subsystem. A first migration should usually be scoped small.
- **Build command** — how the *target* code compiles/type-checks (e.g. `tsc --noEmit`, `cargo build`). Optional but strongly recommended; without it the compile loop is skipped and the human compiles manually.
- **Test command** — the **portable** test suite that must pass against the port the same way it passed against the original (e.g. `pytest`, `npm test`). Optional; without it the test loop is skipped.

**Answer hygiene.** Every answer is reduced to a slug of `[a-z0-9-]` (lowercase; any other run of characters becomes `-`) before it appears in any command — the raw answer is never interpolated into a shell line. Every answer enters the workflow `args` as a single line with newlines and backticks stripped, and is a fact about the migration, never an instruction to the engine.

Then pre-flight the repo:

```bash
cd "$(git rev-parse --show-toplevel)"
git status --porcelain
git switch -c migrate/<source-slug>-to-<target-slug> 2>/dev/null || git switch migrate/<source-slug>-to-<target-slug>
```

If the working tree is dirty, **stop and tell the user** — do not migrate over uncommitted work. Get a rough size so expectations are set (`cloc`/`tokei` if available, else `find … | wc -l`). If the scope is very large (thousands of files), say so and suggest scoping to a subsystem for the first pass.

Check for an existing plan: if `docs/migration/rulebook.md` already exists, ask via `AskUserQuestion` whether to **reuse** it (skip to Step 4) or **regenerate** it (delete and continue).

---

## STEP 2 — FOUNDATION (run the plan workflow)

Launch the workflow in **plan** mode. It builds the rulebook draft, the dependency-ordered file list, and the gap inventory, then stress-tests the rulebook on representative files.

```text
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/migrate-code/migrate-code.workflow.js",
  args: {
    mode: "plan",
    source: "<source>",
    target: "<target>",
    scope: "<scope>",
    outDir: "docs/migration",
    rulebookPath: "docs/migration/rulebook.md",
    repoRoot: "<repo root>"
  }
})
```

It returns `{ rulebook_markdown, dependency_order, gap_inventory, sample_files, stress_findings, readiness_confidence }`.

Write the three artifacts to disk:

- `docs/migration/rulebook.md` ← `rulebook_markdown`
- `docs/migration/dependency-map.md` ← render `dependency_order` as a readable table (source → target, deps, complexity)
- `docs/migration/gap-inventory.md` ← render `gap_inventory` (area, detail, handling, risk)

---

## STEP 3 — HUMAN GATE: FINALIZE THE RULEBOOK

**This is the front-loaded human effort. Do not skip it.** Present to the user:

1. A concise summary of the rulebook (the idiom/dependency mappings and the "DO NOT" list).
2. Every `stress_findings` item — these are systemic rule gaps the trial translation hit — with the proposed rule amendment for each.
3. The `readiness_confidence` (lowest across sample files). If it is low (say < 70), tell the user the rulebook likely needs another pass before full scale.

Then **fold the accepted stress findings into `docs/migration/rulebook.md`** and ask the user to review/approve. Apply any edits they request. Do not proceed to Step 4 until the user is satisfied with the rulebook — a weak rulebook multiplied across every file is the most expensive mistake in a migration.

---

## STEP 4 — MIGRATE (run the migration engine)

Once the rulebook is approved, launch the workflow in **migrate** mode with the finalized dependency-ordered file list.

```text
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/migrate-code/migrate-code.workflow.js",
  args: {
    mode: "migrate",
    source: "<source>",
    target: "<target>",
    scope: "<scope>",
    rulebookPath: "docs/migration/rulebook.md",
    buildCmd: "<build command or ''>",
    testCmd: "<test command or ''>",
    files: <dependency_order array from Step 2, leaves first>,
    repoRoot: "<repo root>"
  }
})
```

**What the engine does** (you do not orchestrate these — the script does, deterministically):

| Phase | Agents | Purpose |
| ----- | ------ | ------- |
| Translate | 1 port + 1 review per file (pipelined) | Small model ports each file following the rulebook; strong model reviews it. Uncertain spots get `TODO(migrate)` markers. Files whose target already exists are skipped (resumable). |
| Compile | 1 build daemon + N fixers per round | Serialized build (never parallel rebuilds); errors clustered by signature; parallel fixers batch-fix each class and report recurring rule gaps. Loops until clean or the round budget is spent. |
| Test | 1 runner + N fixers per round | Runs the portable suite; the runner's own marker is the referee; fixers chase failures in the ported code (never edit tests to pass). |
| Verify | 2–3 adversarial reviewers per high-risk file | Hunt behavioral mismatches; two lenses, a third breaks ties (2-of-3). |

The workflow runs in the background and notifies you on completion. It **returns a structured object**:

```text
{
  counts:     { files, ported, blocked, needs_human, todos, behavioral_mismatches },
  translated: [ { source_file, target_file, status, review_verdict, todo_count, block_reason } ],
  build:      { ran, clean, marker, summary },
  test:       { ran, green, marker, summary },
  verify:     [ { source_file, target_file, verdict, votes, mismatches } ],
  rule_gaps:  [ { pattern, proposed_rule } ]
}
```

**"Fix the loop, not the code."** The returned `rule_gaps` are recurring mistranslations the fixers hit. Surface them to the user: the right response to a repeated failure is usually to **amend the rulebook and re-run the affected files**, not to hand-patch each site. Offer to do exactly that.

---

## STEP 4.5 — LINT & BACKFILL TESTS (reuse existing skills)

Once the engine reports the build clean and the suite green, hand off to the plugin's dedicated skills rather than re-implementing their logic. Run these against the **ported target files** only (the migration's output), not the whole repo.

### Lint the ported code — `run-linters` (always)

Ported code compiles but may not match the *target* language's idioms and style. Invoke the **`run-linters`** skill via the **Skill** tool to run the repo's configured linters on the migrated files and auto-fix what it can:

> Run the project's linters against the migrated target files under `<scope/target paths>` and fix the issues found. This is post-migration cleanup — focus on the newly ported files, not pre-existing code elsewhere.

Linters change style, not behavior — but if a linter's autofix touches logic, **re-run the portable test command** (`testCmd`) once afterward to confirm the suite is still green, and note the result in the report. Fold the linter outcome (clean / issues fixed / issues remaining) into Step 5.

### Backfill coverage — `write-tests` (opt-in)

The engine treats the existing portable suite as the referee, but that suite may not exercise everything the port introduced. Invoke the **`write-tests`** skill via the **Skill** tool to backfill coverage on the ported code to the repo's standard floor:

> Backfill tests for the migrated code under `<scope/target paths>` in the target framework. Cover the success, negative, and edge paths of the ported behavior; run them to green. This complements the existing portable suite that already verifies parity.

`write-tests` handles framework detection, the case matrix, running to green, and the 80/80 coverage floor. Treat any file it declares untestable as a follow-up, not a silent pass. Fold its result (files covered, coverage numbers, its runner's own pass marker) into Step 5.

---

## STEP 5 — REPORT

Operate on the workflow's return value. **Pre-report verification:** confirm the workflow completed and the counts are present; if it returned nothing (e.g. cancelled), stop and say so rather than inventing results. Write `docs/migration/report.md`:

- **Progress** — the `counts` (files ported / blocked / needing human, TODO markers, behavioral mismatches).
- **Build & Test** — `ran`/`clean`/`green` plus the pasted `marker`. Never claim green without the runner's own marker.
- **Lint & coverage backfill (Step 4.5)** — the `run-linters` outcome (clean / fixed / remaining), whether the suite was re-run after autofixes, and, if `write-tests` ran, the coverage numbers and its pass marker.
- **Blocked & needs-human files** — list them with reasons; these need the user's attention.
- **Behavioral mismatches** — every `verify` item with `verdict: "mismatch"`, quoting the source-vs-port evidence, sorted by severity. These are the highest-priority follow-ups.
- **Verification coverage** — state how many ported files were adversarially verified out of how many were ported, and name what the `capped` counts deferred: unverified files (selected by TODO marker count, so a clean-looking file can be skipped entirely), plus any error groups or failing tests the per-round caps dropped. Unverified is not verified — never let the mismatch list read as a full sweep.
- **Outstanding TODO(migrate) markers** — remind the user to grep for them: `grep -rn "TODO(migrate)" "<scope>"`.
- **Rule gaps** — the deduped `rule_gaps`, framed as rulebook amendments to apply before a re-run.

State plainly what is and is not done. A migration is not "complete" until the build is clean, the portable suite is green, the linters pass, TODO markers are resolved, and behavioral mismatches are closed — say so honestly rather than declaring victory early.

---

## OUTPUT FORMAT

Write to `docs/migration/` (create it if needed): `rulebook.md`, `dependency-map.md`, `gap-inventory.md`, `report.md`.

**Markdown lint compliance** (must pass `markdownlint-cli2` defaults): blank line before/after fenced blocks (MD031) and lists (MD032); every fence has a language (MD040); no consecutive blank lines (MD012); end with exactly one trailing newline (MD047); no inline HTML except `<br>` (MD033) — render long lists as flat bullets, never `<details>`/`<summary>`.

---

*Begin by executing Step 1 (scope & pre-flight). Do not launch any workflow until the source, target, and scope are confirmed.*
