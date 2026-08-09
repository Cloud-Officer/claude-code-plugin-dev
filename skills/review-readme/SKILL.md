---
name: review-readme
description: Review, create, update, check, fix, improve, write, or audit README.md. Use when the user wants to review the README, check the README, fix the README, write a README, improve the README, or update the README to match organizational standards with accurate project-specific content.
allowed-tools: Bash(gh:*), Bash(git:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(mkdir:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*), Read, Write, Edit, Glob, Grep, TodoWrite, WebSearch, Skill, mcp__github__get_file_contents, mcp__fetch__fetch, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Review README.md

Review the main README.md file in a repository and create or update it to match organizational standards. This skill analyzes the codebase to ensure README content is accurate and complete. Works for all repository types (public/private) and all languages.

## Phase Tracking

Use `TodoWrite` to track each phase below. Mark `in_progress` on entry, `completed` when results are recorded. Do NOT include the task list in the final output.

**Required phases:**

1. Repository information gathered
2. Project type and stack detected
3. README structure validated
4. Introduction section verified
5. Installation section verified
6. Usage section verified
7. License and Contributing validated
8. Report generated

**Evidence rule:** Every check must record (a) what the README claims — the exact text/command/feature, (b) what the code shows (package.json `bin` field, entry points, exports, scripts), (c) MATCH / MISMATCH / MISSING with specific details. A bare "PASS" without evidence is invalid — the check is incomplete.

**DO NOT SKIP STEPS.** Even if an earlier check seems to suggest no issues, you MUST complete ALL steps. Issues are often only revealed when cross-referencing multiple sources.

## Required README Structure

The README.md must have **exactly** these H2 sections in this exact order — no more, no fewer:

```text
## Table of Contents
## Introduction
## Installation
## Usage
## Contributing
```

**STRICT RULE — No Additional H2 Sections:** These 5 sections are the ONLY allowed H2-level headings. All other content MUST be placed as H3+ subsections under the most relevant existing H2 section. In most cases, additional content belongs under `## Usage` (e.g., Configuration, API Reference, Examples, Environment Variables, Deployment, Docker, CI/CD, Testing, Troubleshooting). When reviewing or creating a README, if you encounter H2 sections that are not in the list above (e.g., `## Configuration`, `## API`, `## Deployment`, `## Testing`), they must be converted to H3 subsections under the appropriate parent H2 — typically `## Usage`.

## MCP Tools with Fallbacks

This skill uses MCP tools when available and falls back gracefully if they are unavailable or return errors.

**Failure policy (applies to every command and tool call in this skill):** a command that fails or returns nothing stops that step — report what failed and ask how to proceed. Falling back to a documented alternative (MCP → CLI) is allowed; silently substituting fabricated or assumed values for the stored metadata is not.

### GitHub Access

**Prefer MCP tools** (`mcp__github__*`) when available. If MCP tools are not available (tool not found errors), **fall back to the `gh` CLI**.

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Get repo metadata | `mcp__github__get_file_contents` (path: `/`) for top-level structure; for richer metadata use the CLI fallback | `gh repo view --json owner,name,visibility,licenseInfo,description` |
| Get file contents | `mcp__github__get_file_contents` | `cat <file>` |
| Get repo owner/name | Parse from `git remote get-url origin` | `gh repo view --json owner,name` |

### Library Documentation (Context7)

Use `mcp__context7__resolve-library-id` then `mcp__context7__query-docs` to look up current documentation for libraries and frameworks found in the project. If Context7 is unavailable or returns errors (quota exceeded, timeouts), **fall back to `WebSearch`** and then `mcp__fetch__fetch` to retrieve documentation from official sources. Do not let Context7 failures block the review.

## Step 1: Gather Repository Information

Run these commands to collect repository metadata:

```bash
# Get organization and repository name (fallback if MCP tools unavailable)
gh repo view --json owner,name,visibility,licenseInfo,description
```

```bash
# Get the default branch
git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'
```

```bash
# Check if build.yml workflow exists
ls -la .github/workflows/build.yml 2>/dev/null || echo "No build.yml found"
```

```bash
# Check for existing README (case-insensitive)
ls -la README.md readme.md Readme.md 2>/dev/null || echo "No README found"
```

```bash
# Check for license file
ls -la LICENSE LICENSE.md LICENSE.txt license license.md license.txt 2>/dev/null || echo "No license file found"
```

Store these values:

- `organization`: The owner/organization name
- `repository`: The repository name
- `visibility`: "public" or "private"
- `description`: Repository description from GitHub
- `default_branch`: The default branch name from the `git symbolic-ref` command above (e.g. `master`, `main`)
- `has_build_yml`: true/false
- `has_license`: true/false
- `readme_file`: The existing README filename or "README.md" if creating new

## Step 2: Detect Project Type and Stack

Analyze the repository to determine the project type, language, and tooling.

### Check for Project Files

```bash
# List all potential project files
ls -la package.json package-lock.json yarn.lock pnpm-lock.yaml \
  requirements.txt setup.py pyproject.toml Pipfile poetry.lock \
  Cargo.toml go.mod go.sum \
  Makefile CMakeLists.txt \
  Dockerfile docker-compose.yml docker-compose.yaml \
  Gemfile composer.json pom.xml build.gradle build.gradle.kts \
  *.sln *.csproj \
  mix.exs pubspec.yaml \
  2>/dev/null || echo "No standard project files found"
```

### Project Type Detection Table

| Files Present        | Project Type  | Package Manager | Install Command                                   |
|----------------------|---------------|-----------------|---------------------------------------------------|
| `package.json`       | Node.js       | npm/yarn/pnpm   | `npm install` or `yarn install` or `pnpm install` |
| `requirements.txt`   | Python        | pip             | `pip install -r requirements.txt`                 |
| `pyproject.toml`     | Python        | pip/poetry      | `pip install .` or `poetry install`               |
| `setup.py`           | Python        | pip             | `pip install .`                                   |
| `Pipfile`            | Python        | pipenv          | `pipenv install`                                  |
| `Cargo.toml`         | Rust          | cargo           | `cargo build`                                     |
| `go.mod`             | Go            | go modules      | `go build`                                        |
| `Gemfile`            | Ruby          | bundler         | `bundle install`                                  |
| `composer.json`      | PHP           | composer        | `composer install`                                |
| `pom.xml`            | Java          | maven           | `mvn install`                                     |
| `build.gradle`       | Java/Kotlin   | gradle          | `gradle build`                                    |
| `*.csproj` / `*.sln` | .NET          | dotnet          | `dotnet restore && dotnet build`                  |
| `mix.exs`            | Elixir        | mix             | `mix deps.get`                                    |
| `pubspec.yaml`       | Dart/Flutter  | pub             | `dart pub get` or `flutter pub get`               |
| `Makefile`           | Any           | make            | `make` or `make install`                          |
| `Dockerfile`         | Containerized | docker          | `docker build -t <name> .`                        |

### Extract Project Metadata

Based on detected project type, extract metadata:

**For Node.js (package.json):**

```bash
cat package.json |
  jq -r '{name, version, description, main, bin, scripts: .scripts | keys, dependencies: .dependencies | keys, devDependencies: .devDependencies | keys}'
```

**For Python (pyproject.toml):**

```bash
cat pyproject.toml
```

**For Python (setup.py):**

```bash
head -50 setup.py
```

**For Rust (Cargo.toml):**

```bash
cat Cargo.toml
```

**For Go (go.mod):**

```bash
cat go.mod
```

**For Makefile projects:**

```bash
# List available make targets
grep -E '^[a-zA-Z_-]+:' Makefile | sed 's/:.*//' | head -20
```

Store detected information:

- `project_type`: Node.js, Python, Rust, Go, etc.
- `package_manager`: npm, pip, cargo, etc.
- `project_name`: From package metadata
- `project_description`: From package metadata
- `version`: Current version
- `entry_points`: CLI commands, bin scripts, main exports
- `available_scripts`: npm scripts, make targets, etc.
- `dependencies`: Key dependencies that might need documentation

## Step 3: Validate or Create README.md Structure

### H1 Title Format

If `.github/workflows/build.yml` exists, the first line MUST be:

```markdown
# {repository} [![Build](https://github.com/{organization}/{repository}/actions/workflows/build.yml/badge.svg)](https://github.com/{organization}/{repository}/actions/workflows/build.yml)
```

If no build.yml exists, the first line should be:

```markdown
# {repository}
```

### Required H2 Sections

Verify the README contains these H2 sections in order:

```bash
grep "^## " README.md
```

**Expected output must be exactly:**

```text
## Table of Contents
## Introduction
## Installation
## Usage
## Contributing
```

**No other H2 sections are allowed.** If additional H2 headings exist (e.g., `## Configuration`, `## API`, `## Deployment`, `## Testing`, `## Docker`, `## Troubleshooting`), flag them as issues and convert them to H3 subsections under the appropriate required H2 — typically `## Usage`.

### Table of Contents

`## Table of Contents` must be a nested list of anchor links to every other heading in the README — the four remaining H2 sections and their H3 subsections — in document order, with no entry that does not resolve to a heading. Regenerate it after any heading is added, renamed, or demoted from H2 to H3, so the demotions required above are reflected in the nesting.

## Step 4: Verify and Update Introduction Section

The Introduction section must accurately describe the project.

### Required Elements

1. **Project purpose**: What problem does it solve?
2. **Key features**: Main capabilities (as bullet list)
3. **Target audience**: Who should use this?

### Verification Process

1. Read the current Introduction section
2. Compare against:
   - GitHub repo description
   - Package description (from package.json, pyproject.toml, etc.)
   - Main source files to understand purpose
3. Flag if Introduction is:
   - Missing or empty
   - Generic placeholder text
   - Inconsistent with actual project purpose
   - Missing key features

### Example Introduction Structure

```markdown
## Introduction

{Project name} is a {type of tool/library/application} that {main purpose}.

### Features

- {Key feature 1}
- {Key feature 2}
- {Key feature 3}

### Why {Project name}?

{Brief explanation of benefits or use cases}
```

## Step 5: Verify and Update Installation Section

The Installation section must contain accurate, working instructions.

### Required Elements Based on Project Type

**For all projects:**

1. Prerequisites (runtime version, system dependencies)
2. Installation command(s)
3. Verification step (how to confirm installation worked)

### Verification Process

1. Read the current Installation section
2. Cross-reference with detected project files:
   - Check if install commands match the actual package manager
   - Verify prerequisites match `engines` field (Node.js) or similar
   - Check for system dependencies in Dockerfile or CI config
3. Flag if Installation:
   - Has wrong install commands for the project type
   - Missing prerequisites
   - References outdated package managers
   - Missing build steps for compiled languages

**Exception for Claude Code plugins:** Installation instructions using `/plugin marketplace add`, `/plugin install`, or `claude --plugin-dir` are valid and should NOT be flagged as incorrect. These plugins do not require prerequisites sections.

### Project-Specific Installation Templates

**Node.js:**

````markdown
## Installation

### Prerequisites

- Node.js {version from engines or >=18.0.0}
- npm (or yarn/pnpm)

### Install

```bash
npm install {package-name}
```

Or clone and install locally:

```bash
git clone https://github.com/{org}/{repo}.git
cd {repo}
npm install
```
````

**Python:**

````markdown
## Installation

### Prerequisites

- Python {version from requires-python or >=3.8}
- pip

### Install from PyPI

```bash
pip install {package-name}
```

### Install from source

```bash
git clone https://github.com/{org}/{repo}.git
cd {repo}
pip install -e .
```
````

**Rust:**

````markdown
## Installation

### Prerequisites

- Rust {version from rust-version or stable}
- Cargo

### Install from crates.io

```bash
cargo install {crate-name}
```

### Build from source

```bash
git clone https://github.com/{org}/{repo}.git
cd {repo}
cargo build --release
```
````

**Go:**

````markdown
## Installation

### Prerequisites

- Go {version from go.mod}

### Install

```bash
go install github.com/{org}/{repo}@latest
```
````

**Docker:**

````markdown
## Installation

### Using Docker

```bash
docker pull {image-name}

# or build locally
docker build -t {image-name} .
```
````

**Makefile projects:**

````markdown
## Installation

### Prerequisites

{List any system dependencies}

### Build and Install

```bash
git clone https://github.com/{org}/{repo}.git
cd {repo}
make
make install
```
````

## Step 6: Verify and Update Usage Section

The Usage section must show real, working examples.

### Required Elements

1. **Basic usage**: Simplest way to use the tool/library
2. **Common examples**: 2-3 typical use cases
3. **Configuration**: How to configure (if applicable)

### Verification Process (MANDATORY - do not skip)

1. Read the current Usage section and list every command, API, or feature it claims exists
2. For EACH claimed command/API, verify it exists by cross-referencing with:
   - `bin` field in package.json (CLI commands)
   - Exported functions/classes in main entry point
   - Example files in `examples/` directory
   - Test files for usage patterns
   - npm scripts / make targets
3. Record evidence for each: "README claims X → code shows Y → MATCH/MISMATCH"
4. Flag if Usage:
   - Shows commands/APIs that don't exist
   - Missing primary use cases
   - Has outdated syntax
   - Missing configuration options

### Detect CLI Commands

**Node.js:**

```bash
# Check bin field
cat package.json | jq -r '.bin // empty'
# Check npm scripts
cat package.json | jq -r '.scripts | keys[]'
```

**Python:**

```bash
# Check entry points in pyproject.toml
grep -A 10 '\[project.scripts\]' pyproject.toml 2>/dev/null
grep -A 10 '\[tool.poetry.scripts\]' pyproject.toml 2>/dev/null
# Check console_scripts in setup.py
grep -A 5 'console_scripts' setup.py 2>/dev/null
```

### Usage Section Templates

**For CLI tools:**

````markdown
## Usage

### Basic Usage

```bash
{command} [options] <arguments>
```

### Examples

{Example 1 - most common use case}:

```bash
{command} {args}
```

{Example 2 - another common use case}:

```bash
{command} {args}
```

### Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help |
| `{option}` | {description} |
````

**For libraries:**

````markdown
## Usage

### Basic Usage

```{language}
import {package}

# Basic example
{code example}
```

### API Reference

#### `{function/class name}`

{Description}

```{language}
{example}
```
````

**For applications:**

````markdown
## Usage

### Running the Application

```bash
{start command}
```

### Configuration

{Configuration options and environment variables}

### API Endpoints (if applicable)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/...` | {description} |
````

## Step 7: Validate License and Contributing Sections

### License File Based on Visibility

**For PUBLIC Repositories:**

- License file is REQUIRED
- If missing, warn: "This is a public repository but no LICENSE file was found."

**For PRIVATE Repositories:**

- License file should NOT exist
- If found, warn: "This is a private repository but a LICENSE file was found."

### Contributing Section Based on Visibility

**For PUBLIC Repositories:**

Must contain contribution guidelines with:

- Instructions for contributing (forking or branching)
- Mention of pull requests

**IMPORTANT:** Do not flag as incorrect if the existing section covers these topics in a different style or wording. The template below is just ONE example - variations are acceptable as long as they explain how to contribute.

Template (example, not required format):

```markdown
## Contributing

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

* Reporting a bug
* Discussing the current state of the code
* Submitting a fix
* Proposing new features
* Becoming a maintainer

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `{default_branch}`.
2. If you've added code that should be tested, add tests. Ensure the test suite passes.
3. Update the documentation.
4. Make sure your code lints.
5. Issue that pull request!

When you submit code changes, your submissions are understood to be under the same [License](LICENSE) that covers the project. Feel free to contact the maintainers if that's a concern.
```

**For PRIVATE Repositories:**

Must contain contribution guidelines with:

- Instructions for submitting code (branching, PRs, etc.)

**IMPORTANT:** Private repos may use any style of Contributing section. Do not flag as incorrect if the existing section covers these topics in a different style or wording. The template below is just ONE example - variations are acceptable as long as they explain how to contribute.

Template (example, not required format):

```markdown
## Contributing

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

* Reporting a bug
* Discussing the current state of the code
* Submitting a fix
* Proposing new features
* Becoming a maintainer

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Create your branch from `{default_branch}`.
2. If you've added code that should be tested, add tests. Ensure the test suite passes.
3. Update the documentation.
4. Make sure your code lints.
5. Issue that pull request!
```

## Step 8: Generate Report and Apply Fixes

**MANDATORY PRE-REPORT VERIFICATION:** Every phase must be `completed` before the report is generated — if any phase is unfinished, STOP and complete it first. Every issue found during analysis MUST appear in the report.

After analysis, provide a comprehensive report:

### Report Format

```text
## README Review Report

### Repository Info
- **Organization:** {org}
- **Repository:** {repo}
- **Visibility:** {public/private}
- **Project Type:** {detected type}

### Structure Checks
- [ ] H1 title format: {PASS/FAIL}
- [ ] Required H2 sections present: {PASS/FAIL}
- [ ] No extra H2 sections: {PASS/FAIL} - {list any extra H2 that need demotion to H3}
- [ ] Section order: {PASS/FAIL}

### Content Accuracy Checks
- [ ] Introduction matches project: {PASS/FAIL/NEEDS UPDATE}
- [ ] Installation instructions accurate: {PASS/FAIL/NEEDS UPDATE}
- [ ] Usage examples work: {PASS/FAIL/NEEDS UPDATE}
- [ ] Contributing section appropriate: {PASS/FAIL}

### License Check
- [ ] License file presence correct: {PASS/FAIL}

### Issues Found
1. {Issue description}
2. {Issue description}

### Proposed Changes
{Show exact changes needed with before/after}
```

**Ask the user before making changes:**

> "I found the following issues with README.md. Would you like me to fix them?"

## Validation Checklist

Before completing, verify:

- [ ] H1 title matches expected format (with or without build badge)
- [ ] Exactly 5 H2 sections present in correct order (no extra H2 sections)
- [ ] Table of Contents links every other heading and matches the final heading levels
- [ ] Introduction accurately describes the project
- [ ] Installation instructions match actual project setup
- [ ] Usage examples reflect real commands/APIs
- [ ] Contributing section matches repository visibility
- [ ] License file presence matches repository visibility

## Step 9: Run Linters

After making changes to README.md, run the linters skill to ensure the file passes all markdown linting rules:

```text
/co-dev:run-linters
```

Fix any linting errors before considering the task complete.

## Important Rules

1. **Never fabricate information** - Only document what actually exists in the code
2. **Verify before documenting** - Check that commands/APIs exist before adding them
3. **Never remove existing content** - Only add missing sections or fix inaccuracies
4. **Demote extra H2 sections** - Any H2 section not in the 5 required sections (Table of Contents, Introduction, Installation, Usage, Contributing) must be converted to an H3 subsection under the appropriate parent H2 (typically Usage). Preserve the content but fix the heading level
5. **Ask before modifying** - Always show proposed changes and get user approval
6. **Use exact formatting** - The build badge URL format must match exactly for CI validation
7. **Keep examples simple** - Show the most common use cases, not every option
8. **Run linters after changes** - Always run `/co-dev:run-linters` after modifying README.md
9. **Complete ALL steps** - Never skip analysis steps. Each step may reveal issues not visible in other steps
10. **Never validate against world knowledge alone** - Do NOT use your training data to fact-check version numbers, release dates, or external claims. If uncertain about something (e.g., "does Ruby 4.0 exist?"), use web search to verify before flagging. Only validate things that can be cross-referenced against actual files in the repository or verified online.
11. **Review-only invocation** - When another skill invokes this one with a review-only instruction (e.g. code-review-deep's opt-in deep documentation pass), analyze and report findings only: do not create, write, or edit README.md or any other file
