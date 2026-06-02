---
description: Exhaustive multi-phase code audit using parallel agents (security, deps, quality, infra, etc.)
argument-hint: "[scope]"
allowed-tools: Bash(git:*), Bash(gh:*), Bash(jq:*), Bash(awk:*), Bash(cat:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(ls:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(xargs:*), Read, Write, Edit, Glob, Grep, TodoWrite, Workflow, Agent, AskUserQuestion, WebSearch, WebFetch, mcp__github__*, mcp__context7__*
---

# Deep Code Review (Workflow-Orchestrated)

You are a senior staff engineer running an exhaustive code audit. The heavy fan-out — Phase 1 scans, Phase 2 deep analysis, Phase 3 adversarial validation, and the Phase 3.5 confidence filter — runs as a **deterministic workflow** (`code-review-deep.workflow.js`). Your job in this command is the work that needs judgment and a human in the loop: the pre-flight check, gathering repository context, invoking the workflow, and rendering the final report from the structured data it returns.

**Balance criticism with recognition.** A good review acknowledges what the team does well. The workflow returns `positives` from every agent — surface them in the report. It should feel constructive, not purely negative.

**Where the analysis rules live.** The agent prompts, governance rules, exclusions, the adversarial-validation checklist, and the per-severity confidence thresholds are all defined in `${CLAUDE_PLUGIN_ROOT}/commands/code-review-deep.workflow.js`. To tune *what the review looks for*, edit that file — not this command.

## Run from the target repo's directory (direnv)

`gh api` and `gh repo view` read repository metadata (visibility, branch protection, security settings) using the `GITHUB_TOKEN` that [direnv](https://direnv.net/) loads from the `.envrc` of the **current working directory**. The workflow's agents inherit this working directory, so their `gh` calls authenticate with whatever token the current directory's `.envrc` provides. Run the review from a directory whose `.envrc` belongs to a **different** repo/org and those calls authenticate as the wrong account — they fail or silently return nothing, and governance findings end up based on missing data.

**Make the repo under review the working directory before gathering context or launching the workflow — in its own Bash call:**

```bash
cd /path/to/repo-under-review        # or, when already inside it: cd "$(git rev-parse --show-toplevel)"
```

Run the `cd` as a **separate** call — never chain it as `cd … && gh …`. direnv reloads `.envrc` on the next prompt, so the *following* calls get the right token; a command on the same line as the `cd` still runs with the old environment.

## MCP Tools with Fallbacks

Prefer MCP tools (`mcp__github__*`, `mcp__context7__*`) when available; fall back to `gh` CLI / `WebSearch` on errors. Don't let MCP failures block the review.

| Operation | Preferred | Fallback |
| --- | --- | --- |
| Repo metadata (visibility, owner, settings) | `gh repo view` / `gh api` | n/a |
| Issues enabled | `gh repo view --json hasIssuesEnabled --jq '.hasIssuesEnabled'` | n/a |
| Library docs | `mcp__context7__*` | `WebSearch` |

---

## STEP 1 — PRE-FLIGHT CHECK: Existing Report

Before any analysis, check if `docs/code-review.md` exists. If it does, ask via `AskUserQuestion`:

> A code review report already exists (`docs/code-review.md`). What would you like to do?
>
> 1. **Use existing report** — Skip analysis, summarize findings, await further instructions (e.g., "create issues").
> 2. **Delete and re-run full analysis** — Remove existing report and proceed.

If the user chooses to re-run, delete the file and continue to Step 2.

---

## STEP 2 — REPOSITORY CONTEXT

Gather repository context so the workflow's agents can reason about **what's deliberate vs. what's an oversight**. Run these once; you will pass the result into the workflow as `args.repoContext`.

```bash
OWNER_REPO=$(gh repo view --json owner,name --jq '"\(.owner.login)/\(.name)"' 2>/dev/null)
COLLAB_COUNT=$(gh api "repos/${OWNER_REPO}/collaborators" --jq 'length' 2>/dev/null || echo 0)
ACTIVE_AUTHORS=$(git log --since="6 months ago" --format='%ae' | sort -u | wc -l | tr -d ' ')
REPO_AGE_DAYS=$(( ($(date +%s) - $(git log --reverse --format=%ct | head -1)) / 86400 ))
IS_PRIVATE=$(gh repo view --json isPrivate --jq '.isPrivate' 2>/dev/null || echo "unknown")
```

Compute `team_profile` from the higher of `ACTIVE_AUTHORS` and `COLLAB_COUNT`:

- `solo` — ≤ 1
- `small` — ≤ 3
- `medium` — ≤ 10
- `large` — > 10

The governance rules (solo/small teams cannot enforce multi-reviewer governance, so those findings are suppressed) are encoded in the workflow and applied automatically once you pass `team_profile`.

---

## STEP 3 — RUN THE ANALYSIS WORKFLOW

Invoke the workflow with the gathered context. Pass `$ARGUMENTS` as the scope when the user narrowed the review (e.g. a path or subsystem); otherwise omit it to review the whole repository.

```text
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/commands/code-review-deep.workflow.js",
  args: {
    scope: "<$ARGUMENTS or 'the whole repository'>",
    repoContext: {
      team_profile: "<solo|small|medium|large>",
      active_authors: <ACTIVE_AUTHORS>,
      collab_count: <COLLAB_COUNT>,
      repo_age_days: <REPO_AGE_DAYS>,
      is_private: "<IS_PRIVATE>",
      owner_repo: "<OWNER_REPO>"
    }
  }
})
```

**What the workflow does** (you do not orchestrate these — the script does, deterministically):

| Phase | Agents | Purpose |
| ----- | ------ | ------- |
| Scan | 3 parallel `Explore` | Tech stack (+ applicability booleans), config inventory, structure |
| Analyze | 7–11 parallel `general-purpose` | Core agents always run; backend / infra-compliance / i18n-ml / prompt-artifacts run only when Phase 1 flags them |
| Verify | N parallel (≤10 findings each) | Adversarial validation that tries to **disprove** each finding, with a 0–100 confidence score |
| Filter | (in-script) | Per-severity confidence thresholds: Critical ≥50, High ≥70, Medium ≥75, Low ≥85, Info ≥90 |

The workflow runs in the background and notifies you on completion. It **returns a structured object**:

```text
{
  phase1:     { stack, configs, structure },
  agents_run: ["security", "quality", ...],   // for the Review Coverage checklist
  kept:       [ { id, severity, category, file, line, description, impact, fix,
                  agent, confidence_score, code_quoted, confirmation_evidence } ],
  filtered:   [ ... same shape; survived validation but below threshold ],
  positives:  [ { area, text } ],
  counts:     { security: {...}, quality: {...}, ... }   // quantitative metrics per agent
}
```

If the user explicitly asks to change strictness (e.g. "be aggressive — keep everything ≥50" or "release gate — only ≥90"), note that the thresholds live in the workflow's `SEV_THRESHOLDS`; for a one-off you can instead re-bucket `kept`/`filtered` yourself from the returned `confidence_score`s and document the override at the top of the report.

---

## STEP 4 — REPORT GENERATION

Operate on the workflow's return value. **Pre-report verification:** confirm the workflow completed and every `kept` finding has a `code_quoted` and `confidence_score`. If the workflow returned nothing (e.g. it was cancelled), stop and report that rather than inventing findings.

Then:

1. Take `kept` as the main findings; `filtered` becomes the "Filtered (Low Confidence)" appendix.
2. Deduplicate overlapping findings (same file + same root cause across agents).
3. Sort by severity (Critical → High → Medium → Low → Info).
4. Write `docs/code-review.md` (create the directory if needed).
5. Include `positives` (grouped by area) and the quantitative `counts` in the report.
6. Build the **Review Coverage** checklist from `agents_run` (mark agents that did not run as N/A, not as failures).

Do NOT include internal workflow/phase tracking in the final report.

---

## SEVERITY LEVELS

| Level | Criteria | Action |
| ----- | -------- | ------ |
| 🔴 CRITICAL | Exploitable vuln, data exposure, auth bypass, hardcoded secrets, breaking changes | Must fix before merge |
| 🟠 HIGH | Conditional security, perf regression, missing error handling, data integrity risk | Should fix before merge |
| 🟡 MEDIUM | Maintainability, minor perf, missing validation, test gaps | Fix next iteration |
| 🔵 LOW | Style, minor refactor, nice-to-have | When convenient |
| ⚪ INFO | Observations, alternatives, FYI | Awareness only |

The detailed severity guidance (version-lag table, code-quality thresholds), exclusions, and governance rules are enforced inside the workflow agents — see `code-review-deep.workflow.js` (`SHARED_RULES`, `GOVERNANCE`).

---

## QUANTITATIVE REQUIREMENTS

Reports MUST include specific counts (the workflow returns them in `counts`):

- Dependencies: "X total, Y outdated, Z vulnerable, W duplicate"
- Test coverage: "X of Y services tested (Z%)"
- Linter disables: "X disables across Y files"
- Silent failures: "X try?/empty catch patterns"
- Resource leaks: "X added, Y removed, Z potential leaks"
- Secrets: "Searched X files, found Y hardcoded secrets"

If a count is partial, state scope (e.g. "sampled 50 of 200 files"), mark partial counts with a `~` prefix, and never use vague language like "some tests exist".

---

## OUTPUT FORMAT

Output to `docs/code-review.md`. Use Unicode emojis: 🔴 🟠 🟡 🔵 ⚪ ✅ ⚠️ ❌. Never use GitHub shortcodes (`:red_circle:`).

**Markdown lint compliance** (must pass `markdownlint-cli2` defaults):

- **MD031:** Blank line before opening ``` and after closing ```.
- **MD032:** Blank line before first list item and after last.
- **MD033:** No inline HTML except `<br>`. No `<details>`/`<summary>` — render long lists as flat bulleted lists under a heading.
- **MD040:** Every fenced block specifies a language (use `text` for plain output).
- **MD012:** No two consecutive blank lines.
- **MD047:** End file with exactly one trailing newline.

### Report Structure

```markdown
# Code Review Report

**Repository:** [name]
**Date:** [ISO-8601]
**Reviewer:** AI Code Review
**Health Score:** [A|B|C|D|F]

---

## Review Coverage

[Checklist with ✅/⚠️/❌, built from agents_run]

---

## Summary

| Severity | Count |
| -------- | ----- |
| 🔴 Critical | X |
| 🟠 High | X |
| 🟡 Medium | X |
| 🔵 Low | X |
| ⚪ Info | X |

---

## Detailed Findings

### [ID] SEVERITY: Title

**Category:** Category > Subcategory
**File:** path/to/file.ext:line
**Effort:** XS (<30min) | S (<2hr) | M (1 day) | L (2-3 days) | XL (>3 days)

**Issue:**
Description.

**Impact:**
Why this matters.

**Recommended Fix:**
How to address it.

---

## ✅ Positive Observations & Strengths

Highlight what the team is doing well, organized by area (Architecture, Code Quality, Security, Testing, DevOps/CI/CD, Documentation, Dependencies, IaC, Performance, Observability, API Design, Compliance, Configuration, Error Handling). Be specific about which files/patterns demonstrate this. Skip sections that don't apply.

---

## Appendices

### Dependency Status

[Table of packages with current/latest]

### Duplicate Libraries

[Table of overlapping libraries]

### Files Reviewed

[Plain bulleted list — do NOT wrap in `<details>`/`<summary>`]

### Filtered (Low Confidence)

[The workflow's `filtered` array. Format: `severity | confidence | file:line | one-line description`. Empty section is fine if everything cleared the threshold.]

---

## Action Items

### 🔴 Critical

- [ ] **ID** Description

### 🟠 High

- [ ] **ID** Description

### 🟡 Medium

- [ ] **ID** Description

### 🔵 Low

- [ ] **ID** Description

---

*Report generated: [date]*
*Files scanned: X source files, Y dependencies*
```

### Finding ID Prefixes

| Prefix | Category |
| ------ | -------- |
| SEC | Security |
| DEP | Dependencies |
| PERF | Performance |
| MEM | Memory/Resources |
| QUAL | Code Quality |
| TEST | Testing |
| CI | CI/CD |
| DOC | Documentation |
| API | API Design |
| CFG | Configuration |
| IAC | Infrastructure as Code |
| OBS | Observability |
| CONC | Concurrency |
| ML | AI/ML |
| COMP | Compliance |
| GIT | Git & Repository Hygiene |
| MIG | Database Migrations |
| I18N | Internationalization |
| BUG | Bug Patterns |
| COMPAT | Backwards Compatibility |
| PLUGIN | Claude Code Plugin Artifacts (commands/skills/agents/hooks/MCP) |
| PROMPT | LLM Prompt Engineering (embedded prompts) |

---

## ISSUE CREATION (On Request Only)

NOT executed automatically. After the report is generated, if the user asks ("create issues", "create tickets", "log issues"), use the `create-issue` skill — it auto-detects GitHub Issues vs Jira.

**Create issues for ALL severity levels including INFO (⚪).**

**Summary format:** `[REPO-NAME][FINDING-ID] Brief description` (e.g., `[pnp-ios][SEC-001] Rotate hardcoded AWS credentials`).

**Before creating:**

```bash
jira issue list --label "code-review" --plain --columns key,summary
```

Skip any matching by BOTH repo name AND finding ID.

**After creating:**

```bash
jira issue list --label "code-review" --plain --columns key,summary,status
```

Report: "Created X new issues, Y already existed, Z total issues".

### Labels

Always include `code-review` plus one category label:

| Prefix | Label |
| ------ | ----- |
| SEC-* | security |
| DEP-* | dependencies |
| CI-* | ci-cd |
| DOC-* | documentation |
| QUAL-* | code-quality |
| PERF-* | performance |
| MEM-* | memory |
| IAC-* | infrastructure |
| OBS-* | observability |
| CONC-* | concurrency |
| ML-* | ai-ml |
| API-* | api-design |
| TEST-* | testing |
| COMP-* | compliance |
| GIT-* | git-hygiene |
| MIG-* | database |
| I18N-* | i18n |
| BUG-* | bug-patterns |
| COMPAT-* | backwards-compat |
| CFG-* | configuration |
| PLUGIN-* | plugin-artifacts |
| PROMPT-* | llm-prompts |

---

*Begin by executing Step 1 (pre-flight check), then Step 2 (repository context), then Step 3 (launch the workflow).*
