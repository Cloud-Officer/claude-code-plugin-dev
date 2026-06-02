export const meta = {
  name: 'code-review-deep',
  description: 'Exhaustive multi-phase parallel code audit: scan -> analyze -> adversarially verify -> confidence-filter',
  phases: [
    { title: 'Scan', detail: '3 Explore scouts: tech stack, configs, structure' },
    { title: 'Analyze', detail: 'Core + conditional deep-analysis agents (security, bugs, deps, CI, docs, ...)' },
    { title: 'Verify', detail: 'Adversarial validation of every finding, 0-100 confidence scoring' },
  ],
}

// ---------------------------------------------------------------------------
// This script is the canonical source of truth for the code-review-deep
// analysis behaviour: the Phase 1 scout prompts, the Phase 2 analysis prompts,
// the Phase 3 adversarial-validation checklist, the governance rules, the
// exclusions, and the per-severity confidence thresholds all live here. Edit
// THIS FILE to tune what the review looks for. The command markdown only
// handles preflight (existing-report check, repo-context gathering) and the
// final report rendering from the structured data this workflow returns.
//
// Invoked by commands/code-review-deep.md via:
//   Workflow({ scriptPath: "${CLAUDE_PLUGIN_ROOT}/commands/code-review-deep.workflow.js",
//              args: { repoContext: {...}, scope: "..." } })
// ---------------------------------------------------------------------------

const input = args || {}
const repoContext = input.repoContext || {}
const scope = input.scope || 'the whole repository'

// --- Per-severity confidence thresholds (Phase 3.5) ------------------------
// Critical/High survive at lower confidence (cost of a miss is high); Medium/
// Low/Info need higher confidence so stochastic re-runs stay deterministic.
const SEV_THRESHOLDS = { critical: 50, high: 70, medium: 75, low: 85, info: 90 }

function normSev(s) {
  const t = String(s || '').toLowerCase()
  if (t.includes('critic')) return 'critical'
  if (t.includes('high')) return 'high'
  if (t.includes('med')) return 'medium'
  if (t.includes('low')) return 'low'
  return 'info'
}

function keepFinding(sev, score) {
  const threshold = SEV_THRESHOLDS[normSev(sev)] ?? 75
  return Number(score) >= threshold
}

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// --- Shared context block injected into every agent prompt -----------------
const repoBlock = [
  '## Repository context (reason about deliberate-vs-oversight from these signals)',
  '- team_profile: ' + (repoContext.team_profile ?? 'unknown'),
  '- active_authors: ' + (repoContext.active_authors ?? 'unknown'),
  '- collab_count: ' + (repoContext.collab_count ?? 'unknown'),
  '- repo_age_days: ' + (repoContext.repo_age_days ?? 'unknown'),
  '- is_private: ' + (repoContext.is_private ?? 'unknown'),
  '- owner_repo: ' + (repoContext.owner_repo ?? 'unknown'),
  '- review scope: ' + scope,
].join('\n')

const GOVERNANCE = [
  '## Governance rules on solo / small teams',
  'Solo and small teams cannot realistically enforce multi-reviewer governance.',
  'When team_profile is "solo" or "small", treat the following as DELIBERATE trade-offs',
  'and DO NOT generate findings (do not even surface as INFO):',
  '- Required reviewers < 2, or a CODEOWNERS pattern any team member can self-satisfy.',
  '- Auto-approve / auto-merge workflows that let a bot or maintainer satisfy review.',
  '- Named bypass lists in branch protection (specific user logins).',
  '- enforce_admins: false on branch protection.',
  '- pull_request_target + bot PAT effectively single-vote review.',
  '- "Single maintainer can merge."',
  'These reappear as findings only when team_profile is "medium" or "large".',
].join('\n')

const SHARED_RULES = [
  '## Output requirements',
  'Return BOTH issues[] and positives[]. Acknowledge what the team is doing well, not just defects.',
  'Each finding needs: id (use the ID prefix for its category, e.g. SEC-001, BUG-003), severity',
  '(Critical|High|Medium|Low|Info), category, file, line (when applicable), description, impact, fix.',
  'Include exact quantitative counts where the prompt asks for them (never "some"/"a few").',
  '',
  '## Web search is opt-in',
  'Use your existing knowledge. Only use WebSearch / context7 for: (a) CVE lookup against a current',
  'dependency version, (b) latest-stable-version checks for outdated-dep flagging. Skip silently on quota/timeout.',
  '',
  '## DO NOT FLAG (exclusions)',
  '- GitHub Actions pinned by tag (@v4) or branch (@master) - SHA pinning not required.',
  '- Missing SBOM, CHANGELOG.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md.',
  '- Security controls required by compliance frameworks (AWS Security, CIS, PCI DSS) - intentional.',
  '- File casing / location for GitHub files (CODEOWNERS, README, LICENSE) - GitHub is case-insensitive;',
  '  root, .github/ and docs/ are all valid. Search case-insensitively before flagging any "missing file".',
  '- Missing/inconsistent AWS resource tags - org-specific, enforced by SCPs/Config Rules.',
  '- Admins/teams in branch-protection bypass lists - intentional governance decision.',
  '- Missing LICENSE in private repos.',
  '- Missing dependabot.yml when Security Updates are enabled via API (must show gh api output).',
  '- macOS/Windows runners in PUBLIC repos - free; cross-platform testing is a POSITIVE.',
  '- Multi-reviewer / bypass-list / self-approve governance findings on solo/small teams.',
  '- Linter disables / permissive linter configs - project policy, UNLESS wholesale-disabled, a critical',
  '  rule silenced without an inline reason, or the linter is never invoked in CI.',
  '- Coverage findings when overall coverage >= 80%.',
  '- Secrets found only in git history but NOT in the current working tree - assume rotated.',
  '- Vague commit messages on commits older than 30 days.',
  '- Container/runtime not pinned to a project .tool-version when installed via the OS package manager.',
  '',
  '## Severity levels',
  '- Critical: exploitable vuln, data exposure, auth bypass, hardcoded secrets, breaking changes.',
  '- High: conditional security, perf regression, missing error handling, data integrity risk.',
  '- Medium: maintainability, minor perf, missing validation, test gaps.',
  '- Low: style, minor refactor, nice-to-have.',
  '- Info: observations, alternatives, FYI.',
  'Version-lag: EOL / known CVE = Critical; 2+ major behind = High; 1 major or 3+ minor behind = Medium;',
  '1-2 minor behind = Low. Code-quality flag thresholds: method >100 lines, class >1000, params >8,',
  'nesting >6, cyclomatic complexity >25.',
].join('\n')

