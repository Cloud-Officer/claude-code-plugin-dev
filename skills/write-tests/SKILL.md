---
name: write-tests
description: Write, generate, or add automated tests for code — unit, integration, and end-to-end. Use when the user wants to write tests, add test coverage, generate unit tests, create specs, add a regression test, backfill missing tests, cover an untested file, or test a change before opening a PR. Auto-detects the language and the test framework already in the repo. Supports Ruby, PHP, Python, JavaScript/TypeScript, C#/.NET, Swift, Kotlin/Java, Go, C/C++, and Rust.
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(bundle:*), Bash(rspec:*), Bash(rake:*), Bash(ruby:*), Bash(composer:*), Bash(pest:*), Bash(phpunit:*), Bash(behat:*), Bash(php:*), Bash(pytest:*), Bash(python:*), Bash(python3:*), Bash(coverage:*), Bash(tox:*), Bash(npm:*), Bash(npx:*), Bash(pnpm:*), Bash(yarn:*), Bash(node:*), Bash(dotnet:*), Bash(swift:*), Bash(xcodebuild:*), Bash(gradle:*), Bash(./gradlew:*), Bash(go:*), Bash(cargo:*), Bash(ctest:*), Bash(cmake:*), Bash(make:*), Bash(git:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*)
---

# Write Tests

Generate high-quality automated tests for a change or an untested file, in the framework the repo already uses, and **run them until they pass**. The skill is polyglot: it detects the language and framework per repo, matches the surrounding conventions, and closes the loop between *implement* and *review* in the co-dev workflow.

The point is not "emit a plausible test file" — Claude can already do that. The point is a repeatable, verified capability: detect the right framework, follow house style, enumerate the cases that matter (happy path, edges, error paths, boundaries), generate, **execute**, iterate to green, and report real coverage. A test that was never run is not done.

## When to Use

- After implementing a change, before opening a PR (pairs with `work-issue`).
- To backfill coverage on an untested file, class, or module.
- To add a regression test that proves a bug fix (pairs with `verify-resolved-issues`).
- When the user asks to "write tests", "add specs", "cover this", or "test this before I ship".

Do **not** run it on pure config/docs changes with no runtime surface. If there is product code, there is something to test.

## Core principle: match the repo, don't impose

**Use the framework that is already in the repo.** Detect it (Step 1) and follow it — do not introduce Vitest into a Jest repo, Pest into a PHPUnit-only repo, or Swift Testing into an XCTest file. The "2026 default" recommendations in the matrix below apply **only when a repo has no tests yet** and you must choose. When tests exist, the existing choice wins, full stop.

Then match local conventions: the existing `spec/` vs `test/` layout, file naming, factory/fixture style (FactoryBot, factory_boy, test data builders), shared helpers/setup, mocking library, and assertion idioms already in the code. New tests should read like the tests already there.

## Step 1: Detect language and framework

Detect per target directory (monorepos may mix stacks — resolve the stack of the file(s) under test, not the repo root). Read the manifest first, then confirm against existing test files.

