---
name: review-readme
description: Review, create, or update README.md to match organizational standards with accurate project-specific content
allowed-tools: Bash(gh:*), Bash(git:*), Bash(ls:*), Bash(cat:*), Bash(head:*), Bash(jq:*), Bash(awk:*), Bash(sed:*), Bash(echo:*), Read, Write, Edit, Glob, Grep, WebSearch
---

# Review README.md

Review the main README.md file in a repository and create or update it to match organizational standards. This skill analyzes the codebase to ensure README content is accurate and complete. Works for all repository types (public/private) and all languages.

## CRITICAL: Mandatory Analysis Tracking

**You MUST maintain an analysis checklist throughout execution.** At each step, record what was found. This ensures consistent, reproducible results.

**Before starting, create this tracking structure and update it as you progress:**

```text
=== ANALYSIS CHECKPOINT LOG ===
[ ] Step 1: Repository Information
    - organization: (pending)
    - repository: (pending)
    - visibility: (pending)
    - description: (pending)
    - has_build_yml: (pending)
    - has_license: (pending)
    - readme_file: (pending)

[ ] Step 2: Project Type Detection
    - project_type: (pending)
    - package_manager: (pending)
    - project_name: (pending)
    - project_description: (pending)
    - version: (pending)
    - entry_points: (pending)
    - available_scripts: (pending)
    - dependencies: (pending)

[ ] Step 3: Structure Validation
    - h1_title_format: (pending) - expected vs actual
    - required_h2_sections: (pending) - list found vs expected
    - section_order: (pending) - correct/incorrect

[ ] Step 4: Introduction Section
    - section_exists: (pending)
    - has_project_purpose: (pending)
    - has_key_features: (pending)
    - has_target_audience: (pending)
    - matches_package_description: (pending)
    - issues: (pending)

[ ] Step 5: Installation Section
    - section_exists: (pending)
    - has_prerequisites: (pending)
    - has_install_commands: (pending)
    - has_verification_step: (pending)
    - commands_match_project_type: (pending)
    - issues: (pending)

[ ] Step 6: Usage Section
    - section_exists: (pending)
    - has_basic_usage: (pending)
    - has_examples: (pending)
    - has_configuration: (pending)
    - cli_commands_verified: (pending) - list commands checked
    - api_exports_verified: (pending) - list exports checked
    - issues: (pending)

[ ] Step 7: License and Contributing
    - license_file_exists: (pending)
    - license_matches_visibility: (pending) - PASS/FAIL
    - contributing_section_exists: (pending)
    - contributing_matches_visibility: (pending) - PASS/FAIL
    - issues: (pending)

[ ] Step 8: Report Generated
    - all_checks_completed: (pending)
    - issues_found: (pending)
=== END CHECKPOINT LOG ===
```

**COMPLETION REQUIREMENT:** Before generating the final report, you MUST verify that ALL checkpoints show actual values (not "pending"). If any checkpoint is still "pending", go back and complete that analysis step.

**EVIDENCE REQUIREMENT:** For every check, you MUST record:

1. **What the README claims** - the exact text/command/feature described
2. **What the code shows** - the actual evidence (package.json bin field, entry points, exports, scripts)
3. **Comparison result** - MATCH, MISMATCH, or MISSING with specific details

A bare "PASS" without evidence is not acceptable. If you cannot provide evidence, the check is incomplete.

**DO NOT SKIP STEPS.** Even if an earlier check seems to suggest no issues, you MUST complete ALL steps. Issues are often only revealed when cross-referencing multiple sources.

## Required README Structure

The README.md must have the following H2 sections in this exact order (additional H2/H3+ sections may follow):

```text
## Table of Contents
## Introduction
## Installation
## Usage
## Contributing
```

## Step 1: Gather Repository Information

Run these commands to collect repository metadata:

```bash
# Get organization and repository name
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

**Expected output must start with:**

```text
## Table of Contents
## Introduction
## Installation
## Usage
## Contributing
```

Additional H2 sections may appear after `## Contributing`.

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

```markdown
## Installation

### Prerequisites

- Node.js {version from engines or >=18.0.0}
- npm (or yarn/pnpm)

### Install

\`\`\`bash npm install {package-name} \`\`\`

Or clone and install locally:

\`\`\`bash git clone https://github.com/{org}/{repo}.git
cd {repo} npm install \`\`\`
```