function buildAnalysisPrompt(a) {
  return [
    a.prompt,
    '',
    repoBlock,
    '',
    GOVERNANCE,
    '',
    SHARED_RULES,
    '',
    'Review ' + scope + '. Return structured output: issues[], positives[], and counts where required.',
  ].join('\n')
}

// --- Phase 1 prompts -------------------------------------------------------
const P1_STACK = [
  'Identify the technology stack of this repository. Report:',
  '(1) primary languages from file extensions and package managers,',
  '(2) platforms (iOS, Android, Web, Backend, CLI, Library),',
  '(3) infrastructure (AWS/GCP/Azure/Docker/Kubernetes/none),',
  '(4) frameworks and major libraries.',
  'Also set these booleans, used to decide which conditional deep-analysis agents run:',
  '- hasBackend: any backend service / HTTP or RPC API is present.',
  '- hasIaC: Infrastructure-as-Code present (CloudFormation, SAM, Terraform, CDK, Kubernetes manifests).',
  '- hasRegulatedData: user PII, payments, or health data handled anywhere.',
  '- hasUI: any user-facing UI with display strings (mobile, web, desktop).',
  '- hasML: any AI/ML framework or model training/inference code.',
  '- hasAgentArtifacts: Claude Code plugin / agent artifacts present — any of plugin.json, .claude-plugin/, commands/*.md, skills/*/SKILL.md, agents/*.md, hooks/, or .mcp.json.',
  '- hasLLMPrompts: LLM prompts embedded in application code — calls to an LLM SDK (anthropic, @anthropic-ai/sdk, openai, google-generativeai/genai, cohere, langchain, llamaindex, AWS Bedrock / Vertex LLM APIs), inline system-prompt strings, or prompt-template files.',
].join('\n')

const P1_CONFIGS = [
  'Find ALL config files grouped by category and return their paths:',
  'CI/CD (.github/workflows, .gitlab-ci.yml, Jenkinsfile, Fastfile), dependencies (package.json, Gemfile,',
  'Podfile, Package.swift, build.gradle), lock files, environment (.env*, config/*.yml), platform',
  '(Info.plist, AndroidManifest.xml, entitlements), Docker, docs (soup.json, soup.md, architecture.md, README.md).',
].join('\n')

const P1_STRUCTURE = [
  'Map the codebase structure: count source files by directory and language, count test files and identify',
  'the test framework, identify the major modules, and estimate total lines of code.',
].join('\n')

// --- Phase 2 core agents ---------------------------------------------------
const A_SECURITY = {
  key: 'security', idPrefix: 'SEC',
  prompt: [
    'Audit for security vulnerabilities and secret exposure.',
    'Secrets: hardcoded API keys, tokens, credentials in source/config/plist/xml. Patterns: AKIA (AWS),',
    'sk_live/sk_test (Stripe), ghp_/gho_/github_pat_ (GitHub), AIzaSy (Google/Firebase), xox (Slack).',
    'Injection: SQL, command, XSS, template (SSTI), unsafe deserialization.',
    'Auth: weak password hashing, missing rate limiting, JWT issues, IDOR, hardcoded credentials.',
    'Storage: iOS uses Keychain (not UserDefaults); Android uses EncryptedSharedPreferences/Keystore',
    '(not SharedPreferences); Web uses httpOnly cookies (not localStorage); Backend uses Vault/Secrets Manager.',
    'TLS: certificate pinning across all environments.',
  ].join('\n'),
}