| Manifest present | Language | How to pick the framework |
| --- | --- | --- |
| `Gemfile` / `*.gemspec` | Ruby | `grep rspec Gemfile*` → **RSpec** (specs in `spec/`); else **Minitest/Test::Unit** (`test/`). Feature/system → **Capybara**. Fixtures → **FactoryBot** if in the Gemfile. |
| `composer.json` | PHP | `grep pestphp/pest` → **Pest**; `grep behat/behat` → **Behat** (`features/`); else **PHPUnit**. Laravel → run via `php artisan test`. Mocks → **Mockery**. |
| `pyproject.toml` / `requirements*.txt` / `setup.py` | Python | `grep -ri pytest` → **pytest** (`tests/`); else **unittest**. Mocks → `unittest.mock`; fixtures → `factory_boy` if present; property → `hypothesis` if present. |
| `package.json` | JS/TS | `grep '"vitest"'` → **Vitest**; `grep '"jest"'` → **Jest**; `grep react-native` → **Jest**. E2E → **Playwright** (`grep '@playwright'`) else Cypress if present. Component → Testing-Library. |
| `*.csproj` / `*.sln` | C#/.NET | `grep -ri xunit` → **xUnit**; `grep -ri nunit` → **NUnit**; `grep -ri mstest` → **MSTest**. Assertions → FluentAssertions if referenced; mocks → Moq/NSubstitute. |
| `Package.swift` / `*.xcodeproj` / `*.xcworkspace` | Swift | `grep -rl "import Testing"` → **Swift Testing** for unit; else **XCTest**. UI → **XCUITest** (always XCTest). |
| `build.gradle(.kts)` / `settings.gradle` | Kotlin/Java | `grep -ri kotest` → **Kotest**; else **JUnit 5** (or JUnit4 if that's what's wired). Mocks → **MockK** (Kotlin) / Mockito (Java). Android UI → `composeTestRule` (Compose) or **Espresso** (Views). Flows → Turbine. |
| `go.mod` | Go | stdlib **`testing`** + table-driven by default; **testify** if `grep testify go.mod` (use `require`). Concurrency/time → `testing/synctest`. |
| `CMakeLists.txt` / `*.cpp` / `*.cc` | C/C++ | `grep -ri gtest\|googletest` → **GoogleTest**+GoogleMock; `grep -ri catch2` → **Catch2**; run via **CTest** if wired. |
| `Cargo.toml` | Rust | built-in `#[test]` / `cargo test`; integration tests in `tests/`; property → `proptest` if present; mocks → `mockall` if present. |

If a repo has **no tests at all**, pick the 2026 default from the matrix and tell the user which you chose and why before generating.

### Repos with more than one framework (same language)

Expect to detect **multiple frameworks for one language** — it's normal, and the skill supports it. Two distinct cases:

1. **Different test layers → different frameworks (keep them separate).** A single language often uses one tool per layer: Ruby with RSpec (unit) + Capybara (system) + Cucumber (BDD); JS/TS with Vitest/Jest (unit) + Playwright/Cypress (E2E); Swift with Swift Testing (unit) + XCUITest (UI); Kotlin with Kotest/MockK (domain/ViewModel) + JUnit4 `composeTestRule` (Compose UI); PHP with PHPUnit/Pest (unit/feature) + Behat (acceptance). Pick the framework for the **layer** you're writing at, and follow that layer's existing tests.

2. **Two frameworks at the *same* layer (coexistence / mid-migration).** PHPUnit **and** Pest, Jest **and** Vitest, NUnit **and** xUnit, Minitest **and** RSpec, XCTest **and** Swift Testing can all live in one repo — usually because a migration is in progress. Resolve this **per directory/module, not repo-wide**:
   - Match the framework used by the **nearest existing tests** — the sibling test file, the same module/package, or the closest test directory to the code under test. A new spec next to RSpec specs is RSpec even if the repo also has Minitest elsewhere.
   - If the target area has no nearby tests and both frameworks are plausible, **ask the user which to use** (offer the two, note which looks newer/more common) rather than guessing. State the counts you found, e.g. "42 PHPUnit files, 6 Pest files — which for this new test?"
   - **Never mix two frameworks in the same test file.** One file, one framework.
   - When the user has stated a migration direction (e.g. "we're moving to Vitest"), prefer the target framework for new files and say so.

## Framework matrix (mid-2026 defaults for greenfield only)

Recommendations below are for **new** test suites where nothing exists yet. For existing suites, match what's there.