**Python:**

```markdown
## Installation

### Prerequisites

- Python {version from requires-python or >=3.8}
- pip

### Install from PyPI

\`\`\`bash pip install {package-name} \`\`\`

### Install from source

\`\`\`bash git clone https://github.com/{org}/{repo}.git
cd {repo} pip install -e . \`\`\`
```

**Rust:**

```markdown
## Installation

### Prerequisites

- Rust {version from rust-version or stable}
- Cargo

### Install from crates.io

\`\`\`bash cargo install {crate-name} \`\`\`

### Build from source

\`\`\`bash git clone https://github.com/{org}/{repo}.git
cd {repo} cargo build --release \`\`\`
```

**Go:**

```markdown
## Installation

### Prerequisites

- Go {version from go.mod}

### Install

\`\`\`bash go install github.com/{org}/{repo}@latest \`\`\`
```

**Docker:**

```markdown
## Installation

### Using Docker

\`\`\`bash docker pull {image-name}

# or build locally

docker build -t {image-name} . \`\`\`
```

**Makefile projects:**

```markdown
## Installation

### Prerequisites

{List any system dependencies}

### Build and Install

\`\`\`bash git clone https://github.com/{org}/{repo}.git
cd {repo} make make install \`\`\`
```

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

```markdown
## Usage

### Basic Usage

\`\`\`bash {command} [options] <arguments>
\`\`\`

### Examples

{Example 1 - most common use case}:

\`\`\`bash {command} {args} \`\`\`

{Example 2 - another common use case}:

\`\`\`bash {command} {args} \`\`\`

### Options

| Option | Description |
|--------|-------------|
| \`-h, --help\` | Show help |
| \`{option}\` | {description} |
```

**For libraries:**

```markdown
## Usage

### Basic Usage

\`\`\`{language} import {package}

# Basic example

{code example} \`\`\`

### API Reference

#### \`{function/class name}\`

{Description}

\`\`\`{language} {example} \`\`\`
```

**For applications:**

```markdown
## Usage

### Running the Application

\`\`\`bash {start command} \`\`\`

### Configuration

{Configuration options and environment variables}

### API Endpoints (if applicable)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | \`/api/...\` | {description} |
```

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

1. Fork the repo and create your branch from `master`.
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

1. Create your branch from `master`.
2. If you've added code that should be tested, add tests. Ensure the test suite passes.
3. Update the documentation.
4. Make sure your code lints.
5. Issue that pull request!
```

## Step 8: Generate Report and Apply Fixes

**MANDATORY PRE-REPORT VERIFICATION:**

Before generating the report, you MUST:

1. Review your checkpoint log from the start of analysis
2. Verify ALL checkpoints have actual values (not "pending")
3. If ANY checkpoint is still pending, STOP and complete that step first
4. Cross-reference findings: issues found in code analysis MUST appear in the report

**If you skipped any step, the review is incomplete and results will be inconsistent.**

After analysis, provide a comprehensive report:

### Report Format

```text
## README Review Report

### Analysis Checkpoint Log

{Include your completed checkpoint log here - ALL values must be filled in, none should say "pending"}

### Repository Info
- **Organization:** {org}
- **Repository:** {repo}
- **Visibility:** {public/private}
- **Project Type:** {detected type}

### Structure Checks
- [ ] H1 title format: {PASS/FAIL}
- [ ] Required H2 sections: {PASS/FAIL}
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
- [ ] All required H2 sections present in correct order
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
4. **Preserve custom sections** - Additional H2/H3 sections after the required ones should be kept
5. **Ask before modifying** - Always show proposed changes and get user approval
6. **Use exact formatting** - The build badge URL format must match exactly for CI validation
7. **Keep examples simple** - Show the most common use cases, not every option
8. **Run linters after changes** - Always run `/co-dev:run-linters` after modifying README.md
9. **Complete ALL steps** - Never skip analysis steps. Each step may reveal issues not visible in other steps
10. **Output checkpoint log** - Include the completed checkpoint log in your final report to prove all steps were executed
11. **Never validate against world knowledge alone** - Do NOT use your training data to fact-check version numbers, release dates, or external claims. If uncertain about something (e.g., "does Ruby 4.0 exist?"), use web search to verify before flagging. Only validate things that can be cross-referenced against actual files in the repository or verified online.