const A_QUALITY = {
  key: 'quality', idPrefix: 'QUAL',
  prompt: [
    'Review structural code quality and in-code comment accuracy. Bug patterns and error-handling are Agent C - do not duplicate.',
    'Quality metrics - flag explicitly: methods >100 lines, classes >1000 lines, >8 parameters, >6 nesting depth, cyclomatic complexity >25.',
    'Quality patterns: god classes, deep inheritance, giant switch/if-else, primitive obsession, stringly-typed data,',
    'boolean params that should be enums, manual loops where map/filter/reduce fit, callback hell, mutable shared state,',
    'scattered object creation that should be a factory, complex state transitions that should be a state machine, deprecated API usage.',
    'Pattern duplication: scan for byte-identical or near-identical 5+ line blocks across files. Report count and locations.',
    'Quantitative counts - REQUIRED, return exact numbers:',
    '- Linter disables: count swiftlint:disable, eslint-disable, rubocop:disable/todo, type: ignore, noqa, SuppressWarnings.',
    '  Group by rule. Report total + by-rule breakdown as INFORMATIONAL (a positive signal of awareness). DO NOT generate a',
    '  finding for the mere existence of linter disables or a permissive policy. Escalate to a finding ONLY if: (a) the linter',
    '  config disables rules wholesale; (b) a critical correctness/security rule is silenced WITHOUT an inline reason comment',
    '  (no-eval, no-unsafe-*, react/no-danger, eslint-plugin-security, rubocop-security/brakeman, hadolint DL3002/DL3004,',
    '  SQL-injection or secret-detection rules); (c) a linter config exists but NO CI step actually invokes it.',
    '- Memory observers: count addObserver vs removeObserver (Swift/Obj-C/Java). Report the delta.',
    '- Pattern duplication count: total duplicated blocks, with one example per group.',
    'Comment quality (in-code only - README/architecture is Agent G): factually inaccurate (signature mismatch),',
    'outdated references, stale TODOs without owner/ticket, restating obvious code, misleading phrasing, misplaced doc blocks,',
    'refactor scars that no longer carry information, missing critical context on complex code.',
    'DO NOT FLAG: standard license headers, generated-code comments, comments correctly explaining WHY, accurate type-system docs.',
  ].join('\n'),
}

const A_BUGS = {
  key: 'bugs', idPrefix: 'BUG',
  prompt: [
    'Review common bug patterns and the error-handling strategy. Structural quality/comments are Agent B - focus on defects and error flow.',
    'Bug patterns:',
    '1. Null/nil: missing null checks, Optional.get() without isPresent(), force unwrap (!), nullable access without guard.',
    '   Watch parser quirks where empty input returns false (not nil) and downstream &. chains short-circuit incorrectly.',
    '2. Bounds: off-by-one, index out of bounds, empty collection accessed without check.',
    '3. Arithmetic: division by zero, integer overflow, float equality, precision loss.',
    '4. Resources: file/connection/lock not closed in error paths, missing finally/defer cleanup, try-with-resources not used.',
    '5. State: invalid transitions, stale cache without invalidation, partial-failure inconsistent state, TOCTOU races.',
    'Error-handling strategy - count exact occurrences for each (REQUIRED):',
    '- Silent failures: try?, try!, empty catch {}, except: pass, _ = try?. Report exact total per type and per file.',
    '- Catch-all without rethrow / context loss.',
    '- Returning null/undefined/default on error WITHOUT logging.',
    '- Optional chaining (?.) used as error suppression.',
    '- Production fallback to mock/stub/fake implementations.',
    '- Retry exhaustion without informing the user.',
    '- Generic non-actionable user-facing error messages.',
    '- Errors written to STDOUT instead of STDERR (CLIs especially).',
    '- Narrow rescue/catch clauses (catching one subclass when the parent has many).',
    '- Error messages that drop response body / context (HTTP wrapping discarding the API errors field; e.message losing e.cause).',
    '- Validators that silently return instead of raise on malformed input.',
    'Error propagation: lost stack/cause chain, sensitive data (PII, tokens, request bodies) in error messages,',
    'missing correlation/request IDs for distributed debugging.',
    'Return exact silent-failure counts grouped by type and by file.',
  ].join('\n'),
}

const A_TESTING = {
  key: 'testing', idPrefix: 'TEST',
  prompt: [
    'Assess test coverage AND quality. Favor behavioral coverage (would tests catch real regressions?) over line coverage.',
    'Coverage ceiling: determine overall coverage from reports if available, else estimate from test_files/source_files.',
    'If overall coverage >= 80%, do NOT generate coverage findings - report coverage as a POSITIVE and skip "add tests for X".',
    'Behavioral gaps on critical paths (data loss, auth, payments, regulated data) still qualify regardless of %, but only with',
    'a concrete file:line and a 1-10 criticality rating >= 7.',
    '1. Coverage: for each service/repository/viewmodel/controller, check a test file exists; calculate percentage.',
    '2. Quality anti-patterns: tests without assertions, tests with sleep/delays, tests with logic (if/loops).',
    '3. Test types present: unit, integration, E2E, contract, security.',
    '4. Flaky indicators: current date/time use, random without seed, order-dependent tests.',
    '5. Behavioral gaps - rate each 1-10: missing negative tests, missing error-path tests, boundary edge cases, untested async/concurrency.',
    '6. Implementation-coupling smells: asserting on private methods, internal data structures, exact log strings; tests mirroring implementation 1:1.',
  ].join('\n'),
}