| Language | New-suite default (2026) | Also support / when | Mocking | Coverage |
| --- | --- | --- | --- | --- |
| **Ruby** | **RSpec** + FactoryBot; Capybara for system specs | Minitest for gems/stdlib-style repos | RSpec mocks, `instance_double` | SimpleCov |
| **PHP** | **Pest** (runs on PHPUnit; coexists) | PHPUnit for PHPUnit-heavy repos; Behat for existing BDD | Mockery, Prophecy | `--coverage` (Xdebug/PCOV) |
| **Python** | **pytest** (fixtures, `parametrize`) | unittest for stdlib-style; hypothesis for property | `unittest.mock`, `pytest-mock` | `pytest --cov` / `coverage` |
| **JS/TS** | **Vitest** | Jest for React Native / legacy CJS / deep Jest-mock repos; Playwright for E2E | `vi`/`jest` mocks, MSW, nock | `--coverage` (v8/istanbul) |
| **C#/.NET** | **xUnit v3** + FluentAssertions | NUnit 4 for existing NUnit suites / rich data-driven | Moq, NSubstitute | `dotnet test --collect:"XPlat Code Coverage"` |
| **Swift** | **Swift Testing** (`@Test`, `#expect`) for unit — Xcode 16+/Swift 6 | XCTest for existing; **always** XCTest for XCUITest UI + `XCTMetric` performance | protocol test doubles; Quick/Nimble if present | Xcode coverage / `swift test --enable-code-coverage` |
| **Kotlin/Java** | **JUnit 5** + **Kotest** assertions + **MockK** for domain/ViewModel | JUnit4 `composeTestRule`+`testTag` for Compose UI; Espresso for View UI; Robolectric for JVM Android | MockK / Mockito | JaCoCo / Kover |
| **Go** | stdlib **`testing`** + **table-driven** | testify (`require`) selectively; `testing/synctest` for time/concurrency; `-fuzz` for parsers | interfaces (no lib needed); testify/mock or gomock if present | `go test -cover` (+ `-race`) |
| **C/C++** | **GoogleTest** (+GoogleMock) or **Catch2** | CTest as the harness | GoogleMock / FFF | `--coverage` (gcov/llvm-cov) |
| **Rust** | built-in `#[test]` / `cargo test` | proptest for property; integration tests in `tests/` | mockall / trait fakes | `cargo llvm-cov` / tarpaulin |

Ecosystem notes that change the generated code:

- **Swift:** never mix `#expect`/`#require` and `XCTAssert*` in the same test function. New unit tests → Swift Testing; leave UI (`XCUIApplication`) and performance tests in XCTest.
- **Go:** prefer table-driven subtests with named rows; reach for `require` over `assert` so a failed precondition stops the case. Use `testing/synctest` instead of real `time.Sleep` for timing-dependent tests.
- **Kotlin:** Kotest specs don't map onto Compose's `@get:Rule`, so split — Kotest+MockK for domain/ViewModel logic, JUnit4-style `composeTestRule` for Compose UI, and prefer `Modifier.testTag(...)` over matching exact text.
- **PHP/Pest & JS/Vitest & Swift/Testing:** all coexist with the older framework in the same suite — migration is never required to start; new files can use the modern one only if the repo has already adopted it.

## Step 2: Decide what to test

1. **Scope.** If invoked after a change (or from `work-issue`), test the diff: `git diff --name-only` (and `git diff` for the exact lines). If invoked on a file/module, target that. If backfilling, prioritize the highest-risk untested code (business logic, money/enum/state handling, parsers, auth, boundaries) over trivial getters.
2. **Read the code under test.** Understand inputs, outputs, side effects, error paths, and collaborators (what needs mocking vs. what can run real).
3. **Find the seams.** Identify dependencies to stub (network, DB, clock, filesystem, third-party SDKs) and what should stay real (pure logic, in-memory structures). Over-mocking produces tests that pass while the app breaks — mock only true external boundaries.

## Step 3: Enumerate the cases (before writing)

List the cases you will cover, then generate. At minimum consider:

