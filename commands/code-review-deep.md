---
description: Exhaustive multi-phase code audit using parallel agents (security, deps, quality, infra, etc.)
argument-hint: "[scope]"
allowed-tools: Bash(git:*), Bash(gh:*), Bash(jq:*), Bash(awk:*), Bash(cat:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(ls:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(xargs:*), Read, Write, Edit, Glob, Grep, TodoWrite, Agent, AskUserQuestion, WebSearch, WebFetch, mcp__github__*, mcp__context7__*
---

# Deep Code Review (Parallel Agent Strategy)

You are a senior staff engineer orchestrating an exhaustive code audit using parallel agents. Be thorough, specific, quantitative, and educational.

**Balance criticism with recognition.** A good code review acknowledges what the team is doing well, not just what needs improvement. Document positive patterns alongside findings. The report should feel constructive, not purely negative.

**Inherit the parent model.** Do NOT specify a model parameter on agent calls — let agents use the same model as the parent.

**Web search is opt-in.** Do NOT default to web searches in agent prompts. Use the model's existing knowledge. Only invoke `WebSearch` (or `mcp__context7__*`) for: (a) CVE lookup against a current dependency version, (b) latest stable version checks for outdated-dep flagging, (c) anything the user explicitly asks to verify against current docs. Skip silently on quota/timeout.

## Run from the target repo's directory (direnv)

`gh api` and `gh repo view` read repository metadata (visibility, branch protection, security settings) using the `GITHUB_TOKEN` that [direnv](https://direnv.net/) loads from the `.envrc` of the **current working directory**. Run the review from a directory whose `.envrc` belongs to a **different** repo/org and these calls authenticate as the wrong account — they fail or silently return nothing, and governance findings end up based on missing data.

**Make the repo under review the working directory before any `gh` call — in its own Bash call:**

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

## Phase Tracking

Use `TaskCreate` to track phases. Create one task per phase plus one per Phase 2 agent. Mark `in_progress` when launching, `completed` when results are in. Do NOT include the task list in the final report — it's internal tracking only.

**Completion rules:**

- Phase 1 must complete before Phase 2.
- All applicable Phase 2 agents must complete before Phase 3 (mark conditional agents N/A if not applicable — do not silently skip).
- Phase 3 must validate every Phase 2 finding.
- Phase 3.5 must apply the confidence filter before report generation.

---

## EXECUTION OVERVIEW

| Phase | Agents | Subagent type | Purpose |
| ----- | ------ | ------------- | ------- |
| 1 | 3 parallel | `Explore` | Quick scans: tech stack, configs, structure |
| 2 | 7–10 parallel | `general-purpose` | Core + conditional deep analysis |
| 3 | N parallel (10 findings/agent) | `general-purpose` | Adversarial validation + 0–100 confidence on CONFIRMs |
| 3.5 | 0 (you) | n/a | Tiered confidence filter (Critical ≥50, High/Medium ≥65, Low/Info ≥80) |
| 4 | 1 (you) | n/a | Aggregate kept findings, list filtered ones in appendix, generate report |

Launch all agents within a phase **in a single message** for true parallelism.

---

## PRE-FLIGHT CHECK: Existing Report

Before any analysis, check if `docs/code-review.md` exists. If it does, ask via `AskUserQuestion`:

> A code review report already exists (`docs/code-review.md`). What would you like to do?
>
> 1. **Use existing report** — Skip analysis, summarize findings, await further instructions (e.g., "create issues").
> 2. **Delete and re-run full analysis** — Remove existing report and proceed with Phase 1.

---

## REPOSITORY CONTEXT (Before Phase 1)

Before any analysis, gather repository context so downstream agents can reason about **what's deliberate vs. what's an oversight**. Run these queries once and propagate the result into every Phase 2 agent prompt.

```bash
OWNER_REPO=$(gh repo view --json owner,name --jq '"\(.owner.login)/\(.name)"' 2>/dev/null)
COLLAB_COUNT=$(gh api "repos/${OWNER_REPO}/collaborators" --jq 'length' 2>/dev/null || echo 0)
ACTIVE_AUTHORS=$(git log --since="6 months ago" --format='%ae' | sort -u | wc -l | tr -d ' ')
TOTAL_AUTHORS=$(git log --format='%ae' | sort -u | wc -l | tr -d ' ')
REPO_AGE_DAYS=$(( ($(date +%s) - $(git log --reverse --format=%ct | head -1)) / 86400 ))
IS_PRIVATE=$(gh repo view --json isPrivate --jq '.isPrivate' 2>/dev/null || echo "unknown")
```

Compute `team_profile` from the higher of `ACTIVE_AUTHORS` and `COLLAB_COUNT`:

- `solo` — ≤ 1
- `small` — ≤ 3
- `medium` — ≤ 10
- `large` — > 10

**Pass `team_profile`, `active_authors`, `collab_count`, `repo_age_days`, and `is_private` to every Phase 2 agent in its prompt.** They are the deliberateness signal — agents reason about intent from team size, not from hardcoded examples.

### Governance findings on solo / small teams

Solo and small teams **cannot realistically enforce multi-reviewer governance** — they would not be able to merge anything. On `team_profile in {solo, small}`, treat the following as **deliberate trade-offs, not defects**, and **do not generate findings** for them:

- Required reviewers count < 2, or CODEOWNERS pattern that any team member can self-satisfy (e.g., `* @org/MaintainersTeam` where the PR author is on that team).
- Auto-approve / auto-merge workflows that let a bot or maintainer satisfy review.
- Named bypass lists in branch protection (specific user logins listed).
- `enforce_admins: false` on branch protection.
- `pull_request_target` + bot PAT effectively single-vote review.
- "Single maintainer can merge."

The fix for these on a small team would be "hire more engineers" — not actionable. Skip silently (do not even surface as INFO). They reappear as findings only when `team_profile` is `medium` or `large`.

---

## PHASE 1: INITIAL SCANS

Launch these 3 agents in a single message with `subagent_type: "Explore"`. Each is a fast read-only scout.

### Agent 1.1: Tech Stack Detection

> Identify: (1) primary languages from file extensions and package managers, (2) platforms (iOS, Android, Web, Backend, CLI, Library), (3) infrastructure (AWS/GCP/Azure/Docker/Kubernetes/none), (4) frameworks and major libraries. Return JSON: `{languages, platforms, infrastructure, frameworks}`.

### Agent 1.2: Config File Inventory

> Find ALL config files grouped by category: CI/CD (.github/workflows, .gitlab-ci.yml, Jenkinsfile, Fastfile), dependencies (package.json, Gemfile, Podfile, Package.swift, build.gradle), lock files, environment (.env*, config/*.yml), platform (Info.plist, AndroidManifest.xml, entitlements), Docker, docs (soup.json, soup.md, architecture.md, README.md). Return JSON grouped by category with file paths.

### Agent 1.3: Codebase Structure

> Count source files by directory and language, count test files and identify framework, identify major modules, estimate LOC. Return JSON: `{source_files, test_files, modules, estimated_loc}`.

**Wait for all 3 to return before Phase 2.**

---

## PHASE 2: DEEP ANALYSIS

Use Phase 1 results to determine which conditional agents apply. Launch all applicable agents in a single message with `subagent_type: "general-purpose"`.

**Every Phase 2 agent MUST return both `issues` and `positives`** in its response so the final report acknowledges what's working.

**JSON schemas in the prompts below are guidance, not strict contracts.** Agents may return any structured form as long as findings include: `id`, `severity`, `category`, `file`, `line` (when applicable), `description`, `impact`, `fix`.

### Core Agents (always run)

#### Agent 2.A: Security & Secrets

> Audit for security vulnerabilities and secret exposure.
>
> **Secrets:** Hardcoded API keys, tokens, credentials in source/config/plist/xml. Patterns: AKIA (AWS), sk_live/sk_test (Stripe), ghp_/gho_/github_pat_ (GitHub), AIzaSy (Google/Firebase), xox (Slack).
>
> **Injection:** SQL, command, XSS, template (SSTI), unsafe deserialization.
>
> **Auth:** Weak password hashing, missing rate limiting, JWT issues, IDOR, hardcoded credentials.
>
> **Storage:** iOS uses Keychain (not UserDefaults); Android uses EncryptedSharedPreferences/Keystore (not SharedPreferences); Web uses httpOnly cookies (not localStorage); Backend uses Vault/Secrets Manager.
>
> **TLS:** Certificate pinning across all environments.
>
> Return findings + positives.

#### Agent 2.B: Code Quality & Comments

> Review structural code quality and in-code comment accuracy. Bug patterns and error-handling strategy are covered by Agent 2.C — do not duplicate.
>
> **Quality metrics — flag explicitly:** methods >100 lines, classes >1000 lines, >8 parameters, >6 nesting depth, cyclomatic complexity >25.
>
> **Quality patterns:** God classes, deep inheritance, giant switch/if-else, primitive obsession, stringly-typed data, boolean parameters that should be enums, manual loops where map/filter/reduce fit, callback hell, mutable shared state, scattered object creation that should be a factory, complex state transitions that should be a state machine, deprecated API usage.
>
> **Pattern duplication:** Scan for byte-identical or near-identical 5+ line blocks across files (the "shotgun-surgery" smell). Report count and locations — adding a new property/service/option then requires editing every site.
>
> **Quantitative counts — REQUIRED, return exact numbers:**
>
> - **Linter disables:** count `swiftlint:disable`, `eslint-disable`, `rubocop:disable`/`rubocop:todo`, `# type: ignore`, `# noqa`, `@SuppressWarnings`. Group by rule. Report total + by-rule breakdown **as INFORMATIONAL** (a positive signal of awareness). **DO NOT generate a finding for the existence of linter disables or for a permissive linter policy** — that is project policy, not oversight. Escalate to a finding **only** if: (a) the linter config disables rules wholesale (`extends: []` with no overrides, or every rule explicitly set to off, or `--no-*-checks` style flags that turn the linter off entirely); (b) a critical correctness/security rule is silenced **without an inline reason comment** — examples by ecosystem: `no-eval`, `no-implied-eval`, `no-unsafe-*`, `react/no-danger`, `Security/*` (eslint-plugin-security), `Security/*` (rubocop-security / brakeman), `DL3002`/`DL3004` (hadolint root/sudo), SQL-injection equivalents, secret-detection rules; (c) a linter config exists in the repo but **no CI workflow step actually invokes it** (decoration without enforcement).
> - **Memory observers:** count `addObserver` vs `removeObserver` (Swift/Obj-C/Java). Report delta.
> - **Pattern duplication count:** total duplicated blocks found, with one example per group.
>
> **Comment quality (in-code only — README/architecture is Agent 2.G's job):**
>
> - Factually inaccurate (signature mismatch, contradicts actual code).
> - Outdated references (renamed code, wrong examples, references to methods that no longer exist).
> - Stale TODOs (cross-check against current code; flag those without owner/ticket).
> - Restating obvious code (`// increment counter` above `counter++`).
> - Misleading or ambiguous phrasing (over-promising what the code does).
> - Misplaced doc blocks (YARD/JSDoc/TSDoc above the wrong method).
> - Refactor scars ("Original logic preserved exactly", "Extracted from X#y") that no longer carry information.
> - Missing critical context on complex code (non-obvious side effects, hidden invariants, business rationale).
>
> **DO NOT FLAG comments:** Standard license headers, generated code auto-comments, comments correctly explaining the WHY, factually accurate type-system docs (TSDoc, Rustdoc, KDoc).
>
> Return findings (with file:line) + positives + the exact quantitative counts above.

#### Agent 2.C: Bug Patterns & Error Handling

> Review the codebase for common bug patterns and the error-handling strategy as a whole. Structural code quality and comments are covered by Agent 2.B — focus here on defects and error flow.
>
> **Bug patterns:**
>
> 1. **Null/nil:** Missing null checks, `Optional.get()` without `isPresent()`, force unwrap (`!`), accessing nullable without guard. Watch for parser quirks where empty input returns `false` (not `nil`) and downstream `&.` chains short-circuit incorrectly.
> 2. **Bounds:** Off-by-one, index out of bounds, empty collection accessed without check.
> 3. **Arithmetic:** Division by zero, integer overflow, float equality comparison, precision loss.
> 4. **Resources:** File/connection/lock not closed in error paths, missing `finally`/`defer` cleanup, try-with-resources not used.
> 5. **State:** Invalid transitions, stale cache without invalidation, partial-failure leaving inconsistent state, time-of-check-time-of-use races.
>
> **Error-handling strategy — count exact occurrences for each (REQUIRED):**
>
> - **Silent failures:** `try?`, `try!`, empty `catch {}`, `except: pass`, `_ = try?`. Report exact total per type and per file.
> - **Catch-all without rethrow / context loss.**
> - **Returning null/undefined/default values on error WITHOUT logging** — hides the failure entirely; flag every occurrence.
> - **Optional chaining (`?.`) used as error suppression** — different from null-safety; flag when it skips operations that should have surfaced an error.
> - **Production fallback to mock/stub/fake implementations** — production code should never silently fall back to test doubles.
> - **Retry exhaustion without informing the user.**
> - **Generic non-actionable user-facing error messages** ("Something went wrong" with no context and no next step).
> - **Errors written to STDOUT instead of STDERR** (CLIs especially).
> - **Narrow rescue/catch clauses** (catching only one subclass when the parent class has many — e.g. `OptionParser::InvalidOption` instead of `OptionParser::ParseError`; `IOError` instead of `Exception` parent).
> - **Error messages that drop response body / context** (HTTP error wrapping that throws away the API's `errors` field; `e.message` losing `e.cause`).
> - **Validators that silently `return` instead of `raise` on malformed input** (defeats the safety net they're supposed to provide).
>
> **Error propagation:**
>
> - Errors not bubbling with context (lost stack/cause chain).
> - Sensitive data in error messages (PII, tokens, full request bodies).
> - Missing correlation/request IDs for distributed debugging.
>
> Return findings (with file:line) + positives + exact silent-failure counts grouped by type and by file.

#### Agent 2.D: Testing

> Assess test coverage AND quality. Focus on **behavioral coverage** (would tests catch real regressions?) over line coverage.
>
> **Coverage ceiling:** Determine overall coverage from coverage reports if available, otherwise estimate from `test_files / source_files` ratio. **If overall coverage ≥ 80%, do NOT generate coverage findings.** Report coverage as a POSITIVE and skip all "add tests for X" suggestions. Behavioral gaps on **critical paths** (data loss, auth, payments, regulated data) still qualify regardless of coverage %, but only with a concrete file:line and a 1–10 criticality rating ≥ 7.
>
> 1. **Coverage:** For each service/repository/viewmodel/controller, check if a test file exists. Calculate percentage.
> 2. **Quality anti-patterns:** Tests without assertions, tests with sleep/delays, tests with logic (if/loops).
> 3. **Test types present:** unit, integration, E2E, contract, security.
> 4. **Flaky indicators:** Use of current date/time, random without seed, order-dependent tests.
> 5. **Behavioral gaps — rate each 1–10 criticality** (10 = data loss / security / system failure; 1 = minor): negative tests missing (validation logic with no test that bad input is rejected), error-path tests missing (catch blocks/error returns/timeouts uncovered), boundary edge cases (empty/max/zero/negative/off-by-one), async/concurrent behavior untested.
> 6. **Implementation coupling smells:** Tests asserting on private methods, internal data structures, exact log strings; tests that mirror implementation 1:1 instead of asserting on contracts.
>
> Return findings + positives.

#### Agent 2.E: Dependencies & Backwards Compatibility

> Two concerns merged: dependency health AND breaking-change risk.
>
> **Dependencies:**
>
> 1. **Versions:** For each dep, look up latest stable version (use `WebSearch` if needed). Compare against current.
> 2. **CVEs:** Check for known security advisories (use `WebSearch` only for high-impact deps).
> 3. **Duplicates:** Overlapping libraries (multiple HTTP clients, image loaders, etc.).
> 4. **Maintenance:** Flag abandoned packages (12+ months inactive).
> 5. **Licenses:** Flag copyleft (GPL/AGPL) in proprietary projects.
> 6. **SOUP:** If `soup.json` exists (source of truth — `soup.md` is auto-generated), cross-reference coverage.
>
> **Backwards compatibility (only if library/SDK/public API):**
>
> - Removed/renamed public APIs, changed signatures or return types, breaking response schema changes, removed fields or changed error codes.
> - Deprecated APIs without replacement documented or without removal timeline.
> - SemVer violations (breaking change without major bump).
> - DB schema changes that break old app versions (removed columns still queried).
> - Missing migration guide for breaking changes.
>
> Return findings + positives + dep table (`{name, current, latest, severity, issues}`) + duplicates + soup_coverage `"X of Y (Z%)"`.

#### Agent 2.F: Repository & CI/CD Hygiene

> Two concerns merged: git/repo hygiene AND CI/CD pipeline.
>
> **Git & Repo:**
>
> 1. Branch protection on main/master (no direct pushes, required reviews, required status checks). Use `gh api` to inspect actual settings. **Respect `team_profile`:** on `solo`/`small` teams, do NOT flag missing multi-reviewer requirements, named bypass lists, `enforce_admins: false`, auto-approve workflows, `pull_request_target` + bot PAT, or CODEOWNERS team self-approval — see the "Governance findings on solo / small teams" rules in the Repository Context section.
> 2. CODEOWNERS present (case-insensitive — see exclusions). Critical paths covered. On `solo`/`small` teams, `* @org/team` patterns where the PR author is on the team are legitimate — do NOT flag as "allows self-approval".
> 3. Commit hygiene: vague messages ("fix", "update"), missing issue refs, WIP commits on main. **Only audit commits from the last 30 days** (`git log --since="30 days ago"`). Older commit messages are historical and not actionable — do not flag them.
> 4. Stale branches >30 days, inconsistent naming.
> 5. Secrets accidentally committed in git history. **Before flagging:** confirm the secret is also present in the current working tree (`git grep -F "<value>"` or check the file at HEAD). If the secret is only in old commits and is NOT in the current working tree, assume it has been rotated — do NOT suggest history rewrites or flag the historical commit. Only flag secrets currently present in the working tree.
> 6. Large binaries that should use Git LFS.
>
> **CI/CD Pipeline:**
>
> 1. **Stages present:** lint/format, type check, unit tests, integration tests, security scan (CodeQL/Semgrep/Snyk/Trivy), dependency scan. Missing test execution = HIGH. Missing security scan = HIGH.
> 2. **GitHub Actions security:** Missing `permissions` block (HIGH), `permissions: write-all` (HIGH), workflow injection via untrusted `${{ github.event.* }}` in `run:` (CRITICAL), `pull_request_target` with checkout of PR code (CRITICAL).
> 3. **Runners (cost):** Run `gh repo view --json isPrivate --jq '.isPrivate'` first. **Public repo (false):** GitHub runners are FREE — do NOT flag macOS/Windows runner cost. Cross-platform testing in public repos is a POSITIVE. **Private repo (true):** macOS costs ~10x Linux — flag if not needed for Apple-specific code.
> 4. **Caching, `timeout-minutes`, matrix strategy, artifact upload, code coverage reporting.**
> 5. **Dependency monitoring — MANDATORY EVIDENCE CHECK before flagging:**
>
>    ```bash
>    REPO_INFO=$(gh repo view --json owner,name --jq '"\(.owner.login)/\(.name)"')
>    gh api "repos/${REPO_INFO}" --jq '.security_and_analysis.dependabot_security_updates.status // "disabled"'
>    ```
>
>    If output is `"enabled"`, Dependabot Security Updates are configured at the repo level — **DO NOT flag "No Dependabot Configuration"**. The finding is invalid without this command's output included as evidence. Severity logic: neither `dependabot.yml`/`renovate.json` NOR security updates enabled = HIGH; security updates enabled but no `dependabot.yml` = DO NOT FLAG; `dependabot.yml` exists but missing ecosystems (npm, pip, gradle, swift, cocoapods, github-actions, docker) = MEDIUM.
> 6. **Deployment safety:** environment protection rules, required reviewers for production, secrets in workflow files vs environment secrets.
>
> Return findings + positives. For dependency monitoring, include the actual `gh api` output in the response.

#### Agent 2.G: Documentation & Configuration

> Two concerns merged: project documentation AND configuration management.
>
> **Documentation — required files:**
>
> - **README.md** sections: project name with build badge, table of contents, overview, installation, usage examples, contributing.
> - **docs/architecture.md** standard repos: TOC, architecture diagram, software units, SOUP, critical algorithms, risk controls.
> - **docs/architecture.md** AI/ML repos: datasets, preprocessing, splits, model architecture, training, evaluation, SOUP, risk controls, deployment.
> - **CODEOWNERS** (any case variant — see exclusions).
> - **PR template** (`.github/PULL_REQUEST_TEMPLATE.md`).
> - **Issue templates** ONLY if GitHub issues are enabled (`gh repo view --json hasIssuesEnabled --jq '.hasIssuesEnabled'`).
> - **LICENSE** ONLY if repo is public (`gh repo view --json isPrivate --jq '.isPrivate'` returns `false`).
> - **API docs** (OpenAPI/Swagger) if APIs.
>
> **DO NOT FLAG missing:** CHANGELOG.md, CONTRIBUTING.md as separate file, SBOM, CODE_OF_CONDUCT.md, SECURITY.md.
>
> **Content verification:** Files must have actual content (not stubs). soup.json must have actual dependency data. Architecture docs must have actual diagrams/descriptions. Empty/stub doc = MEDIUM.
>
> **Case-insensitive search is MANDATORY.** GitHub treats `CODEOWNERS`/`codeowners`/`Codeowners`, `README.md`/`readme.md`, `LICENSE`/`license`, `pull_request_template.md`/`PULL_REQUEST_TEMPLATE.md` as equivalent. Search case-insensitively before flagging anything missing. Locations: root, `.github/`, `docs/` are all valid for CODEOWNERS.
>
> **Configuration management:**
>
> 1. **Environment separation:** Hardcoded values that vary by environment, `if env == "prod"` logic, prod config in non-prod builds.
> 2. **Secrets in config files:** Should use vault/secrets manager. Missing `.env.example`.
> 3. **Startup validation:** Required config validated at startup, fail-fast on missing/invalid config.
> 4. **Feature flags:** Inconsistent naming, no cleanup of old flags, undocumented dependencies.
> 5. **Platform-specific:** iOS xcconfig per environment; Android `buildConfigField` per flavor; Web client-side env exposure (NEXT_PUBLIC_, VITE_), build-time vs runtime.
>
> Return findings + positives.

### Conditional Agents (run only if applicable from Phase 1)

#### Agent 2.H: Backend Concerns (only if backend/API detected)

> Merged: performance, observability, API design, concurrency, database migrations.
>
> **Performance:**
>
> - **DB:** N+1 queries (queries inside loops), missing indexes on FKs/filtered columns, unbounded queries without LIMIT, large OFFSET pagination (should use cursor).
> - **Caching:** Cache without TTL, cache key without version, caching user-specific data globally, cache stampede risks.
> - **API perf:** No pagination on list endpoints, long-running tasks in request cycle, missing timeouts on external calls, no connection pooling.
> - **Memory:** Large objects held in memory, no streaming for large files, unbounded collections.
>
> **Observability:**
>
> - **Logging:** `print`/`console.log` in production, sensitive data in logs (PII, secrets), missing correlation IDs, unstructured messages, missing log levels.
> - **Metrics:** No instrumentation, missing RED metrics (Rate, Errors, Duration), high-cardinality labels.
> - **Health checks:** No endpoint, liveness probe checking dependencies (should only check process), missing readiness probes.
> - **Resilience:** No circuit breaker for external calls, retry without exponential backoff, no timeouts on HTTP/DB calls, missing graceful shutdown.
>
> **API design (REST/GraphQL/gRPC):**
>
> - URL design: verbs in URLs (`/getUser`), inconsistent pluralization, deep nesting (>3), inconsistent casing.
> - HTTP methods: GET for mutations, POST for everything, wrong status codes.
> - Versioning: no strategy, breaking changes without version bump.
> - Responses: inconsistent error format, stack traces in prod, no pagination metadata, inconsistent date formats.
> - Validation: no request validation, accepting unknown fields silently, no Content-Type validation.
> - gRPC (if applicable): proto organization, missing field-number documentation, reserved fields not used for removed fields, missing deadlines, no health-check service, missing reflection.
>
> **Concurrency:**
>
> - Race conditions: shared mutable state without sync, TOCTOU.
> - Deadlocks: circular lock dependencies, sync calls on main thread.
> - Resource leaks: threads/executors not shutdown, channels/streams not closed, missing cancellation.
> - Language-specific: Swift (`@MainActor` missing for UI, non-Sendable crossing actors); Kotlin (`GlobalScope`, `runBlocking` on main); Go (goroutine leaks, map without mutex, channel without select timeout); JS/TS (unhandled promise rejections, event-loop blocking); Python (asyncio blocking calls, threading without Lock).
> - DB: missing optimistic locking, long transactions holding locks.
>
> **Migrations (if DB detected):**
>
> - **Safety:** Non-reversible without justification, missing down migration, data + schema migrations mixed.
> - **Zero-downtime:** Adding NOT NULL without default, renaming columns directly (use expand-contract), dropping columns still in use.
> - **Large tables:** No batching, missing online schema-change tools, `SELECT *` in migrations.
> - **Integrity:** FKs added without validating existing data, UNIQUE without checking duplicates, enum changes without handling existing values.
> - **Testing:** Migrations not tested on production-like data, rollback untested.
>
> Return findings + positives, organized by sub-area.

#### Agent 2.I: Infrastructure & Compliance (only if IaC or regulated data detected)

> Merged: Infrastructure as Code review AND compliance/privacy.
>
> **IaC (CloudFormation, SAM, Terraform, CDK, Kubernetes):**
>
> 1. **Architecture:** VPC/subnet design, LB configuration, security groups, high availability.
> 2. **Code quality:** Modularity, DRY, parameterization, outputs/exports.
> 3. **Cost:** Right-sizing, reserved capacity opportunities, waste (estimate monthly savings).
> 4. **Modern practices:** Legacy patterns where modern alternatives exist.
> 5. **CRITICAL — UserData/LaunchTemplate/LaunchConfiguration check before flagging missing observability:**
>    - Decode and read ALL UserData scripts (Base64 / `Fn::Base64`).
>    - Check for CloudWatch agent installation (`amazon-cloudwatch-agent`, `awslogs`, `cloudwatch-agent.json`).
>    - Check for logging agents (fluentd, fluent-bit, filebeat, logstash).
>    - Check LaunchTemplates referenced by AutoScaling groups.
>    - Check nested stacks and referenced templates.
>    - **DO NOT flag "No Application Log Streaming" if ANY of these are present:** CloudWatch agent in UserData, awslogs daemon config, fluent-bit/fluentd sidecar/installation, log group with retention, CloudWatch agent config files.
>
> **Compliance (only if user data or payments detected):**
>
> 1. **Data subject rights (GDPR/CCPA):** Right to access (export), right to deletion, right to rectification, consent withdrawal mechanism.
> 2. **Consent:** Collection mechanism, no pre-checked boxes, consent records with timestamps, cookie consent.
> 3. **Data handling:** PII encryption at rest/transit, PII in logs, retention policy, cross-border transfer safeguards.
> 4. **Payments (PCI):** Card data tokenized (no PAN/CVV stored), PAN masking in logs, TLS for card data.
> 5. **Healthcare (HIPAA):** PHI encryption, access controls, PHI access audit logging, BAA with vendors.
> 6. **Audit trail:** Logging of data access, consent changes, security events.
>
> Return findings + positives.

#### Agent 2.J: Localization & AI/ML (only if user-facing UI or ML detected)

> Merged: i18n/localization AND AI/ML practices. Run only the relevant sub-section.
>
> **i18n (if user-facing UI):**
>
> - **String externalization:** Hardcoded user-facing strings in code, concatenation that breaks translation, missing translation keys.
> - **Pluralization:** Missing plural forms, incorrect rules for non-English.
> - **Formatting:** Date/time/currency not locale-aware, hardcoded number/date formats.
> - **RTL:** Hardcoded left/right vs leading/trailing (iOS), missing `supportsRtl` (Android), `margin-left` vs `margin-inline-start` (CSS).
> - **Platform:** iOS strings in `Localizable.strings`/`.xcstrings`, `NSLocalizedString` usage; Android `@string/` not hardcoded, translations in `values-XX/`; Web i18n library usage, no template literals with embedded text.
> - **Workflow:** String extraction in CI, missing translations flagged.
>
> **AI/ML (if ML frameworks detected):**
>
> - **Reproducibility:** Random seeds set, model versioning, experiment tracking, no hardcoded hyperparameters.
> - **Data:** Schema/validation, train/test split verification, data leakage risks, feature versioning.
> - **Model management:** Model registry, model metadata, A/B testing capability, rollback mechanism.
> - **Security:** Models loaded from untrusted sources can execute arbitrary code on load — flag any such loading paths. Input validation for inference, model endpoint auth.
> - **Performance:** Batching for inference, GPU utilization monitoring, model optimization (quantization, pruning).
> - **Monitoring:** Drift detection, prediction logging, performance degradation alerts.
>
> Return findings + positives.

**Wait for all Phase 2 agents to complete before Phase 3.**

---

## PHASE 3: ADVERSARIAL VALIDATION

For every Phase 2 finding, launch validation agents (`general-purpose`) tasked with **disproving** the finding. Phase 2 agents are biased toward finding issues; Phase 3 must be biased toward rejection.

**Batch size: up to 10 findings per agent.** This is a deliberate cost optimization. Group findings by file or area when possible to maximize cache reuse within an agent.

### Validation Prompt (per finding)

> **Mission: Try to DISPROVE this finding. Assume it's a false positive until proven otherwise.**
>
> **Finding:** [description]
> **File:** [path]
> **Severity:** [severity]
>
> Complete ALL of these checks. If you cannot, REJECT.
>
> 1. **Quote the actual code** — read the file at the specified location and quote 5–10 lines of context. No quote = REJECT.
> 2. **Check for mitigating factors** — wrappers, middleware, base classes, configuration files (.env, config/, settings), related files providing the missing functionality, handling at a different layer (infra, framework, platform).
> 3. **Check for existing handling elsewhere** — grep the codebase for related patterns. Check imports for libraries that handle this automatically.
> 4. **Check repository settings** (CI/CD, security, branch protection findings) — `gh api`/`gh repo view`. Many settings live in GitHub UI, not config files.
> 5. **Verify context** — is the code reachable? Test/example/template file? Is severity proportionate to actual risk?
> 6. **"Would a senior engineer flag this?"** — real issue or pedantic? Would the fix provide meaningful value?
> 7. **Reasoned intent check** — could a reasonable engineer have made this choice **on purpose** given the repository context (`team_profile`, `active_authors`, `repo_age_days`, `is_private`)? List the deliberateness signals you can see: named entries vs defaults, explicit config rather than absence, inline comments explaining the choice, consistency with team size and project age, presence in merged code (not draft). If "the fix would be unrealistic or absurd for this team in this context" (e.g., requiring 2 reviewers on a 1-author repo, pinning the container's apt-installed runtime to a `.tool-version` file, rewriting 4-year-old git history to scrub a key that's no longer in the working tree, raising 90% coverage to 100%), REJECT — it's a deliberate trade-off, not an oversight. **Do not match against a hardcoded list of "intentional patterns"; reason from the signals.**
> 8. **Re-read stability test** — would a senior engineer flag this *same* finding on a *second* careful read of the same code, after having already addressed the obvious issues? Eager-eye findings (the kind only noticed during the first skim because everything is novel) are opinion, not load-bearing — they should not surface a second time. If you would *not* re-flag it on the second pass, REJECT. This filter is what keeps re-runs deterministic across stochastic sampling.
>
> **REJECT if:** any mitigating factor exists, the issue is handled elsewhere, you cannot quote the problematic code, repo settings address it, a senior engineer would not flag it, the choice is deliberate given repo context, or it would not be re-flagged on a second read.
>
> **CONFIRM only if:** all checks fail to disprove the finding.
>
> **Confidence score (CONFIRMs only, 0–100):**
>
> - **0** — false positive or pre-existing/not introduced by recent changes.
> - **25** — might be real but couldn't fully verify; stylistic and not called out by project conventions.
> - **50** — verified real but minor or rare in practice.
> - **75** — double-checked; real, likely to be hit; current approach insufficient; OR explicitly violates a project convention/CLAUDE.md rule.
> - **100** — certain, evidence directly confirms it, will happen frequently.
>
> REJECTED = confidence 0. CONFIRMED must score ≥25.
>
> **Return JSON for each finding:**
>
> ```json
> {
>   "finding_id": "...",
>   "decision": "REJECT|CONFIRM",
>   "confidence_score": 0,
>   "code_quoted": "...",
>   "mitigating_factors_found": ["..."],
>   "repo_settings_checked": ["..."],
>   "rejection_reason": "...",
>   "confirmation_evidence": "...",
>   "confidence_rationale": "..."
> }
> ```

### Auto-rejection rules

| Rule | Why |
| ---- | --- |
| No code quoted | Cannot verify the finding exists |
| Handled by framework/library | Express middleware, React sanitization, ORM parameterization |
| Handled by infrastructure | WAF, load balancer TLS, rate limiting at edge |
| Handled by repository settings | Dependabot enabled via UI, branch protection in settings |
| Handled elsewhere | Base class validates, wrapper sanitizes |
| Test/example/template code | `test/`, `examples/`, `templates/`, `__mocks__/` |
| Intentionally disabled with comment | `// nosec: false positive because…` |
| Pedantic / low-value | 2 hours to fix, saves 2 seconds |
| Wrong severity | Flagged HIGH but actually INFO |
| Deprecated/unreachable code | Never executed, scheduled for removal |
| CI/CD finding without `gh api` evidence | Repository settings not actually checked |
| Governance finding on solo/small team | Multi-reviewer/bypass/self-approve unenforceable without more engineers |
| Linter policy that isn't wholesale-disable / critical-rule-silenced / unenforced | Project policy, not oversight |
| Coverage finding when overall coverage ≥ 80% | Above the meaningful return curve |
| Secret found only in git history, not in working tree | Assume rotated; history rewrite not warranted |
| Vague commit message on a commit older than 30 days | Hygiene only matters going forward |
| Deliberate trade-off given repo context | Step 7 (reasoned intent check) rejected it |
| Would not be re-flagged on a second read | Step 8 (re-read stability) rejected it |

---

## PHASE 3.5: CONFIDENCE FILTER

Apply **tiered thresholds by severity**. More important findings survive at lower confidence because the cost of missing a Critical or High issue exceeds the cost of carrying a few mid-confidence ones; conversely, low-severity findings need higher confidence to be worth a reviewer's attention.

**Thresholds are deliberately strict for Medium/Low/Info.** Stochastic sampling means lower-confidence findings drift between runs — raising the bar on those tiers is what keeps a re-run (after fixes are merged) from generating 40 fresh comments. If a finding doesn't survive the threshold, it didn't earn its place in the main report.

After validation:

1. Drop all `decision: REJECT` findings.
2. Apply per-severity thresholds to CONFIRMED findings:
   - **🔴 Critical:** keep if `confidence_score ≥ 50`
   - **🟠 High:** keep if `confidence_score ≥ 70`
   - **🟡 Medium:** keep if `confidence_score ≥ 75`
   - **🔵 Low:** keep if `confidence_score ≥ 85`
   - **⚪ Info:** keep if `confidence_score ≥ 90`

Adjust per-run only if the user explicitly asks (e.g., "be aggressive — keep everything ≥50" for a deep audit; "release gate — only show ≥90" for a tight pre-release review). Document the override at the top of the report.

Findings filtered here go into the **"Filtered (Low Confidence)"** appendix — not lost, just spot-checkable by a human. These are typically opinion/style and unstable between runs; they belong in the appendix, not the main report.

---

## PHASE 4: REPORT GENERATION

**Pre-report verification:** all phases complete, all applicable agents returned, every CONFIRMED finding has a code quote and confidence score. If anything is incomplete, stop and finish it.

Then:

1. Aggregate kept findings.
2. Deduplicate overlapping issues.
3. Sort by severity (Critical → High → Medium → Low → Info).
4. Write `docs/code-review.md` (create the directory if needed).
5. Include positive observations from every applicable Phase 2 agent.

Do NOT include the internal phase tracking in the final report.

---

## EXCLUSIONS — DO NOT FLAG

| Item | Reason |
| ---- | ------ |
| GitHub Actions using tags (`@v4`) or branches (`@master`) | SHA pinning not required |
| Missing SBOM | Not required |
| Missing CHANGELOG.md | Not required |
| Security controls required by compliance frameworks | Intentional (AWS Security, CIS, PCI DSS) |
| File casing for GitHub files (CODEOWNERS, README, LICENSE) | GitHub is case-insensitive |
| CODEOWNERS reported missing when lowercase variant exists | Same as above |
| CODEOWNERS in `.github/` vs root vs `docs/` | All locations valid |
| README/LICENSE with different extensions | All valid |
| Any "missing file" when a case variant exists | Search case-insensitively first |
| Version numbers in config files | Use web search to verify before flagging as invalid |
| Missing/inconsistent AWS resource tags | Org-specific, enforced by SCPs/Config Rules |
| Administrators can bypass branch protection | Intentional for emergency fixes |
| Users/teams in branch-protection bypass list | Trust/governance decision |
| Missing LICENSE file in private repos | Private repos are proprietary by default |
| Missing dependabot.yml when Security Updates enabled via API | Valid configuration — must show `gh api` output |
| Dependabot finding without `gh api` evidence | Invalid — must include API output |
| macOS/Windows runners in public repos | Free; cross-platform testing is a POSITIVE |
| "Unnecessary" cross-platform testing in open source | Strength, not waste |
| Multi-reviewer / bypass-list / self-approve / single-vote governance findings on `solo`/`small` teams | Cannot enforce — team is too small; not actionable |
| Linter disables, permissive linter configs, ignore-only stubs | Project policy unless wholesale-disable / critical-rule silenced without reason / linter never run in CI |
| Coverage findings when overall coverage ≥ 80% | Above the meaningful return curve; chasing 100% has poor ROI |
| Secrets found only in git history, not in current working tree | Assume rotated; history rewrite is not warranted years later |
| Vague commit messages on commits older than 30 days | Audit only the last 30 days; older messages are historical |
| Container/runtime not pinned to a project `.tool-version` file when installed via OS package manager | Deliberate choice — distro-managed runtimes track distro releases, not project files |
| Eager-eye stylistic findings (would not be re-flagged on a second read) | Opinion, not load-bearing — appendix at most |
| Any finding that fails the reasoned intent check (Phase 3 step 7) | Deliberate trade-off given repo context |

---

## SEVERITY LEVELS

| Level | Criteria | Action |
| ----- | -------- | ------ |
| 🔴 CRITICAL | Exploitable vuln, data exposure, auth bypass, hardcoded secrets, breaking changes | Must fix before merge |
| 🟠 HIGH | Conditional security, perf regression, missing error handling, data integrity risk | Should fix before merge |
| 🟡 MEDIUM | Maintainability, minor perf, missing validation, test gaps | Fix next iteration |
| 🔵 LOW | Style, minor refactor, nice-to-have | When convenient |
| ⚪ INFO | Observations, alternatives, FYI | Awareness only |

### Version-Lag Severity (Dependencies & Runtimes)

| Condition | Severity |
| --------- | -------- |
| EOL / no security patches | CRITICAL |
| Known CVE in current version | CRITICAL |
| 2+ major versions behind | HIGH |
| 1 major version behind | MEDIUM |
| 3+ minor versions behind | MEDIUM |
| 1–2 minor versions behind | LOW |

### Code Quality Thresholds

| Metric | Warning | Flag |
| ------ | ------- | ---- |
| Method length | >60 lines | >100 lines |
| Class length | >600 lines | >1000 lines |
| Parameters | >6 | >8 |
| Nesting depth | >4 | >6 |
| Cyclomatic complexity | >15 | >25 |

---

## QUANTITATIVE REQUIREMENTS

Reports MUST include specific counts:

- Dependencies: "X total, Y outdated, Z vulnerable, W duplicate"
- Test coverage: "X of Y services tested (Z%)"
- Linter disables: "X disables across Y files"
- Silent failures: "X try?/empty catch patterns"
- Resource leaks: "X added, Y removed, Z potential leaks"
- Secrets: "Searched X files, found Y hardcoded secrets"

If full enumeration isn't feasible: state scope (e.g., "sampled 50 of 200 files"), don't fabricate counts, mark partial counts with `~` prefix. Never use vague language like "some tests exist" or "a few issues found".

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

[Checklist with ✅/⚠️/❌]

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

[Findings that survived adversarial validation but scored below threshold in Phase 3.5. Format: `severity | confidence | file:line | one-line description`. Empty section is fine if all CONFIRMED findings cleared the threshold.]

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

---

*Begin the review by executing Phase 1: launch 3 parallel `Explore` agents for initial scans.*