const A_DEPS = {
  key: 'deps', idPrefix: 'DEP',
  prompt: [
    'Dependency health AND breaking-change risk.',
    'Dependencies:',
    '1. Versions: for each dep, look up latest stable (WebSearch only for high-impact deps) and compare.',
    '2. CVEs: check known advisories (WebSearch only for high-impact deps).',
    '3. Duplicates: overlapping libraries (multiple HTTP clients, image loaders, etc.).',
    '4. Maintenance: flag abandoned packages (12+ months inactive).',
    '5. Licenses: flag copyleft (GPL/AGPL) in proprietary projects.',
    '6. SOUP: if soup.json exists (source of truth; soup.md is auto-generated), cross-reference coverage.',
    'Backwards compatibility (only if library/SDK/public API): removed/renamed public APIs, changed signatures or return',
    'types, breaking response-schema changes, removed fields or changed error codes, deprecated APIs without documented',
    'replacement or removal timeline, SemVer violations, DB schema changes that break old app versions, missing migration guide.',
    'Return a dep table (name, current, latest, severity, issues), the duplicates list, and soup_coverage "X of Y (Z%)".',
  ].join('\n'),
}

const A_REPO_CI = {
  key: 'repo-ci', idPrefix: 'CI',
  prompt: [
    'Git/repo hygiene AND CI/CD pipeline.',
    'Git & Repo:',
    '1. Branch protection on main/master (no direct pushes, required reviews, required status checks). Use gh api to inspect',
    '   ACTUAL settings. Respect team_profile: on solo/small teams do NOT flag missing multi-reviewer requirements, named bypass',
    '   lists, enforce_admins:false, auto-approve workflows, pull_request_target + bot PAT, or CODEOWNERS team self-approval.',
    '2. CODEOWNERS present (case-insensitive). Critical paths covered. On solo/small teams, "* @org/team" where the author is on',
    '   the team is legitimate - do NOT flag as self-approval.',
    '3. Commit hygiene: vague messages, missing issue refs, WIP commits on main. Only audit the last 30 days; older messages are historical.',
    '4. Stale branches >30 days, inconsistent naming.',
    '5. Secrets in git history: before flagging, confirm the secret is ALSO in the current working tree (git grep -F). If only in old',
    '   commits, assume rotated - do NOT suggest history rewrites. Only flag secrets currently in the working tree.',
    '6. Large binaries that should use Git LFS.',
    'CI/CD pipeline:',
    '1. Stages present: lint/format, type check, unit tests, integration tests, security scan (CodeQL/Semgrep/Snyk/Trivy),',
    '   dependency scan. Missing test execution = HIGH. Missing security scan = HIGH.',
    '2. GitHub Actions security: missing permissions block (HIGH), permissions: write-all (HIGH), workflow injection via untrusted',
    '   \\${{ github.event.* }} in run: (CRITICAL), pull_request_target with checkout of PR code (CRITICAL).',
    '3. Runners (cost): check is_private first. Public repo: GitHub runners are FREE - do NOT flag macOS/Windows runner cost;',
    '   cross-platform testing is a POSITIVE. Private repo: macOS costs ~10x Linux - flag only if not needed for Apple-specific code.',
    '4. Caching, timeout-minutes, matrix strategy, artifact upload, coverage reporting.',
    '5. Dependency monitoring - MANDATORY EVIDENCE CHECK before flagging. Run:',
    '     gh api "repos/<owner>/<name>" --jq \'.security_and_analysis.dependabot_security_updates.status // "disabled"\'',
    '   If output is "enabled", DO NOT flag "No Dependabot Configuration" - include the command output as evidence. Severity:',
    '   neither dependabot.yml/renovate.json NOR security updates enabled = HIGH; security updates enabled but no dependabot.yml = DO',
    '   NOT FLAG; dependabot.yml exists but missing ecosystems = MEDIUM.',
    '6. Deployment safety: environment protection rules, required reviewers for production, secrets in workflow files vs environment secrets.',
    'For any dependency-monitoring or branch-protection finding, include the actual gh api output in your response as evidence.',
  ].join('\n'),
}

const A_DOCS = {
  key: 'docs', idPrefix: 'DOC',
  prompt: [
    'Project documentation AND configuration management.',
    'Documentation - required files:',
    '- README.md sections: project name with build badge, table of contents, overview, installation, usage, contributing.',
    '- docs/architecture.md (standard): TOC, architecture diagram, software units, SOUP, critical algorithms, risk controls.',
    '- docs/architecture.md (AI/ML): datasets, preprocessing, splits, model architecture, training, evaluation, SOUP, risk controls, deployment.',
    '- CODEOWNERS (any case variant).',
    '- PR template (.github/PULL_REQUEST_TEMPLATE.md).',
    '- Issue templates ONLY if GitHub issues are enabled.',
    '- LICENSE ONLY if the repo is public (is_private = false).',
    '- API docs (OpenAPI/Swagger) if APIs exist.',
    'DO NOT FLAG missing: CHANGELOG.md, CONTRIBUTING.md as a separate file, SBOM, CODE_OF_CONDUCT.md, SECURITY.md.',
    'Content verification: files must have real content (not stubs). soup.json must have real dependency data. Empty/stub doc = MEDIUM.',
    'Case-insensitive search is MANDATORY (GitHub treats CODEOWNERS/codeowners, README/readme, LICENSE/license as equivalent;',
    'root, .github/, docs/ are all valid for CODEOWNERS). Search case-insensitively before flagging anything missing.',
    'Configuration management:',
    '1. Environment separation: hardcoded values that vary by environment, if env == "prod" logic, prod config in non-prod builds.',
    '2. Secrets in config files: should use vault/secrets manager. Missing .env.example.',
    '3. Startup validation: required config validated at startup, fail-fast on missing/invalid config.',
    '4. Feature flags: inconsistent naming, no cleanup of old flags, undocumented dependencies.',
    '5. Platform-specific: iOS xcconfig per environment; Android buildConfigField per flavor; Web client-side env exposure',
    '   (NEXT_PUBLIC_, VITE_), build-time vs runtime.',
  ].join('\n'),
}