- **Happy path** — the primary expected behavior.
- **Edge/boundaries** — empty, zero, one, max, off-by-one, unicode, timezone, rounding, large inputs.
- **Error paths** — invalid input, exceptions, failed dependencies, timeouts, permission denied.
- **State/branches** — each meaningful branch and enum/state value the code distinguishes.
- **Regression** — when fixing a bug: a test that fails on the old behavior and passes on the fix.

For a bug fix, write the regression test **first**, confirm it fails against the current (unfixed) behavior if possible, then confirm the fix makes it pass.

## Step 4: Generate the tests

- Place files where the repo expects them (`spec/`, `test/`, `tests/`, `__tests__/`, `*_test.go`, `androidTest/` vs `test/`, `Tests/` target, etc.) with the repo's naming convention.
- Reuse existing helpers, factories, fixtures, base classes, and custom matchers — don't reinvent setup that already exists.
- One behavior per test; descriptive names that state intent. Arrange–Act–Assert.
- **The test name is the documentation — do not write a comment above a test.** A preamble explaining why the test exists, what it protects, or how the behavior relates to another module is rationale, not code: it belongs in the PR body or the ticket. If a test's purpose isn't obvious, rename the test or sharpen the assertion message; don't annotate it. Same inside the body: no `# Arrange` / `// act` labels and no comment restating the line under it. The rare comment that earns its place states something the code cannot — a magic fixture value's origin, a third-party quirk being reproduced — in one line.
- Deterministic only: no real network/clock/random. Inject or fake them. Freeze time where the framework supports it (`testing/synctest`, Timecop, `vi.useFakeTimers`, etc.).
- Match the assertion style already used in the suite.

## Step 5: Run and iterate to green

Run the suite (narrowly — just the new/affected tests first), read failures, fix, repeat until green. Then measure coverage — Step 6 is mandatory; only its scope is negotiable, so run it on the changed files first.

| Language | Run (narrow → full) | Coverage |
| --- | --- | --- |
| Ruby (RSpec) | `bundle exec rspec path/to/spec.rb` → `bundle exec rspec` | SimpleCov (auto on run) |
| Ruby (Minitest) | `bundle exec rake test TEST=path` → `bundle exec rake test` | SimpleCov |
| PHP (Pest) | `./vendor/bin/pest --filter=Name` → `./vendor/bin/pest` | `./vendor/bin/pest --coverage` |
| PHP (PHPUnit) | `./vendor/bin/phpunit --filter Name` → `php artisan test` | `--coverage-text` |
| PHP (Behat) | `./vendor/bin/behat features/x.feature` | n/a |
| Python (pytest) | `pytest path::test_name` → `pytest` | `pytest --cov=pkg` |
| Python (unittest) | `python -m unittest module.Class.test` | `coverage run -m unittest discover && coverage report` |
| JS/TS (Vitest) | `npx vitest run path` → `npx vitest run` | `npx vitest run --coverage` |
| JS/TS (Jest) | `npx jest path -t "name"` → `npx jest` | `npx jest --coverage` |
| JS/TS (Playwright) | `npx playwright test path` | `--reporter=html` |
| C#/.NET | `dotnet test --filter Name` → `dotnet test` | `dotnet test --collect:"XPlat Code Coverage"` |
| Swift (SwiftPM) | `swift test --filter Name` → `swift test` | `swift test --enable-code-coverage` |
| Swift (Xcode) | `xcodebuild test -scheme S -destination '...' -only-testing:...` | Xcode coverage report |
| Kotlin/Android (unit) | `./gradlew :module:test --tests X` → `./gradlew test` | `./gradlew koverHtmlReport` / JaCoCo |
| Kotlin/Android (instrumented) | `./gradlew connectedAndroidTest` (needs device/emulator) | — |
| Go | `go test -run TestName ./pkg` → `go test ./...` (+`-race`) | `go test -cover ./...` |
| C/C++ | `ctest --test-dir build -R Name` → `ctest --test-dir build` | `--coverage` + gcov/llvm-cov |
| Rust | `cargo test test_name` → `cargo test` | `cargo llvm-cov` |

