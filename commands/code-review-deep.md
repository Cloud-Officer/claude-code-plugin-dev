# Deep Code Review (Parallel Agent Strategy)

You are a senior staff engineer orchestrating an exhaustive code audit using parallel agents. Be thorough, specific, quantitative, and educational.

**IMPORTANT: Balance criticism with recognition.** A good code review acknowledges what the team is doing well, not just what needs improvement. Actively look for and document positive patterns, good architectural decisions, and best practices being followed. The report should feel constructive and encouraging, not purely negative.

**IMPORTANT: All agents inherit the current model. Do NOT specify a model parameter - let agents use the same model as the parent.**

---

## CRITICAL: Mandatory Phase Tracking

**You MUST maintain a phase completion log throughout execution.** This ensures consistent, reproducible results across runs.

**Before starting, create this tracking structure and update it after each phase:**

```text
=== CODE REVIEW PHASE LOG ===
[ ] Pre-Flight Check
    - existing_report: (pending)
    - user_decision: (pending) - use_existing/delete_and_rerun/N/A

[ ] Phase 1: Initial Scans (3 agents)
    [ ] Agent 1.1 Tech Stack - status: (pending), result_received: (pending)
        - languages: (pending)
        - platforms: (pending)
        - infrastructure: (pending)
        - frameworks: (pending)
    [ ] Agent 1.2 Config Files - status: (pending), result_received: (pending)
        - categories_found: (pending)
    [ ] Agent 1.3 Codebase Structure - status: (pending), result_received: (pending)
        - source_files: (pending)
        - test_files: (pending)
        - estimated_loc: (pending)

[ ] Phase 2: Deep Analysis (conditional agents based on Phase 1)
    Core Agents (always run):
    [ ] Agent 2.1 Security - status: (pending), findings: (pending)
    [ ] Agent 2.2 Dependencies - status: (pending), findings: (pending)
    [ ] Agent 2.3 Code Quality - status: (pending), findings: (pending)
    [ ] Agent 2.4 Testing - status: (pending), findings: (pending)
    [ ] Agent 2.12 Git Hygiene - status: (pending), findings: (pending)
    [ ] Agent 2.15 Config Management - status: (pending), findings: (pending)
    [ ] Agent 2.16 Bug Patterns - status: (pending), findings: (pending)
    [ ] Agent 2.18 Documentation - status: (pending), findings: (pending)
    [ ] Agent 2.19 CI/CD - status: (pending), findings: (pending)

    Conditional Agents (mark N/A if not applicable):
    [ ] Agent 2.5 IaC - applicable: (pending), status: (pending), findings: (pending)
    [ ] Agent 2.6 Performance - applicable: (pending), status: (pending), findings: (pending)
    [ ] Agent 2.7 Observability - applicable: (pending), status: (pending), findings: (pending)
    [ ] Agent 2.8 API Design - applicable: (pending), status: (pending), findings: (pending)
    [ ] Agent 2.9 Concurrency - applicable: (pending), status: (pending), findings: (pending)
    [ ] Agent 2.10 AI/ML - applicable: (pending), status: (pending), findings: (pending)
    [ ] Agent 2.11 Compliance - applicable: (pending), status: (pending), findings: (pending)
    [ ] Agent 2.13 Migrations - applicable: (pending), status: (pending), findings: (pending)
    [ ] Agent 2.14 i18n - applicable: (pending), status: (pending), findings: (pending)
    [ ] Agent 2.17 Backwards Compat - applicable: (pending), status: (pending), findings: (pending)

[ ] Phase 3: Validation
    - total_findings_to_validate: (pending)
    - findings_validated: (pending)
    - findings_rejected: (pending)

[ ] Phase 4: Report Generation
    - all_phases_complete: (pending)
    - health_score: (pending)
    - total_findings: (pending)
    - positives_documented: (pending)
=== END PHASE LOG ===
```

**COMPLETION REQUIREMENTS:**

1. **Phase 1 MUST complete before Phase 2** - All 3 agents must return results
2. **Phase 2 agents determined by Phase 1** - Mark conditional agents as N/A if not applicable
3. **ALL Phase 2 agents must complete before Phase 3** - Do not skip agents
4. **Phase 3 must validate ALL findings** - Not just a sample
5. **Phase 4 report must include the completed phase log** - Proves all phases executed

**DO NOT SKIP PHASES OR AGENTS.** Even if early phases suggest no issues in an area, run ALL applicable agents. Issues are often only revealed through thorough analysis.

---

## EXECUTION OVERVIEW

This review uses **parallel agents** for speed and thoroughness. Execute phases in order, but launch agents within each phase **simultaneously in a single message**.

| Phase | Parallel Agents | Purpose |
| ----- | --------------- | ------- |
| 1 | 3 | Quick scans: tech stack, configs, structure |
| 2 | 4-19 | Core (security, deps, quality, tests) + conditional (IaC, perf, observability, API, concurrency, AI/ML, compliance, git, migrations, i18n, config, bugs, backwards compat, docs, CI/CD) |
| 3 | N (per finding) | Validate ALL findings (all severity levels) |
| 4 | 1 (you) | Aggregate and generate report |

---

## PRE-FLIGHT CHECK: Existing Report Detection

**Before starting any analysis, check if `CODE_REVIEW_REPORT.md` already exists in the repository root.**

If the report exists, use the AskUserQuestion tool to ask the user:

**Question:** "A code review report already exists (`CODE_REVIEW_REPORT.md`). What would you like to do?"

**Options:**

1. **Use existing report** - Skip analysis and use the current report (useful for creating Jira issues or reviewing findings)
2. **Delete and re-run full analysis** - Remove the existing report and perform a fresh code review

If the user chooses option 1, read the existing `CODE_REVIEW_REPORT.md` file, summarize the findings (count by severity), and wait for further instructions (e.g., "create jira issues").

If the user chooses option 2, delete the existing `CODE_REVIEW_REPORT.md` and proceed with Phase 1.

---

## PHASE 1: INITIAL SCANS (Launch 3 Agents in Parallel)

**Launch these 3 agents simultaneously in a single message using the Task tool:**

### Agent 1.1: Tech Stack Detection