// --- Phase 2 conditional agents -------------------------------------------
const A_BACKEND = {
  key: 'backend', idPrefix: 'PERF',
  prompt: [
    'Backend concerns (only because a backend/API was detected): performance, observability, API design, concurrency, DB migrations.',
    'Performance - DB: N+1 queries, missing indexes on FKs/filtered columns, unbounded queries without LIMIT, large OFFSET pagination',
    '(use cursor). Caching: no TTL, key without version, caching user-specific data globally, cache stampede. API: no pagination on list',
    'endpoints, long-running tasks in request cycle, missing timeouts on external calls, no connection pooling. Memory: large objects held',
    'in memory, no streaming for large files, unbounded collections.',
    'Observability - logging: print/console.log in production, sensitive data in logs, missing correlation IDs, unstructured messages,',
    'missing log levels. Metrics: no instrumentation, missing RED metrics, high-cardinality labels. Health checks: no endpoint, liveness',
    'probe checking dependencies (should only check process), missing readiness probes. Resilience: no circuit breaker, retry without',
    'exponential backoff, no timeouts, missing graceful shutdown.',
    'API design (REST/GraphQL/gRPC): verbs in URLs, inconsistent pluralization, deep nesting >3, inconsistent casing; GET for mutations,',
    'wrong status codes; no versioning strategy; inconsistent error format, stack traces in prod, no pagination metadata; no request',
    'validation, silently accepting unknown fields, no Content-Type validation; gRPC: proto organization, missing field-number docs,',
    'reserved fields unused for removed fields, missing deadlines, no health-check service, missing reflection.',
    'Concurrency: shared mutable state without sync, TOCTOU; circular lock dependencies, sync calls on main thread; threads/executors',
    'not shutdown, channels/streams not closed, missing cancellation; language-specific (Swift @MainActor missing, non-Sendable crossing',
    'actors; Kotlin GlobalScope/runBlocking on main; Go goroutine leaks, map without mutex, channel without select timeout; JS/TS unhandled',
    'promise rejections, event-loop blocking; Python asyncio blocking calls, threading without Lock); DB: missing optimistic locking, long',
    'transactions holding locks.',
    'Migrations (if DB detected): non-reversible without justification, missing down migration, data+schema mixed; adding NOT NULL without',
    'default, renaming columns directly (use expand-contract), dropping columns still in use; no batching on large tables, SELECT * in',
    'migrations; FKs added without validating existing data, UNIQUE without checking duplicates, enum changes without handling existing',
    'values; migrations not tested on production-like data, rollback untested.',
    'Organize findings by sub-area.',
  ].join('\n'),
}

const A_INFRA = {
  key: 'infra-compliance', idPrefix: 'IAC',
  prompt: [
    'Infrastructure-as-Code review AND compliance/privacy (only because IaC or regulated data was detected).',
    'IaC (CloudFormation, SAM, Terraform, CDK, Kubernetes):',
    '1. Architecture: VPC/subnet design, LB configuration, security groups, high availability.',
    '2. Code quality: modularity, DRY, parameterization, outputs/exports.',
    '3. Cost: right-sizing, reserved capacity opportunities, waste (estimate monthly savings).',
    '4. Modern practices: legacy patterns where modern alternatives exist.',
    '5. CRITICAL - UserData/LaunchTemplate/LaunchConfiguration check BEFORE flagging missing observability: decode and read ALL UserData',
    '   scripts (Base64 / Fn::Base64); check for CloudWatch agent install (amazon-cloudwatch-agent, awslogs, cloudwatch-agent.json),',
    '   logging agents (fluentd, fluent-bit, filebeat, logstash), LaunchTemplates referenced by AutoScaling groups, nested/referenced',
    '   stacks. DO NOT flag "No Application Log Streaming" if ANY of these are present.',
    'Compliance (only if user data or payments detected):',
    '1. Data subject rights (GDPR/CCPA): right to access (export), deletion, rectification, consent withdrawal.',
    '2. Consent: collection mechanism, no pre-checked boxes, consent records with timestamps, cookie consent.',
    '3. Data handling: PII encryption at rest/transit, PII in logs, retention policy, cross-border transfer safeguards.',
    '4. Payments (PCI): card data tokenized (no PAN/CVV stored), PAN masking in logs, TLS for card data.',
    '5. Healthcare (HIPAA): PHI encryption, access controls, PHI access audit logging, BAA with vendors.',
    '6. Audit trail: logging of data access, consent changes, security events.',
  ].join('\n'),
}