Detect the JS package manager from the lockfile (`pnpm-lock.yaml` → `pnpm`, `yarn.lock` → `yarn`, else `npm`); prefer the repo's test script (`npm test`) when it exists.

**Instrumented mobile tests** (Android `connectedAndroidTest`, iOS on a simulator) need a device/emulator. If none is available, generate the tests, state clearly that they were **not executed** for lack of a device, and run whatever JVM/unit-level tests you can.

## Step 6: Check coverage

Coverage is part of this skill, not an afterthought. Measure it on the code under test and hold it to a floor.

**Default targets: line ≥ 80% and branch ≥ 80%** (or the language's nearest equivalent). Resolve the actual target in this precedence:

1. **What the user asked for** — an explicit number in the request wins.
2. **What the repo already configures** — an existing threshold (SimpleCov `minimum_coverage`, Jest/Vitest `coverageThreshold`, `.coveragerc` `fail_under`, coverlet threshold, JaCoCo/Kover rule, `nyc` `check-coverage`, gcovr `--fail-under-*`). Respect it, and **never lower an existing higher bar**.
3. **The 80/80 default** otherwise.

Procedure:

1. Run coverage scoped to the changed files/module (table below), reading **both line and branch**.
2. If below target, add tests for the uncovered lines and branches that matter — error paths, guard clauses, each branch/enum value — not trivial padding, and don't chase 100%. Re-run.
3. Report the **actual** line/branch percentages and whether the target was met.

| Language | Coverage command (line + branch) | Notes |
| --- | --- | --- |
| Ruby | SimpleCov: `SimpleCov.enable_coverage :branch` + `minimum_coverage line: 80, branch: 80`, then `bundle exec rspec` | branch coverage since SimpleCov 0.18 |
| PHP | `./vendor/bin/pest --coverage --min=80` / `phpunit --coverage-text` | needs Xdebug or PCOV; path/branch coverage via Xdebug |
| Python | `pytest --cov=pkg --cov-branch --cov-fail-under=80` | `--cov-branch` enables branch metric |
| JS/TS (Vitest) | `vitest run --coverage` + `coverage.thresholds { lines: 80, branches: 80 }` | v8/istanbul report branches |
| JS/TS (Jest) | `jest --coverage` + `coverageThreshold.global { lines: 80, branches: 80 }` | |
| C#/.NET | `dotnet test --collect:"XPlat Code Coverage"` + coverlet `/p:Threshold=80 /p:ThresholdType=line,branch` | coverlet reports line + branch |
| Swift | `swift test --enable-code-coverage` → `xcrun llvm-cov report` (or Xcode "Gather coverage") | region/branch via llvm-cov; no built-in fail-under — parse the report |
| Kotlin/Android | Kover `koverVerify` or JaCoCo rule with `LINE` + `BRANCH` counters `minimum = 0.80` | JaCoCo counters: LINE, BRANCH |
| Go | `go test -covermode=atomic -coverprofile=c.out ./... && go tool cover -func=c.out` | Go reports **statement** coverage — there is **no built-in branch coverage** |
| C/C++ | build `--coverage`, run via CTest, then `gcovr --fail-under-line 80 --fail-under-branch 80` (or `llvm-cov report`) | gcovr enforces line + branch |
| Rust | `cargo llvm-cov --fail-under-lines 80` | region/line based; branch coverage is limited |

Coverage caveats to state honestly: **Go** has no branch coverage — meet statement/line ≥ 80% and ensure every branch is exercised by a table-driven row. **Swift** and **Rust** report region/line coverage; treat "region" as the branch-equivalent and say so. Where a tool cannot measure branch coverage, report line coverage and note the branch metric is unavailable rather than implying it was met.

## Step 7: Report

Summarize concisely:

- Files added/changed and the framework used (name the framework per directory if more than one was involved).
- What was covered (the case list from Step 3) and any deliberate gaps.
- Test run result — **actual** pass/fail counts, not "should pass".
- **Coverage — actual line and branch percentages vs. the target** (state the target and where it came from: user / repo config / 80-80 default). If a metric is unavailable for the language, say so.
- Anything left for a human (e.g. instrumented tests not run, a flow that needs a device or live sandbox).

## Integration with co-dev

- **`work-issue`** → `work-issue`'s Step 8 is a **hard gate** ("no change ships without tests"); it owns the *policy* (a behavior-altering change can't reach a PR without passing tests, bug fixes need a regression test). This skill is the *how* it satisfies that gate: framework detection, the case matrix, running to green, and the 80/80 coverage floor. After implementing an issue, generate specs for the diff and cover the issue's acceptance criteria as explicit cases before the PR.
- **`verify-resolved-issues`** → when a fix is verified from code, generate a regression test that pins the fixed behavior so it can't silently revert.
- **`run-linters`** → run linters on the generated test files too; they are source code and must pass the same gate.
- **`code-review-deep`** → its tests phase flags coverage gaps; this skill closes them.
- **CI** → when adding a new suite to a repo that had none, offer to wire a GitHub Actions job consistent with the repo's existing `build.yml` conventions.