**Prompt:**
> Analyze this codebase to identify:
>
> 1. Primary language(s) from file extensions and package managers
> 2. Platform(s): iOS, Android, Web, Backend, CLI, Library
> 3. Infrastructure: AWS, GCP, Azure, Docker, Kubernetes, or none
> 4. Frameworks and major libraries in use
>
> Return as JSON: `{languages, platforms, infrastructure, frameworks}`

### Agent 1.2: Config File Inventory

**Prompt:**
> Find and list ALL configuration files in this codebase:
>
> - CI/CD: .github/workflows/*, .gitlab-ci.yml, Jenkinsfile, Fastfile
> - Dependencies: package.json, Gemfile, Podfile, Package.swift, build.gradle
> - Lock files: package-lock.json, Gemfile.lock, Package.resolved
> - Environment: .env*, config/*.yml
> - Platform: Info.plist, AndroidManifest.xml, entitlements
> - Docker: Dockerfile, docker-compose.yml
> - Docs: soup.json, soup.md, architecture.md, README.md
>
> Return as JSON grouped by category with file paths.

### Agent 1.3: Codebase Structure

**Prompt:**
> Analyze the codebase structure:
>
> 1. Count source files by directory and language
> 2. Count test files and identify test framework
> 3. Identify major modules/packages
> 4. Calculate approximate lines of code
>
> Return as JSON: `{source_files, test_files, modules, estimated_loc}`

**Wait for all Phase 1 agents to complete before proceeding to Phase 2.**

---

## PHASE 2: DEEP ANALYSIS (Launch 4 Agents in Parallel)

**Using results from Phase 1, launch these agents simultaneously.**

**CRITICAL FOR ALL AGENTS: In addition to finding issues, each agent MUST also identify and report positive patterns, good practices, and well-implemented features in their domain. Return both `issues` and `positives` in the JSON response.**

### Agent 2.1: Security Audit

**Prompt:**
> Perform a security audit of this codebase. Search for:
>
> **Secrets:** Hardcoded API keys, tokens, credentials in source files, config files, plist, xml resources. Check for AWS keys (AKIA), Stripe keys, GitHub tokens, Firebase keys.
>
> **Injection:** SQL injection, command injection, XSS, template injection, deserialization vulnerabilities.
>
> **Auth:** Weak password hashing, missing rate limiting, JWT issues, IDOR, hardcoded credentials.
>
> **Storage:** Verify secrets use secure storage (Keychain/Keystore not UserDefaults/SharedPreferences).
>
> **TLS:** Check certificate pinning across all environments.
>
> Return findings as JSON array: `[{id, severity, category, file, line, description, impact, fix}]`

### Agent 2.2: Dependency Analysis

**Prompt:**
> Analyze all dependencies in this codebase:
>
> 1. **Versions:** For each dependency, use web search to find latest stable version. Compare against current.
> 2. **Security:** Check for known CVEs or security advisories.
> 3. **Duplicates:** Find overlapping libraries (multiple image loaders, HTTP clients, etc.)
> 4. **Maintenance:** Flag abandoned packages (12+ months inactive).
> 5. **Licenses:** Flag copyleft (GPL/AGPL) in proprietary projects.
> 6. **SOUP:** If soup.json exists (source of truth; soup.md is auto-generated from it), cross-reference coverage.
>
> Return as JSON: `{dependencies: [{name, current, latest, severity, issues}], duplicates: [{libs, overlap}], soup_coverage: "X of Y (Z%)"}`

### Agent 2.3: Code Quality Review

**Prompt:**
> Review code quality in this codebase:
>
> 1. **Metrics:** Flag methods >100 lines, classes >1000 lines, >8 parameters, >6 nesting depth, cyclomatic complexity >25.
> 2. **Error Handling:** Count silent failures (try?, empty catch, except pass). Report exact count.
> 3. **Memory:** Count addObserver vs removeObserver calls. Flag potential leaks.
> 4. **Linter Disables:** Count all disable comments (swiftlint:disable, eslint-disable, etc.)
> 5. **Deprecated APIs:** Find deprecated API usage.
> 6. **Code Pattern Improvements:** Flag when code could benefit from refactoring:
>    - **Structural:** God classes → extract, deep inheritance → composition, giant switch/if-else → strategy/polymorphism, constructor with 5+ params → builder pattern, scattered object creation → factory, global singletons → dependency injection
>    - **Behavioral:** Callback hell / nested callbacks → async/await or Promises, hardcoded algorithms → strategy pattern, complex state transitions → state machine, repeated null checks → Null Object or Optional
>    - **Data:** Primitive obsession → Value Objects (Email, Money, UserId types), stringly-typed data → enums/typed constants, boolean parameters → enum or separate methods, returning null from collections → return empty, mutable shared state → immutable structures
>    - **Modern Language Features:** Manual loops with accumulators → map/filter/reduce, type checks + casts → pattern matching, completion handlers → async/await, manual thread management → structured concurrency
>
> Return as JSON: `{metrics: [{file, issue, value}], silent_failures: {count, files}, memory_leaks: {added, removed, delta}, linter_disables: {count, by_rule}, deprecated: [{api, file, replacement}], pattern_improvements: [{file, current_pattern, recommended_pattern, rationale, effort}]}`

### Agent 2.4: Testing Assessment

**Prompt:**
> Assess test coverage in this codebase:
>
> 1. **Coverage:** For each service/repository/viewmodel/controller, check if corresponding test file exists. Calculate percentage.
> 2. **Quality:** Flag tests without assertions, tests with sleep/delays, tests with logic (if/loops).
> 3. **Types:** Check presence of unit, integration, E2E, contract, security tests.
> 4. **Flaky Indicators:** Flag use of current date/time, random without seed, order-dependent tests.
>
> Return as JSON: `{coverage: {services: "X/Y (Z%)", viewmodels: "X/Y (Z%)", missing: [files]}, anti_patterns: [{type, file, count}], test_types: {unit: bool, integration: bool, e2e: bool}}`

### Agent 2.5: Infrastructure as Code Review (If IaC detected in Phase 1)

**Prompt:**
> Review all Infrastructure as Code files (CloudFormation, SAM, Terraform, CDK, Kubernetes).
>
> **Use web search to find current best practices and guidelines for:**
>
> - AWS Well-Architected Framework (latest recommendations)
> - CloudFormation/Terraform best practices (current year)
> - VPC design patterns and subnet strategies
> - Load balancer configuration guidelines
> - Cost optimization recommendations
>
> **Evaluate the IaC against current standards for:**
>
> 1. **Architecture:** VPC/subnet design, LB configuration, security groups, high availability
> 2. **Code Quality:** Modularity, DRY, parameterization, outputs/exports
> 3. **Cost Optimization:** Right-sizing, reserved capacity opportunities, waste elimination (estimate monthly savings)
> 4. **Modern Practices:** Are legacy patterns used where modern alternatives exist?
>
> **CRITICAL - Check UserData/LaunchTemplate/LaunchConfiguration thoroughly:**
> Before flagging missing observability/logging, you MUST:
>
> - Decode and read ALL UserData scripts (Base64 encoded or Fn::Base64)
> - Check for CloudWatch agent installation (amazon-cloudwatch-agent, awslogs, cloudwatch-agent.json)
> - Check for logging agent installation (fluentd, fluent-bit, filebeat, logstash)
> - Check LaunchTemplates referenced by AutoScaling groups
> - Check nested stacks and referenced templates
> - Look for `amazon-cloudwatch-agent-ctl` or `awslogs` service configuration
>
> **DO NOT flag "No Application Log Streaming" if ANY of these are present:**
>
> - CloudWatch agent installation in UserData
> - awslogs daemon configuration
> - Fluent-bit/Fluentd sidecar or installation
> - Log group creation with retention policy
> - CloudWatch agent configuration files (cloudwatch-agent.json, amazon-cloudwatch-agent.json)
>
> Return as JSON: `{architecture: [{issue, severity, recommendation, source_guideline}], cost_optimization: [{finding, estimated_monthly_savings}], modernization: [{legacy_pattern, modern_alternative}], observability: {cloudwatch_agent_found: bool, log_groups: [], userdata_logging: [{instance, agent, config_file}]}}`

### Agent 2.6: Performance Review (If backend/API detected in Phase 1)

**Prompt:**
> Review the codebase for performance issues.
>
> **Use web search to find current best practices for:**
>
> - Database query optimization (N+1, indexing, pagination)
> - Caching strategies and patterns
> - API performance guidelines
>
> **Check for:**
>
> 1. **Database:** N+1 queries (queries inside loops), missing indexes on foreign keys/filtered columns, unbounded queries without LIMIT, large OFFSET pagination (should use cursor)
> 2. **Caching:** Cache without TTL, cache key without version, caching user-specific data globally, cache stampede risks
> 3. **API:** No pagination on list endpoints, long-running tasks in request cycle, missing timeouts on external calls, no connection pooling
> 4. **Memory:** Large objects held in memory, no streaming for large files, unbounded collections
>
> Return as JSON: `{database: [{issue, severity, file, line, fix}], caching: [{issue, severity, fix}], api: [{issue, severity, endpoint, fix}]}`

### Agent 2.7: Observability Review (If backend/API detected in Phase 1)

**Prompt:**
> Review the codebase for observability and resilience.
>
> **Use web search to find current best practices for:**
>
> - Structured logging standards
> - Application metrics (RED method, USE method)
> - Distributed tracing
> - Health check patterns
>
> **Check for:**
>
> 1. **Logging:** print/console.log in production code, sensitive data in logs (PII, secrets), missing correlation/request IDs, unstructured log messages, missing log levels
> 2. **Metrics:** No metrics instrumentation, missing RED metrics (Rate, Errors, Duration), high-cardinality labels
> 3. **Health Checks:** No health endpoint, liveness probe checking dependencies (should only check process), missing readiness probes
> 4. **Resilience:** No circuit breaker for external calls, retry without exponential backoff, no timeout on HTTP/DB calls, missing graceful shutdown
>
> Return as JSON: `{logging: [{issue, severity, file, fix}], metrics: {present: bool, issues: []}, health_checks: {present: bool, issues: []}, resilience: [{issue, severity, fix}]}`

### Agent 2.8: API Design Review (If REST/GraphQL/gRPC API detected in Phase 1)

**Prompt:**
> Review the API design for best practices.
>
> **Use web search to find current best practices for:**
>
> - REST API design conventions (current year)
> - GraphQL schema design best practices
> - gRPC API design and protobuf conventions
> - HTTP status code usage
> - API versioning strategies
> - Error response formats
>
> **Check for:**
>
> 1. **URL Design (REST):** Verbs in URLs (/getUser), inconsistent pluralization, deep nesting (>3 levels), inconsistent casing
> 2. **HTTP Methods:** GET used for mutations, POST for everything, wrong status codes (200 for errors, 500 for client errors)
> 3. **Versioning:** No versioning strategy, breaking changes without version bump
> 4. **Responses:** Inconsistent error format, stack traces in production errors, no pagination metadata, inconsistent date formats
> 5. **Validation:** No request validation, accepting unknown fields silently, no Content-Type validation
> 6. **gRPC Specific (if applicable):**
>    - Proto file organization and package naming
>    - Missing field numbers documentation
>    - Reserved fields not used for removed fields
>    - Missing deadline/timeout on calls
>    - No health check service (grpc.health.v1)
>    - Streaming used inappropriately
>    - Missing reflection service for debugging
>
> Return as JSON: `{url_design: [{issue, severity, endpoint, fix}], methods: [{issue, severity, endpoint}], versioning: {strategy: string, issues: []}, responses: [{issue, severity, fix}], grpc: [{issue, severity, proto_file, fix}]}`

### Agent 2.9: Concurrency Review (If applicable based on language/framework)

**Prompt:**
> Review the codebase for concurrency and thread safety issues.
>
> **Use web search to find current best practices for:**
>
> - Concurrency patterns for the detected language(s)
> - Thread safety guidelines
> - Async/await best practices
>
> **Check for:**
>
> 1. **Race Conditions:** Shared mutable state without synchronization, TOCTOU (time-of-check-time-of-use) bugs
> 2. **Deadlocks:** Circular lock dependencies, sync calls on main thread
> 3. **Resource Leaks:** Threads/executors not shutdown, channels/streams not closed, missing cancellation handling
> 4. **Language-Specific:**
>    - Swift: Missing @MainActor for UI, non-Sendable crossing actor boundaries, DispatchQueue.main.sync from main
>    - Kotlin: GlobalScope usage, runBlocking on main, missing Dispatchers.Main for UI
>    - Go: Goroutine leaks, map access without mutex, channel without select timeout
>    - JS/TS: Unhandled promise rejections, event loop blocking, race conditions in shared state
>    - Python: asyncio blocking calls in async functions, threading without Lock
> 5. **Database:** Missing optimistic locking, long transactions holding locks
>
> Return as JSON: `{race_conditions: [{issue, severity, file, line}], deadlocks: [{issue, severity, file}], resource_leaks: [{issue, severity, file}], language_specific: [{issue, severity, file, fix}]}`

### Agent 2.10: AI/ML Review (If ML frameworks detected in Phase 1)

**Prompt:**
> Review the AI/ML codebase for best practices.
>
> **Use web search to find current best practices for:**
>
> - ML model versioning and reproducibility
> - Training pipeline best practices
> - Model deployment and serving guidelines
> - ML security considerations
>
> **Check for:**
>
> 1. **Reproducibility:** No random seed setting, missing model versioning, no experiment tracking, hardcoded hyperparameters
> 2. **Data Handling:** No data validation/schema, missing train/test split verification, data leakage risks, no feature versioning
> 3. **Model Management:** No model registry, missing model metadata, no A/B testing capability, no rollback mechanism
> 4. **Security:** Model files from untrusted sources (pickle vulnerabilities), no input validation for inference, exposed model endpoints without auth
> 5. **Performance:** No batching for inference, missing GPU utilization monitoring, no model optimization (quantization, pruning)
> 6. **Monitoring:** No model drift detection, missing prediction logging, no performance degradation alerts
>
> Return as JSON: `{reproducibility: [{issue, severity, fix}], data: [{issue, severity, file}], model_management: [{issue, severity}], security: [{issue, severity, file}], monitoring: [{issue, severity}]}`

### Agent 2.11: Compliance Review (If user data/payments detected in Phase 1)

**Prompt:**
> Review the codebase for compliance with privacy and security regulations.
>
> **Use web search to find current requirements for:**
>
> - GDPR data subject rights and consent requirements
> - CCPA/CPRA privacy requirements
> - HIPAA requirements (if healthcare data detected)
> - PCI DSS requirements (if payment processing detected)
> - SOC 2 trust service criteria
> - ISO 27001 information security controls
>
> **Check for:**
>
> 1. **Data Subject Rights:** Right to access (data export), right to deletion, right to rectification, consent withdrawal mechanism
> 2. **Consent Management:** Consent collection mechanism, pre-checked boxes (violation), consent records with timestamps, cookie consent
> 3. **Data Handling:** PII encryption at rest/transit, PII in logs, data retention policy, cross-border transfer safeguards
> 4. **Payment Security (if applicable):** Card data storage (should tokenize), CVV storage (never allowed), PAN masking in logs, TLS for card data
> 5. **Healthcare (if applicable):** PHI encryption, access controls, audit logging of PHI access, BAA with vendors
> 6. **Audit Trail:** Logging of data access, consent changes, security events
>
> Return as JSON: `{data_rights: [{requirement, implemented: bool, severity}], consent: [{issue, severity}], data_handling: [{issue, severity, file}], payment: [{issue, severity}], healthcare: [{issue, severity}], audit: [{issue, severity}]}`

### Agent 2.12: Git & Repository Hygiene Review (Always run)

**Prompt:**
> Review the repository configuration and git practices.
>
> **Use web search to find current best practices for:**
>
> - GitHub/GitLab branch protection rules
> - Conventional commits and commit message standards
> - CODEOWNERS best practices
>
> **Check for:**
>
> 1. **Branch Protection:** No protection on main/master, direct pushes allowed, no required reviews, no status checks required, force push allowed
> 2. **CODEOWNERS:** Missing CODEOWNERS file, stale/invalid owners, critical paths not covered
> 3. **Commit Standards:** Inconsistent commit message format, vague messages ("fix", "update"), missing issue references, WIP commits on main
> 4. **Branch Hygiene:** Stale branches (>30 days inactive), inconsistent naming, long-lived feature branches
> 5. **Secrets in History:** Check for accidentally committed secrets in git history
> 6. **Large Files:** Binary files or large assets that should use Git LFS
>
> Return as JSON: `{branch_protection: [{issue, severity, recommendation}], codeowners: [{issue, severity}], commits: [{issue, severity}], branches: [{issue, severity}], secrets_in_history: [{finding, severity, commit}], large_files: [{file, size_mb}]}`

### Agent 2.13: Database & Migrations Review (If database detected in Phase 1)

**Prompt:**
> Review database migrations and schema management.
>
> **Use web search to find current best practices for:**
>
> - Zero-downtime database migrations
> - Database migration patterns for the detected ORM/framework
> - Large table migration strategies
>
> **Check for:**
>
> 1. **Migration Safety:** Non-reversible migrations without justification, missing rollback/down migration, data migration mixed with schema migration
> 2. **Zero-Downtime:** Adding NOT NULL without default, renaming columns directly (should use expand-contract), dropping columns still in use
> 3. **Large Tables:** Migrations on large tables without batching, missing online schema change tools for big tables, SELECT * in migrations
> 4. **Data Integrity:** Foreign keys added without validating existing data, UNIQUE constraints without checking duplicates, enum changes without handling existing values
> 5. **Naming:** Inconsistent migration naming, non-descriptive names
> 6. **Testing:** Migrations not tested on production-like data, rollback not tested
>
> Return as JSON: `{safety: [{issue, severity, file}], zero_downtime: [{issue, severity, migration, fix}], large_tables: [{issue, severity, table}], integrity: [{issue, severity}], naming: [{issue, severity}]}`

### Agent 2.14: i18n & Localization Review (If user-facing UI detected in Phase 1)

**Prompt:**
> Review internationalization and localization practices.
>
> **Use web search to find current best practices for:**
>
> - i18n patterns for the detected platform (iOS/Android/Web)
> - ICU message format and pluralization
> - RTL support guidelines
>
> **Check for:**
>
> 1. **String Externalization:** Hardcoded user-facing strings in code, concatenated strings with variables (breaks translation), missing translation keys
> 2. **Pluralization:** Missing plural forms handling, incorrect plural rules for non-English
> 3. **Formatting:** Date/time/currency not locale-aware, hardcoded number formats, hardcoded date formats
> 4. **RTL Support:** Hardcoded left/right instead of leading/trailing (iOS), missing supportsRtl (Android), margin-left instead of margin-inline-start (CSS)
> 5. **Platform-Specific:**
>    - iOS: Strings not in Localizable.strings/.xcstrings, missing NSLocalizedString
>    - Android: Hardcoded strings instead of @string/, missing translations in values-XX/
>    - Web: Missing i18n library usage, template literals with embedded text
> 6. **Translation Workflow:** No string extraction in CI, missing translations not flagged
>
> Return as JSON: `{strings: [{issue, severity, file, line}], pluralization: [{issue, severity}], formatting: [{issue, severity, file}], rtl: [{issue, severity, file}], platform: [{issue, severity, file}]}`

### Agent 2.15: Configuration Management Review (Always run)

**Prompt:**
> Review configuration management practices.
>
> **Use web search to find current best practices for:**
>
> - Environment configuration patterns
> - Configuration validation at startup
> - Feature flag management
>
> **Check for:**
>
> 1. **Environment Separation:** Hardcoded values that vary by environment, environment-specific logic in code (if env == "prod"), production config in non-prod builds
> 2. **Secrets Management:** Secrets in configuration files (not using vault/secrets manager), missing .env.example documentation
> 3. **Startup Validation:** Missing validation of required config at startup, no fail-fast on missing config, invalid config formats not caught
> 4. **Feature Flags:** Inconsistent flag naming, no cleanup of old flags, flag dependencies not documented
> 5. **Platform-Specific:**
>    - iOS: Missing xcconfig per environment, Info.plist values not per-config
>    - Android: Missing buildConfigField per flavor, values missing in some flavors
>    - Web: Client-side env exposure issues (NEXT_PUBLIC_, VITE_), build-time vs runtime confusion
> 6. **Documentation:** Config options not documented, missing default values documentation
>
> Return as JSON: `{environment: [{issue, severity, file}], secrets: [{issue, severity, file}], validation: [{issue, severity}], feature_flags: [{issue, severity}], documentation: [{issue, severity}]}`

### Agent 2.16: Bug Patterns & Error Handling Review (Always run)

**Prompt:**
> Review the codebase for common bug patterns and error handling strategy.
>
> **Check for:**
>
> 1. **Null/Nil Bugs:** Missing null checks, Optional.get() without isPresent(), force unwrap (!), accessing nullable without guard
> 2. **Bounds Bugs:** Off-by-one errors, index out of bounds risks, empty collection not handled before access
> 3. **Arithmetic Bugs:** Division by zero risks, integer overflow, float equality comparison, precision loss
> 4. **Resource Bugs:** File/connection not closed in error paths, missing finally/defer cleanup, try-with-resources not used
> 5. **State Bugs:** Invalid state transitions, stale cache without invalidation, partial failure leaving inconsistent state
> 6. **Error Handling Strategy:**
>    - Silent failures: Count try?/try!/empty catch/except pass
>    - Catch-all without rethrow
>    - Error swallowing (log and continue without recovery)
>    - Missing error context when rethrowing
>    - Panic/crash for recoverable errors
> 7. **Error Propagation:** Errors not bubbling with context, sensitive data in error messages, missing correlation IDs
>
> Return as JSON: `{null_bugs: [{issue, severity, file, line}], bounds_bugs: [{issue, severity, file}], arithmetic_bugs: [{issue, severity, file}], resource_bugs: [{issue, severity, file}], state_bugs: [{issue, severity, file}], error_handling: {silent_failures: {count, files}, strategy_issues: [{issue, severity}]}, error_propagation: [{issue, severity}]}`

### Agent 2.17: Backwards Compatibility Review (If library/API/SDK project)

**Prompt:**
> Review for backwards compatibility and breaking changes.
>
> **Use web search to find current best practices for:**
>
> - Semantic versioning (SemVer)
> - API deprecation patterns
> - Breaking change documentation
>
> **Check for:**
>
> 1. **Breaking Changes:** Removed public API/method, changed method signature, changed return types, renamed public classes/functions
> 2. **Deprecation:** Deprecated APIs without replacement documented, deprecated without removal timeline, using deprecated APIs from dependencies
> 3. **Versioning:** Version not following SemVer, breaking changes without major version bump, no CHANGELOG or release notes
> 4. **API Contracts:** Changed response schema without versioning, removed fields from responses, changed error codes/formats
> 5. **Database:** Schema changes breaking old app versions, removed columns still queried by old versions
> 6. **Migration Path:** No migration guide for breaking changes, no compatibility layer/shim
>
> Return as JSON: `{breaking_changes: [{change, severity, file, migration_needed}], deprecation: [{api, severity, replacement, removal_version}], versioning: [{issue, severity}], api_contracts: [{issue, severity}], migration: [{issue, severity}]}`

### Agent 2.18: Documentation Review (Always run)

**Prompt:**
> Review documentation completeness and quality.
>
> **README.md - Required sections (flag if missing):**
>
> - Project name with build badge
> - Table of Contents
> - Introduction / Overview
> - Installation instructions
> - Usage examples
> - Contributing guidelines
>
> **docs/architecture.md - Required sections for standard repos:**
>
> - Table of Contents
> - Architecture diagram
> - Software units
> - Software of Unknown Provenance (SOUP)
> - Critical algorithms
> - Risk controls
>
> **docs/architecture.md - Required sections for AI/ML repos:**
>
> - Datasets
> - Data Preprocessing
> - Data Splits
> - Model Architecture
> - Model Training
> - Model Evaluation
> - Software of Unknown Provenance (SOUP)
> - Risk controls
> - Model Deployment
>
> **Other required files:**
>
> - CODEOWNERS (case-insensitive search - see below)
> - PR template (.github/PULL_REQUEST_TEMPLATE.md)
> - Issue templates (.github/ISSUE_TEMPLATE/) - **ONLY check if GitHub issues are enabled** (run: `gh repo view --json hasIssuesEnabled --jq '.hasIssuesEnabled'`). If issues are disabled (returns `false`), skip this check as the repo uses an external tracker like Jira.
> - LICENSE - **ONLY check if repo is public** (run: `gh repo view --json isPrivate --jq '.isPrivate'`). If private (returns `true`), do NOT flag missing LICENSE - private repos are proprietary by default.
> - API docs (OpenAPI/Swagger for APIs)
>
> **Content verification (CRITICAL):**
>
> - Check that files have ACTUAL content, not just headers/stubs
> - Empty or stub documentation = MEDIUM finding
> - soup.json must exist (source of truth; soup.md is auto-generated from it) and have actual dependency data
> - Architecture docs must have actual diagrams/descriptions
>
> **CRITICAL - Case-insensitive file search (MANDATORY):**
> GitHub treats these files case-insensitively. When checking for required files, ALL of these are equivalent and valid:
>
> - CODEOWNERS / codeowners / Codeowners / .github/CODEOWNERS / .github/codeowners
> - README.md / readme.md / Readme.md
> - LICENSE / license / License
> - CONTRIBUTING.md / contributing.md
> - pull_request_template.md / PULL_REQUEST_TEMPLATE.md
>
> **DO NOT flag missing file if ANY case variant exists.** Use case-insensitive glob patterns.
>
> Return as JSON: `{readme: {present: bool, sections: [{name, present: bool}], quality: "complete/partial/stub"}, architecture: {present: bool, sections: [{name, present: bool}], quality: "complete/partial/stub"}, other_docs: [{file, present: bool, severity}], content_issues: [{file, issue, severity}]}`

### Agent 2.19: CI/CD & Workflow Review (Always run)

**Prompt:**
> Review all CI/CD configuration files for best practices and security.
>
> **Use web search to find current best practices for:**
>
> - GitHub Actions security hardening (current year)
> - GitLab CI/CD best practices
> - CI/CD pipeline optimization
>
> **Check for:**
>
> 1. **Pipeline Completeness:**
>    - Missing stages: lint/format, type check, unit tests, integration tests, security scan, dependency scan
>    - No test execution in CI = HIGH
>    - No security scanning (CodeQL/Semgrep/Snyk/Trivy) = HIGH
>
> 2. **GitHub Actions Security:**
>    - Missing `permissions` block (HIGH) - should use least privilege
>    - Using `permissions: write-all` (HIGH)
>    - Workflow injection via `${{ github.event.issue.title }}` or similar untrusted input in run: (CRITICAL)
>    - Secrets potentially exposed in logs (CRITICAL)
>    - Using `pull_request_target` with checkout of PR code (CRITICAL)
>    - Third-party actions not pinned to SHA (INFO - not required but note if using @latest)
>
> 3. **Runner & Cost Optimization:**
>    - macOS runners for non-Apple builds (HIGH - 10x cost vs Linux)
>    - No caching configured for dependencies (MEDIUM)
>    - No `timeout-minutes` set (MEDIUM - risk of hung jobs)
>    - Self-hosted runners without security hardening
>
> 4. **Dependency Monitoring:**
>    - **CRITICAL: Check BOTH file-based AND repository-level settings before flagging:**
>      - First, check if `dependabot.yml` or `renovate.json` exists in `.github/`
>      - If no config file, check repository settings via GitHub API:
>
>        ```bash
>        # Check if Dependabot Security Updates are enabled
>        gh api repos/{owner}/{repo} --jq '.security_and_analysis.dependabot_security_updates.status'
>        ```
>
>      - If returns "enabled", Dependabot Security Updates ARE configured (monitors CVEs and creates security PRs)
>    - **Severity logic:**
>      - Neither dependabot.yml/renovate.json NOR security updates enabled = HIGH (no dependency monitoring at all)
>      - Security updates enabled but no dependabot.yml = INFO (CVE monitoring active, but no routine version updates - this is a valid approach)
>      - dependabot.yml exists but missing ecosystems = MEDIUM (should cover all: npm, pip, gradle, swift, cocoapods, github-actions, docker)
>    - No auto-merge for patch updates = LOW
>
> 5. **Build & Test Configuration:**
>    - Tests not running in parallel where possible
>    - No matrix strategy for cross-platform/version testing
>    - Missing artifact upload for test results
>    - No code coverage reporting
>    - Flaky test handling not configured
>
> 6. **Deployment Safety:**
>    - No environment protection rules
>    - Missing required reviewers for production
>    - No deployment gates/checks
>    - Secrets in workflow files instead of environment secrets
>
> Return as JSON: `{pipeline: [{stage, present: bool, severity}], security: [{issue, severity, file, line, fix}], optimization: [{issue, severity, estimated_impact}], dependency_monitoring: {security_updates_enabled: bool, config_file: "dependabot.yml|renovate.json|none", ecosystems: [{ecosystem, monitored: bool, severity}], issues: [{issue, severity}]}, deployment: [{issue, severity}]}`

**Wait for all Phase 2 agents to complete before proceeding to Phase 3.**

---

## PHASE 3: VALIDATION (Launch N Agents in Parallel)

**For EVERY finding from Phase 2 (all severity levels), launch a validation agent:**

### Validation Agent Template

**Prompt:**
> Validate this finding:
>
> **Finding:** [description from Phase 2]
> **File:** [file path]
> **Claimed Issue:** [what was flagged]
>
> Your job:
>
> 1. Read the actual code at this location
> 2. Verify the issue actually exists
> 3. Check if it's intentional (silenced, documented, or acceptable pattern)
> 4. Confirm it's not a false positive
>
> Return: `{validated: true/false, confidence: "high/medium/low", reason: "explanation", false_positive_reason: "if applicable"}`

**Filter criteria - Remove findings that are:**

- Pre-existing issues outside scope
- Actually correct code that appears problematic
- Pedantic nitpicks a senior engineer wouldn't flag
- Issues a linter would catch (don't verify)
- Explicitly silenced in code (lint ignore comments)

**Only VALIDATED findings with HIGH confidence proceed to the report.**

**ANTI-SHORTCUT RULE:** You MUST NOT skip Phase 3 or batch-approve findings without reading the actual code. Each validation agent must read the specific file and line referenced in the finding. If a validation agent returns without quoting the actual code it checked, its validation is invalid and must be re-run.

---

## PHASE 4: REPORT GENERATION

**MANDATORY PRE-REPORT VERIFICATION:**

Before generating the report, you MUST:

1. Review your phase log from the start of the review
2. Verify ALL phases show "complete" status (not "pending")
3. Verify ALL applicable agents returned results
4. If ANY phase or agent is incomplete, STOP and complete it first

**If you skipped any phase or agent, the review is incomplete and results will be inconsistent.**

After all validation agents complete:

1. **Aggregate** validated findings from all Phase 2 agents
2. **Deduplicate** any overlapping issues
3. **Sort** by severity (Critical → High → Medium → Low → Info)
4. **Generate** `CODE_REVIEW_REPORT.md` using the output format below
5. **Include** positive observations from Phase 2 agents
6. **Include** the completed phase log at the start of the report (proves all phases executed)

---

## EXCLUSIONS - DO NOT FLAG

| Item | Reason |
| ---- | ------ |
| GitHub Actions using tags (`@v4`) or branches (`@master`, `@main`) | SHA pinning not required - floating refs are acceptable |
| GitHub Actions pinned to floating branch | Same as above - this is a valid and common practice |
| Missing SBOM | Not required |
| Missing CHANGELOG.md | Not required |
| Security controls required by compliance frameworks | Intentional (AWS Security, CIS, PCI DSS) |
| File casing for GitHub files (CODEOWNERS, README, LICENSE, etc.) | GitHub is case-insensitive - `codeowners` = `CODEOWNERS` |
| CODEOWNERS reported as missing when lowercase `codeowners` exists | GitHub treats all case variants identically - DO NOT FLAG |
| CODEOWNERS in `.github/` vs root | Both locations valid: `CODEOWNERS`, `.github/CODEOWNERS`, `.github/codeowners`, `docs/CODEOWNERS` |
| README/LICENSE with different extensions (.md, .txt, none) | All valid |
| Any "missing file" when a case variant exists | Search case-insensitively before flagging any missing file |
| Version numbers in config files | Do NOT fact-check versions against world knowledge alone. If uncertain (e.g., "does Ruby 4.0 exist?"), use web search to verify before flagging as invalid. |
| Missing/inconsistent AWS resource tags | Organization-specific, enforced by SCPs/Config Rules, not code review |
| Administrators can bypass branch protection | Intentional GitHub feature for emergency fixes, org-level policy decision |
| Branch protection not enforced for admins | Same as above - this is a trust/governance decision, not a code issue |
| Users/teams in "bypass list" for branch protection | Intentional - bypass actors are explicitly configured for emergency access |
| X users can bypass PR reviews | Same as above - these are trusted maintainers with emergency access |
| Missing LICENSE file in private repos | Private repos are proprietary by default - LICENSE only required for public/open source repos |
| Missing dependabot.yml when Dependabot Security Updates enabled | Security updates via repo settings (CVE-only) is a valid approach - only monitors vulnerabilities without noise from routine version bumps. Check `gh api repos/{owner}/{repo} --jq '.security_and_analysis.dependabot_security_updates.status'` before flagging |

---

## SEVERITY LEVELS

| Level | Criteria | Action |
| ----- | -------- | ------ |
| **🔴 CRITICAL** | Exploitable vulnerabilities, data exposure, auth bypass, hardcoded secrets, breaking changes | Must fix before merge |
| **🟠 HIGH** | Conditional security issues, performance regression, missing error handling, data integrity risks | Should fix before merge |
| **🟡 MEDIUM** | Maintainability issues, minor performance, missing validation, test gaps | Fix next iteration |
| **🔵 LOW** | Style issues, minor refactoring, nice-to-have improvements | Address when convenient |
| **⚪ INFO** | Observations, alternatives, best practices FYI | Awareness only |

### Version Lag Severity (Dependencies & Runtimes)

| Condition | Severity |
| --------- | -------- |
| EOL / no security patches | CRITICAL |
| Known CVE in current version | CRITICAL |
| 2+ major versions behind | HIGH |
| 1 major version behind | MEDIUM |
| 3+ minor versions behind | MEDIUM |
| 1-2 minor versions behind | LOW |

---

## REFERENCE: CHECK DETAILS

The following sections provide detailed guidance for each agent. Share relevant sections with agents as needed.

### Security Checks (Agent 2.1)

**Secrets patterns:** AKIA (AWS), sk_live/sk_test (Stripe), ghp_/gho_/github_pat_ (GitHub), AIzaSy (Google/Firebase), xox (Slack)

**Secure storage by platform:**

| Platform | Insecure | Secure |
| -------- | -------- | ------ |
| iOS | UserDefaults | Keychain |
| Android | SharedPreferences | EncryptedSharedPreferences / Keystore |
| Web | localStorage | httpOnly cookies |
| Backend | Plaintext config | Vault / Secrets Manager |

**Injection types:** SQL, Command, XSS, Template (SSTI), Deserialization

### Code Quality Thresholds (Agent 2.3)

| Metric | Warning | Flag |
| ------ | ------- | ---- |
| Method length | >60 lines | >100 lines |
| Class length | >600 lines | >1000 lines |
| Parameters | >6 | >8 |
| Nesting depth | >4 levels | >6 levels |
| Cyclomatic complexity | >15 | >25 |

### CI/CD Checklist (Agent 2.1 or separate)

| Check | Severity if Missing |
| ----- | ------------------- |
| Lint/Format | MEDIUM |
| Type check | MEDIUM |
| Unit tests | HIGH |
| Security scan (CodeQL/Semgrep/Snyk) | HIGH |
| Dependency vulnerability scan | HIGH |
| Permissions block in Actions | HIGH |

### Documentation Requirements

| File | Severity if Missing |
| ---- | ------------------- |
| README.md | HIGH |
| CODEOWNERS | MEDIUM |
| LICENSE | HIGH (open source) |
| docs/architecture.md | MEDIUM |

---

## COMPLETION CRITERIA

The review is complete when:

- [ ] Phase log shows ALL phases complete (no "pending" values)
- [ ] All core Phase 2 agents returned results
- [ ] All applicable conditional Phase 2 agents returned results (or marked N/A)
- [ ] All Phase 3 validation agents completed
- [ ] Findings documented with specific counts
- [ ] Positive observations documented for each applicable category
- [ ] Health score justified
- [ ] Phase log included in report
- [ ] Report generated in correct format

---

## QUANTITATIVE REQUIREMENTS

**Reports MUST include specific counts:**

- Dependencies: "X total, Y outdated, Z vulnerable, W duplicate"
- Test coverage: "X of Y services tested (Z%)"
- Linter disables: "X disables across Y files"
- Silent failures: "X try?/empty catch patterns"
- Resource leaks: "X added, Y removed, Z potential leaks"
- Secrets: "Searched X files, found Y hardcoded secrets"

**If full enumeration not feasible:**

1. State scope measured (e.g., "sampled 50 of 200 files")
2. Do NOT fabricate counts
3. Mark partial counts with "~" prefix

Never use vague language like "some tests exist" or "a few issues found".

---

## OUTPUT FORMAT

**Output the report to `CODE_REVIEW_REPORT.md` in the repository root.**

### Formatting Rules

- Use Unicode emojis: 🔴 🟠 🟡 🔵 ⚪ ✅ ⚠️ ❌
- NEVER use GitHub shortcodes (`:red_circle:`)

### Report Structure

```markdown
# Code Review Report

**Repository:** [name]
**Date:** [ISO-8601]
**Reviewer:** AI Code Review
**Health Score:** [A|B|C|D|F]

---

## Phase Completion Log

{Include completed phase log here - ALL values filled in, proves all phases executed}

---

## Review Coverage

[Checklist of what was reviewed with ✅/⚠️/❌ status]

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
Description of what was found.

**Impact:**
Why this matters.

**Recommended Fix:**
How to address it.

---

## ✅ Positive Observations & Strengths

This section highlights what the team is doing well. Good practices should be recognized and continued.

### Architecture & Design

[Describe positive architectural decisions, clean separation of concerns, good use of design patterns, thoughtful module organization, etc. Be specific about what files/patterns demonstrate this.]

### Code Quality

[Highlight clean, readable code, consistent style, good naming conventions, appropriate abstraction levels, well-documented complex logic, etc.]

### Security Practices

[Acknowledge good security practices: proper secret management, input validation, secure authentication patterns, appropriate encryption usage, etc.]

### Testing

[Recognize good test coverage, well-structured tests, meaningful test names, good use of mocks/fixtures, integration tests for critical paths, etc.]

### DevOps & CI/CD

[Note well-configured pipelines, proper caching, security scanning in place, good deployment practices, infrastructure as code, etc.]

### Documentation

[Praise comprehensive README, good inline comments where needed, architecture documentation, API documentation, etc.]

### Dependencies & Maintenance

[Acknowledge up-to-date dependencies, well-curated library choices, no abandoned packages, proper version pinning, etc.]

### Infrastructure as Code (If applicable)

[Recognize well-architected IaC: proper VPC/subnet design, security group best practices, cost optimization, modern AWS services, encryption at rest, etc.]

### Performance

[Highlight good performance patterns: efficient queries, proper caching, pagination, connection pooling, lazy loading, etc.]

### Observability & Monitoring

[Acknowledge logging best practices, metrics collection, alerting, distributed tracing, health checks, CloudWatch/Datadog integration, etc.]

### API Design (If applicable)

[Recognize clean API design: consistent naming, proper versioning, good error responses, pagination, rate limiting, documentation, etc.]

### Compliance & Data Handling (If applicable)

[Acknowledge good compliance practices: encryption, data retention policies, audit logging, consent management, PII handling, etc.]

### Configuration Management

[Highlight good config practices: environment separation, secrets management, feature flags, validation at startup, etc.]

### Error Handling & Resilience

[Recognize robust error handling: proper error propagation, circuit breakers, retry with backoff, graceful degradation, etc.]

---

## Appendices

### Dependency Status

[Table of packages with current/latest versions]

### Duplicate Libraries

[Table of overlapping libraries]

### Security Assessment

[Summary of security findings]

### Files Reviewed

[Collapsible list of files]

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
| COMP | Compliance (GDPR, HIPAA, PCI) |
| GIT | Git & Repository Hygiene |
| MIG | Database Migrations |
| I18N | Internationalization |
| BUG | Bug Patterns |
| COMPAT | Backwards Compatibility |

---

## JIRA ISSUE CREATION (Optional - On Request)

**This section is NOT executed automatically.** After the report is generated, if the user requests issue creation (e.g., "create issues", "create tickets", "log issues"), use the `create-issue` skill to create issues for each finding. The skill will automatically detect whether to use GitHub Issues or Jira.

**Use the Task template** from the skill for all code review findings.

### Code Review Specific Rules

**IMPORTANT: Create Jira issues for ALL severity levels including INFO (⚪).** Do not skip any findings.

**Summary format:** `[REPO-NAME][FINDING-ID] Brief description` (e.g., `[pnp-ios][SEC-001] Rotate hardcoded AWS credentials`)

**BEFORE creating issues:**

1. List existing issues with the `code-review` label to avoid duplicates:

   ```bash
   jira issue list --label "code-review" --plain --columns key,summary
   ```

2. Skip any that already exist (match by BOTH repo name AND finding ID in summary)

**AFTER creating all issues:**

1. List all issues to confirm:

   ```bash
   jira issue list --label "code-review" --plain --columns key,summary,status
   ```

2. Report: "Created X new issues, Y already existed, Z total issues"

### Labels

Always include `code-review` label plus a category label:

| Finding Prefix | Label |
| -------------- | ----- |
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

*Begin the code review by executing Phase 1: Launch 3 parallel agents for initial scans.*