const A_LOCALE_ML = {
  key: 'i18n-ml', idPrefix: 'I18N',
  prompt: [
    'Localization AND AI/ML practices (only because user-facing UI or ML was detected). Run only the relevant sub-section.',
    'i18n (if user-facing UI): hardcoded user-facing strings, concatenation that breaks translation, missing translation keys;',
    'missing plural forms, incorrect rules for non-English; date/time/currency not locale-aware, hardcoded number/date formats;',
    'RTL: hardcoded left/right vs leading/trailing (iOS), missing supportsRtl (Android), margin-left vs margin-inline-start (CSS);',
    'platform: iOS strings in Localizable.strings/.xcstrings, NSLocalizedString usage; Android @string/ not hardcoded, translations in',
    'values-XX/; Web i18n library usage, no template literals with embedded text; workflow: string extraction in CI, missing translations flagged.',
    'AI/ML (if ML frameworks detected): reproducibility (random seeds set, model versioning, experiment tracking, no hardcoded',
    'hyperparameters); data (schema/validation, train/test split verification, data leakage, feature versioning); model management',
    '(registry, metadata, A/B testing, rollback); security (models from untrusted sources can execute arbitrary code on load - flag any',
    'such loading path; input validation for inference, model endpoint auth); performance (batching, GPU utilization monitoring,',
    'quantization/pruning); monitoring (drift detection, prediction logging, degradation alerts). For the I18N findings use prefix I18N;',
    'for AI/ML findings use prefix ML.',
  ].join('\n'),
}

const A_PROMPTS = {
  key: 'prompt-artifacts', idPrefix: 'PROMPT',
  prompt: [
    'Review AI prompt-engineering quality (only because Claude Code plugin artifacts and/or embedded LLM prompts were detected). Run ONLY the relevant sub-section(s).',
    'Treat prompts and instruction files as load-bearing source: vague, conflicting, or stale instructions are real defects, not style nits.',
    '',
    'Claude Code plugin artifacts (if detected) — prefix PLUGIN. Review commands/*.md, skills/*/SKILL.md, agents/*.md, hooks/*, .mcp.json, plugin.json against Claude Code plugin best practices:',
    '1. Frontmatter validity: commands need a description (+ argument-hint when they take args); skills need name + description (+ allowed-tools when they run tools); agents need name + a "when to use" description + tools. Flag missing, malformed, or duplicate YAML keys, and descriptions that exceed practical length.',
    '2. Triggering-description quality: skill/agent/command descriptions must state WHEN to invoke (concrete trigger phrases and scenarios), not just what they do. Vague descriptions ("helps with code") cause mis-triggering or silent non-triggering — flag them and propose a sharper description.',
    '3. Tool scoping (allowed-tools / tools): flag over-broad grants (unbounded Bash, wildcards wider than needed), tools the prompt clearly uses but does not declare, and declared tools never used.',
    '4. Instruction quality: ambiguous or contradictory instructions within a file, duplicated or over-long passages, gates/forcing-functions that can be silently skipped, and broken internal references — numbered-step or section cross-references and file links that point at a wrong, renamed, or non-existent target. Verify every "step N" / file reference actually resolves; a stale ref is a defect.',
    '5. Progressive disclosure: a SKILL.md/command that inlines large reference material that should be split into on-demand files; flag bloat that wastes context on every load.',
    '6. Portability: hardcoded absolute or machine/user-specific paths where ${CLAUDE_PLUGIN_ROOT} or a repo-relative path should be used.',
    '7. Hook safety: hooks running shell with unsanitized inputs, missing/overbroad matchers, no exit-code handling, or destructive commands without guards.',
    '8. MCP config (.mcp.json): hardcoded secrets/tokens (should reference env vars), malformed server definitions, missing ${CLAUDE_PLUGIN_ROOT} for bundled server paths.',
    '',
    'Embedded LLM prompts in application code (if detected) — prefix PROMPT. Review prompt strings/templates and LLM SDK call sites:',
    '1. Prompt injection: untrusted user input or tool/retrieval output concatenated into a prompt without delimiting or guarding; user content able to override system instructions. CRITICAL when the model then drives tools, SQL, code execution, file writes, or outbound messages.',
    '2. Secret / PII exposure: API keys, credentials, or PII interpolated into prompts, or full prompts/responses logged.',
    '3. Model hygiene: hardcoded model IDs that are deprecated/retired, or duplicated as string literals across the codebase instead of a single constant; flag stale model versions.',
    '4. Output handling: parsing free text with regex/string-splitting where structured outputs / tool use / JSON mode would be reliable; no handling for truncated, empty, or refused responses.',
    '5. Robustness: missing max_tokens (unbounded output), no timeout, no retry-with-backoff, and no rate-limit handling on the API call.',
    '6. Cost & caching: large static context (system prompt, few-shot examples, docs) re-sent every call without prompt caching; redundant or oversized context.',
    '7. Instruction quality: conflicting or ambiguous system instructions, contradictory few-shot examples, instructions relying on a model capability not guaranteed.',
    '8. Evaluation: no tests/evals locking in prompt behavior on critical paths — report as a gap with a criticality rating, do not nitpick.',
    '',
    'For Claude Code plugin findings use prefix PLUGIN; for embedded-LLM-prompt findings use prefix PROMPT. Quote the exact offending text/line. Acknowledge well-crafted prompts in positives[].',
  ].join('\n'),
}