## Important Rules

- **Match the existing framework — resolved per directory/module, not repo-wide.** A repo may legitimately hold several frameworks for one language (different layers, or a migration in progress). Match the framework of the nearest existing tests to the code under test; when two are plausible at the same layer and none is nearby, ask the user which to use rather than guessing. Never introduce a *new* framework into a repo that already has one unless the user asks, and never mix two frameworks in one file. Greenfield defaults apply only when no tests exist anywhere.
- **Run what you write.** Every generated test must actually be executed and reported with real results. Never claim a test passes without running it. If it can't be run (no device, missing service), say so plainly.
- **Never fake green.** Do not weaken assertions, add `skip`/`xit`/`t.Skip`, mark `@Disabled`, or delete a failing test to make the suite pass. A failing test means either the test or the code is wrong — fix the right one.
- **Don't change source to fit a wrong test.** Only modify production code when the test exposed a real bug (and say so). Otherwise fix the test.
- **Mock only real boundaries.** Network, DB, clock, filesystem, third-party SDKs — yes. Pure logic and in-memory collaborators — no. Over-mocking yields tests that pass while production breaks.
- **Deterministic and isolated.** No real time, network, randomness, or shared mutable state between tests. Tests must pass run in any order and in parallel.
- **Never edit framework/config to bypass failures** (`jest.config`, `phpunit.xml`, `.rspec`, coverage thresholds) to make a run go green. Same spirit as `run-linters`.
- **Hit the coverage floor.** Default line ≥ 80% and branch ≥ 80% (or the language equivalent) unless the user specifies otherwise or the repo configures a different/higher bar — respect the repo's and never lower it. Report the real numbers; don't game the metric with assertion-free tests.
- **No narrative comments in test files.** Default to none, hard cap of one line. A comment block above a test explaining its motivation, the convention it follows, or what a sibling integration does is rationale for a reviewer — put it in the PR body and let the test name carry the intent. Sweep before reporting: `git diff -U0 -- <test paths> | grep -E '^\+[[:space:]]*(#|//|/\*|\*)'` and delete what fails that test.
- **Assert behavior, not implementation.** Prefer public API + observable output/`testTag` selectors over internal call counts and exact-text matching, so tests survive refactors.
- **Regression tests must actually catch the regression.** For a bug fix, ensure the test fails on the old behavior before it passes on the new.
- **No silent scope cuts.** If you skipped hard-to-test code (UI needing a device, external integration), list it in the report rather than pretending it's covered.