const CORE_AGENTS = [A_SECURITY, A_QUALITY, A_BUGS, A_TESTING, A_DEPS, A_REPO_CI, A_DOCS]

// --- Phase 3 adversarial validation prompt ---------------------------------
function buildVerifyPrompt(findings) {
  const list = findings.map(f => ({
    finding_id: f.id,
    severity: f.severity,
    category: f.category,
    file: f.file,
    line: f.line,
    description: f.description,
  }))
  return [
    'Mission: try to DISPROVE each finding below. Phase 2 was biased toward finding issues; you must be biased toward REJECTION.',
    'Assume every finding is a false positive until proven otherwise.',
    '',
    repoBlock,
    '',
    'Findings to validate (JSON):',
    JSON.stringify(list, null, 2),
    '',
    'For EACH finding, complete ALL of these checks. If you cannot complete a check, REJECT.',
    '1. Quote the actual code - read the file at the location and quote 5-10 lines of context. No quote = REJECT.',
    '2. Check for mitigating factors - wrappers, middleware, base classes, config files (.env, config/, settings), related files',
    '   providing the missing functionality, handling at a different layer (infra, framework, platform).',
    '3. Check for existing handling elsewhere - grep for related patterns; check imports for libraries that handle this automatically.',
    '4. Check repository settings for CI/CD, security, and branch-protection findings via gh api / gh repo view. Many settings live in',
    '   the GitHub UI, not config files. A CI/CD or governance finding with no gh api evidence must be REJECTED.',
    '5. Verify context - is the code reachable? Test/example/template file? Is the severity proportionate to the actual risk?',
    '6. "Would a senior engineer flag this?" - real issue or pedantic? Would the fix provide meaningful value?',
    '7. Reasoned intent check - could a reasonable engineer have made this choice ON PURPOSE given the repo context (team_profile,',
    '   active_authors, repo_age_days, is_private)? List the deliberateness signals (named entries vs defaults, explicit config rather',
    '   than absence, inline comments, consistency with team size and project age, presence in merged code). If the fix would be',
    '   unrealistic/absurd for this team (e.g. requiring 2 reviewers on a 1-author repo, pinning an apt-installed runtime to a',
    '   .tool-version file, rewriting old git history to scrub a key no longer in the working tree, raising 90% coverage to 100%),',
    '   REJECT - it is a deliberate trade-off. Reason from the signals; do not match a hardcoded list.',
    '8. Re-read stability test - would a senior engineer flag this SAME finding on a SECOND careful read, after the obvious issues are',
    '   addressed? Eager-eye findings (only noticed on the first skim) are opinion, not load-bearing. If you would not re-flag it on a',
    '   second pass, REJECT. This is what keeps re-runs deterministic across stochastic sampling.',
    '',
    'REJECT if: any mitigating factor exists, the issue is handled elsewhere, you cannot quote the code, repo settings address it, a',
    'senior engineer would not flag it, the choice is deliberate given repo context, or it would not be re-flagged on a second read.',
    'CONFIRM only if all checks fail to disprove the finding.',
    '',
    'Confidence score (CONFIRMs only): 0 = false positive / pre-existing; 25 = might be real but unverified or purely stylistic;',
    '50 = verified real but minor/rare; 75 = double-checked, real, likely to be hit, OR explicitly violates a project convention;',
    '100 = certain, evidence directly confirms it, will happen frequently. REJECTED = 0. CONFIRMED must score >= 25.',
    '',
    'Return structured output: verdicts[] with one entry per finding_id, each having decision (REJECT|CONFIRM), confidence_score,',
    'code_quoted, mitigating_factors_found[], repo_settings_checked[], rejection_reason, confirmation_evidence, confidence_rationale.',
  ].join('\n')
}

// --- Schemas ---------------------------------------------------------------
const STACK_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    languages: { type: 'array', items: { type: 'string' } },
    platforms: { type: 'array', items: { type: 'string' } },
    infrastructure: { type: 'array', items: { type: 'string' } },
    frameworks: { type: 'array', items: { type: 'string' } },
    hasBackend: { type: 'boolean' },
    hasIaC: { type: 'boolean' },
    hasRegulatedData: { type: 'boolean' },
    hasUI: { type: 'boolean' },
    hasML: { type: 'boolean' },
    hasAgentArtifacts: { type: 'boolean' },
    hasLLMPrompts: { type: 'boolean' },
  },
  required: ['languages', 'platforms', 'hasBackend', 'hasIaC', 'hasRegulatedData', 'hasUI', 'hasML', 'hasAgentArtifacts', 'hasLLMPrompts'],
}

const GENERIC_SCAN_SCHEMA = { type: 'object', additionalProperties: true, properties: { summary: { type: 'string' } } }

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          id: { type: 'string' },
          severity: { type: 'string' },
          category: { type: 'string' },
          file: { type: 'string' },
          line: { type: ['integer', 'string', 'null'] },
          description: { type: 'string' },
          impact: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['id', 'severity', 'category', 'description', 'impact', 'fix'],
      },
    },
    positives: { type: 'array', items: { type: 'string' } },
    counts: { type: 'object', additionalProperties: true },
  },
  required: ['issues', 'positives'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          finding_id: { type: 'string' },
          decision: { type: 'string', enum: ['REJECT', 'CONFIRM'] },
          confidence_score: { type: 'integer' },
          code_quoted: { type: 'string' },
          mitigating_factors_found: { type: 'array', items: { type: 'string' } },
          repo_settings_checked: { type: 'array', items: { type: 'string' } },
          rejection_reason: { type: 'string' },
          confirmation_evidence: { type: 'string' },
          confidence_rationale: { type: 'string' },
        },
        required: ['finding_id', 'decision', 'confidence_score'],
      },
    },
  },
  required: ['verdicts'],
}

// ===========================================================================
// PHASE 1: INITIAL SCANS (3 parallel Explore scouts)
// ===========================================================================
phase('Scan')
const scan = await parallel([
  () => agent(P1_STACK, { label: 'scan:stack', phase: 'Scan', schema: STACK_SCHEMA, agentType: 'Explore' }),
  () => agent(P1_CONFIGS, { label: 'scan:configs', phase: 'Scan', schema: GENERIC_SCAN_SCHEMA, agentType: 'Explore' }),
  () => agent(P1_STRUCTURE, { label: 'scan:structure', phase: 'Scan', schema: GENERIC_SCAN_SCHEMA, agentType: 'Explore' }),
])
const stack = scan[0] || {}
const configs = scan[1] || {}
const structure = scan[2] || {}

// Decide which conditional agents apply (deterministic, from Phase 1 booleans).
const conditional = []
if (stack.hasBackend) conditional.push(A_BACKEND)
if (stack.hasIaC || stack.hasRegulatedData) conditional.push(A_INFRA)
if (stack.hasUI || stack.hasML) conditional.push(A_LOCALE_ML)
if (stack.hasAgentArtifacts || stack.hasLLMPrompts) conditional.push(A_PROMPTS)
const selected = [...CORE_AGENTS, ...conditional]
log('Phase 1 done. Running ' + selected.length + ' analysis agents: ' + selected.map(a => a.key).join(', '))

// ===========================================================================
// PHASE 2 -> PHASE 3 as a pipeline: each agent's findings are adversarially
// verified as soon as that agent returns (no global barrier). Verification is
// batched up to 10 findings per validator to preserve cache reuse / cost.
// ===========================================================================
phase('Analyze')
const reviewed = await pipeline(
  selected,
  (a) => agent(buildAnalysisPrompt(a), { label: 'analyze:' + a.key, phase: 'Analyze', schema: FINDINGS_SCHEMA, agentType: 'general-purpose' })
    .then(r => ({ agentDef: a, review: r })),
  async ({ agentDef, review }) => {
    const issues = (review && Array.isArray(review.issues)) ? review.issues : []
    if (!issues.length) return { agentDef, review, verdicts: [] }
    const batches = await parallel(
      chunk(issues, 10).map((group, i) => () =>
        agent(buildVerifyPrompt(group), { label: 'verify:' + agentDef.key + '#' + i, phase: 'Verify', schema: VERDICT_SCHEMA, agentType: 'general-purpose' })
      )
    )
    const verdicts = batches.filter(Boolean).flatMap(b => (b && Array.isArray(b.verdicts)) ? b.verdicts : [])
    return { agentDef, review, verdicts }
  }
)

// ===========================================================================
// PHASE 3.5: assemble, keep CONFIRMs, apply per-severity confidence thresholds
// ===========================================================================
const confirmed = []
const positives = []
const counts = {}
for (const item of reviewed.filter(Boolean)) {
  const { agentDef, review, verdicts } = item
  if (!review) continue
  for (const p of (review.positives || [])) positives.push({ area: agentDef.key, text: p })
  if (review.counts) counts[agentDef.key] = review.counts
  const byId = new Map((verdicts || []).map(v => [v.finding_id, v]))
  for (const f of (review.issues || [])) {
    const v = byId.get(f.id)
    if (!v || v.decision !== 'CONFIRM') continue
    confirmed.push({
      ...f,
      agent: agentDef.key,
      confidence_score: v.confidence_score,
      code_quoted: v.code_quoted,
      confirmation_evidence: v.confirmation_evidence,
    })
  }
}

const kept = confirmed.filter(f => keepFinding(f.severity, f.confidence_score))
const filtered = confirmed.filter(f => !keepFinding(f.severity, f.confidence_score))

log('Confirmed ' + confirmed.length + ' findings; ' + kept.length + ' cleared the confidence threshold, ' + filtered.length + ' went to the appendix.')

export default {
  phase1: { stack, configs, structure },
  agents_run: selected.map(a => a.key),
  kept,
  filtered,
  positives,
  counts,
}
