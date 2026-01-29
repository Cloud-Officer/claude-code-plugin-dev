---
name: review-manual
description: Review, create, or update docs/manual.md with user documentation for the product
allowed-tools: Bash(gh:*), Bash(git:*), Bash(ls:*), Bash(cat:*), Bash(head:*), Bash(tail:*), Bash(jq:*), Bash(find:*), Bash(wc:*), Bash(awk:*), Bash(sed:*), Bash(echo:*), Read, Write, Edit, Glob, Grep, WebSearch
---

# Review User Manual Documentation

Review the `docs/manual.md` file in a repository and create or update it with comprehensive user documentation. This skill analyzes the codebase to document the product from an end-user perspective, covering UI, features, workflows, and usage instructions. Works for all project types and languages.

## CRITICAL: Mandatory Analysis Tracking

**You MUST maintain an analysis checklist throughout execution.** At each step, record what was found. This ensures consistent, reproducible results.

**Before starting, create this tracking structure and update it as you progress:**

```text
=== ANALYSIS CHECKPOINT LOG ===
[ ] Step 1: Repository Information
    - organization: (pending)
    - repository: (pending)
    - description: (pending)
    - has_manual: (pending)

[ ] Step 2: Product Type Detection
    - product_type: (pending) - web_app/cli_tool/api/library/mobile_app/desktop_app/hybrid
    - framework: (pending)
    - detection_evidence: (pending)

[ ] Step 3-7: Deep Analysis (complete applicable sections)
    For Web Applications:
    [ ] 3.1 Routes/Pages - routes_found: (pending), count: (pending)
    [ ] 3.2 Models/Data - models_found: (pending), count: (pending)
    [ ] 3.3 Forms - forms_found: (pending), count: (pending)
    [ ] 3.4 UI Components - components_found: (pending), count: (pending)
    [ ] 3.5 Navigation - nav_elements: (pending)

    For CLI Tools:
    [ ] 4.1 Commands - commands_found: (pending), count: (pending)
    [ ] 4.2 Help Output - help_extracted: (pending)
    [ ] 4.3 Options/Flags - options_found: (pending), count: (pending)

    For APIs:
    [ ] 5.1 Endpoints - endpoints_found: (pending), count: (pending)
    [ ] 5.2 Schemas - schemas_found: (pending)
    [ ] 5.3 Authentication - auth_method: (pending)
    [ ] 5.4 OpenAPI - openapi_exists: (pending)

    For Libraries:
    [ ] 6.1 Public API - exports_found: (pending), count: (pending)
    [ ] 6.2 Docstrings - documented: (pending)
    [ ] 6.3 Examples - examples_found: (pending)

    For Mobile Apps:
    [ ] 7.1 Screens - screens_found: (pending), count: (pending)
    [ ] 7.2 Navigation - nav_structure: (pending)

[ ] Step 8: Document Structure Validation (if manual.md exists)
    - h1_title_correct: (pending)
    - required_sections_present: (pending)
    - toc_links_valid: (pending)

[ ] Step 9: Report Generated
    - all_checks_completed: (pending)
    - features_in_code: (pending)
    - features_documented: (pending)
    - undocumented_features: (pending)
    - issues_found: (pending)
=== END CHECKPOINT LOG ===
```

**COMPLETION REQUIREMENT:** Before generating the final report, you MUST verify that ALL applicable checkpoints show actual values (not "pending"). If any checkpoint is still "pending", go back and complete that analysis step.

**EVIDENCE REQUIREMENT:** For every check, you MUST record:

1. **What the manual claims** - the exact feature, command, or workflow described
2. **What the code shows** - the actual evidence (routes, controllers, CLI definitions, API endpoints)
3. **Comparison result** - MATCH, MISMATCH, or MISSING with specific details

A bare "PASS" without evidence is not acceptable. If you cannot provide evidence, the check is incomplete.

**DO NOT SKIP STEPS.** Even if an earlier check seems to suggest no issues, you MUST complete ALL steps. Issues are often only revealed when cross-referencing multiple sources.

## Manual Document Structure

The manual must have the following H1 title and H2 sections:

```text
# User Manual

## Table of Contents
## Getting Started
## Features
## {Project-Type-Specific Sections}
## Configuration
## Troubleshooting
## FAQ
```

### Project-Type-Specific Sections

**Web Applications (Rails, Django, Express, Laravel, etc.):**

```text
## Navigation
## Pages
## Forms & Input
## Workflows
```

**CLI Tools:**

```text
## Commands
## Options & Flags
## Examples
```

**REST APIs:**

```text
## Authentication
## Endpoints
## Request/Response Examples
## Error Handling
```

**Libraries/SDKs:**

```text
## Installation
## Quick Start
## API Reference
## Examples
```

**Mobile Applications:**

```text
## Screens
## Navigation
## Features
## Offline Mode
```

**Desktop Applications:**

```text
## Windows & Views
## Menus & Toolbars
## Keyboard Shortcuts
## Features
```

## Step 1: Gather Repository Information

```bash
# Get organization and repository name
gh repo view --json owner,name,description
```

```bash
# Check if docs/manual.md exists
ls -la docs/manual.md 2>/dev/null || echo "No docs/manual.md found"
```

```bash
# Check if docs directory exists
ls -la docs/ 2>/dev/null || echo "No docs directory found"
```

Store these values:

- `organization`: The owner/organization name
- `repository`: The repository name
- `description`: Repository description
- `has_manual`: true/false

## Step 2: Detect Product Type

Analyze the repository to determine what type of product this is.

### Web Application Detection

**Ruby on Rails:**

```bash
# Check for Rails
ls -la Gemfile config/routes.rb app/controllers/ app/views/ 2>/dev/null
cat Gemfile 2>/dev/null | grep -E "rails|gem 'rails'"
```

**Django:**

```bash
# Check for Django
ls -la manage.py */urls.py */views.py */templates/ 2>/dev/null
cat requirements.txt pyproject.toml 2>/dev/null | grep -iE "django"
```

**Express/Node.js Web:**

```bash
# Check for Express/web frameworks
cat package.json 2>/dev/null | jq -r '.dependencies | keys[]' | grep -iE "express|koa|fastify|hapi|nest"
ls -la views/ templates/ public/ src/pages/ src/routes/ 2>/dev/null
```

**Laravel:**

```bash
# Check for Laravel
ls -la artisan routes/web.php app/Http/Controllers/ resources/views/ 2>/dev/null
```

**Next.js/React:**

```bash
# Check for Next.js/React apps
ls -la pages/ app/ src/pages/ src/app/ components/ 2>/dev/null
cat package.json 2>/dev/null | jq -r '.dependencies | keys[]' | grep -iE "next|react|vue|angular|svelte"
```

### CLI Tool Detection

```bash
# Check for CLI patterns
cat package.json 2>/dev/null | jq -r '.bin // empty'
grep -rl "argparse\|click\|typer\|commander\|yargs\|clap\|cobra" --include="*.py" --include="*.js" --include="*.ts" --include="*.rs" --include="*.go" . 2>/dev/null |
  head -5
ls -la cmd/ cli/ bin/ 2>/dev/null
```

### API Detection

```bash
# Check for API patterns
grep -rl "@app.route\|@router\|@Controller\|@RestController\|@GetMapping\|@PostMapping\|router.get\|router.post" --include="*.py" --include="*.js" --include="*.ts" --include="*.java" --include="*.rb" . 2>/dev/null |
  head -10
ls -la api/ routes/ endpoints/ 2>/dev/null
cat package.json 2>/dev/null | jq -r '.dependencies | keys[]' | grep -iE "fastapi|flask|express|gin|echo|fiber"
```

### Library Detection

```bash
# Check if it's a library (no app entry point, exports functions/classes)
cat package.json 2>/dev/null | jq -r '.main, .exports, .types' | grep -v null
cat setup.py pyproject.toml 2>/dev/null | grep -E "name|packages"
ls -la src/lib/ lib/ 2>/dev/null
```

### Mobile App Detection

```bash
# Check for mobile frameworks
ls -la android/ ios/ lib/main.dart pubspec.yaml 2>/dev/null
cat package.json 2>/dev/null | jq -r '.dependencies | keys[]' | grep -iE "react-native|expo|ionic|capacitor"
```

### Classification

Based on detection, classify as one of:

- `web_app` - Web application with UI
- `cli_tool` - Command-line interface tool
- `api` - REST/GraphQL API service
- `library` - Reusable library/SDK
- `mobile_app` - Mobile application
- `desktop_app` - Desktop application
- `hybrid` - Multiple types (e.g., CLI + library)

## Step 3: Deep Analysis - Web Applications

### 3.1 Discover Routes/Pages

**Rails:**

```bash
# Get all routes
cat config/routes.rb
# Find controllers
ls -la app/controllers/*.rb
# Find views
find app/views -name "*.erb" -o -name "*.haml" -o -name "*.slim" 2>/dev/null | head -30
```

**Django:**

```bash
# Get URL patterns
cat */urls.py
# Find views
find . -name "views.py" -not -path "*/venv/*" 2>/dev/null | xargs cat 2>/dev/null | head -100
# Find templates
find . -name "*.html" -path "*/templates/*" 2>/dev/null | head -30
```

**Express/Node:**

```bash
# Find route definitions
grep -rn "router\.\(get\|post\|put\|delete\|patch\)\|app\.\(get\|post\|put\|delete\|patch\)" --include="*.js" --include="*.ts" . 2>/dev/null |
  grep -v node_modules | head -30
```

**Next.js/React:**

```bash
# Find pages
find pages app src/pages src/app -name "*.tsx" -o -name "*.jsx" -o -name "*.js" 2>/dev/null | grep -v _app |
  grep -v _document | head -30
```

### 3.2 Discover Models/Data Structures

**Rails:**

```bash
# Get models
ls -la app/models/*.rb
# Get schema
cat db/schema.rb 2>/dev/null | head -100
```

**Django:**

```bash
# Get models
find . -name "models.py" -not -path "*/venv/*" 2>/dev/null | xargs cat 2>/dev/null | grep -E "class.*Model" | head -30
```

### 3.3 Discover Forms

**Rails:**

```bash
# Find form templates
grep -rl "form_for\|form_with\|form_tag" app/views/ 2>/dev/null | head -20
```

**Django:**

```bash
# Find forms
find . -name "forms.py" -not -path "*/venv/*" 2>/dev/null | xargs cat 2>/dev/null | head -50
```

**React/Vue:**

```bash
# Find form components
grep -rl "<form\|<Form\|useForm\|formik\|react-hook-form" --include="*.tsx" --include="*.jsx" --include="*.vue" . 2>/dev/null |
  grep -v node_modules | head -20
```

### 3.4 Extract UI Components

```bash
# Find component files
find . -name "*.tsx" -o -name "*.jsx" -o -name "*.vue" -o -name "*.svelte" 2>/dev/null | grep -v node_modules |
  grep -iE "component|page|view|screen" | head -30
```

### 3.5 Discover Navigation

```bash
# Find navigation components
grep -rl "nav\|menu\|sidebar\|header\|footer\|navbar\|drawer" --include="*.tsx" --include="*.jsx" --include="*.vue" --include="*.erb" --include="*.html" . 2>/dev/null |
  grep -v node_modules | head -15
```

## Step 4: Deep Analysis - CLI Tools

### 4.1 Discover Commands

**Python (Click/Typer/Argparse):**

```bash
# Find CLI entry points
grep -rn "@click.command\|@click.group\|@app.command\|add_parser\|add_subparser" --include="*.py" . 2>/dev/null |
  grep -v venv | head -30
```

**Node.js (Commander/Yargs):**

```bash
# Find command definitions
grep -rn "\.command(\|\.option(\|yargs\." --include="*.js" --include="*.ts" . 2>/dev/null | grep -v node_modules |
  head -30
```

**Go (Cobra):**

```bash
# Find cobra commands
grep -rn "cobra.Command\|cmd.AddCommand" --include="*.go" . 2>/dev/null | head -30
```

**Rust (Clap):**

```bash
# Find clap definitions
grep -rn "#\[command\|#\[arg\|Command::new" --include="*.rs" . 2>/dev/null | head -30
```

### 4.2 Extract Command Help

```bash
# Try to get help output
./bin/* --help 2>/dev/null || npm run --help 2>/dev/null || python -m * --help 2>/dev/null || echo "Cannot extract help"
```

### 4.3 Discover Options/Flags

```bash
# Find option definitions
grep -rn "\.option\|\.flag\|add_argument\|--\w" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" --include="*.rs" . 2>/dev/null |
  grep -v node_modules | grep -v venv | head -40
```

## Step 5: Deep Analysis - APIs

### 5.1 Discover Endpoints

**FastAPI/Flask:**

```bash
# Find API routes
grep -rn "@app\.\(get\|post\|put\|delete\|patch\)\|@router\.\(get\|post\|put\|delete\|patch\)" --include="*.py" . 2>/dev/null |
  grep -v venv | head -40
```

**Express:**

```bash
# Find Express routes
grep -rn "router\.\(get\|post\|put\|delete\|patch\)\|app\.\(get\|post\|put\|delete\|patch\)" --include="*.js" --include="*.ts" . 2>/dev/null |
  grep -v node_modules | head -40
```

**Rails API:**

```bash
# Find API controllers
ls -la app/controllers/api/ 2>/dev/null
cat config/routes.rb 2>/dev/null | grep -E "namespace :api|resources"
```

### 5.2 Extract Request/Response Schemas

```bash
# Find schema definitions
grep -rl "Schema\|Serializer\|DTO\|interface.*Request\|interface.*Response\|type.*Request\|type.*Response" --include="*.py" --include="*.ts" --include="*.rb" . 2>/dev/null |
  grep -v node_modules | grep -v venv | head -20
```

### 5.3 Discover Authentication

```bash
# Find auth patterns
grep -rn "auth\|jwt\|bearer\|api.key\|oauth\|token" --include="*.py" --include="*.js" --include="*.ts" --include="*.rb" . 2>/dev/null |
  grep -v node_modules | grep -v venv | grep -v test | head -20
```

### 5.4 Check for OpenAPI/Swagger

```bash
# Find OpenAPI specs
ls -la openapi.yaml openapi.json swagger.yaml swagger.json api-spec.* 2>/dev/null
find . -name "openapi*" -o -name "swagger*" 2>/dev/null | head -5
```

## Step 6: Deep Analysis - Libraries

### 6.1 Discover Public API

**Python:**

```bash
# Find exports in __init__.py
cat */__init__.py src/*/__init__.py 2>/dev/null | grep -E "^from|^import|__all__"
# Find public classes/functions
grep -rn "^class \|^def \|^async def " --include="*.py" . 2>/dev/null | grep -v venv | grep -v test | grep -v "_" |
  head -40
```

**Node.js/TypeScript:**

```bash
# Find exports
grep -rn "^export \|module\.exports" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules |
  grep -v test | head -40
```

**Rust:**

```bash
# Find public items
grep -rn "^pub fn\|^pub struct\|^pub enum\|^pub trait" --include="*.rs" . 2>/dev/null | head -40
```

**Go:**

```bash
# Find exported functions (capitalized)
grep -rn "^func [A-Z]\|^type [A-Z]" --include="*.go" . 2>/dev/null | grep -v vendor | head -40
```

### 6.2 Extract Docstrings/Comments

```bash
# Find documented functions
grep -B5 "^def \|^class \|^func \|^pub fn" --include="*.py" --include="*.go" --include="*.rs" . 2>/dev/null |
  grep -E '"""|///|//|#' | head -30
```

### 6.3 Find Examples

```bash
# Find example files
find . -name "example*" -o -name "*example*" -o -name "demo*" 2>/dev/null | grep -v node_modules | head -20
ls -la examples/ example/ demo/ 2>/dev/null
```

## Step 7: Deep Analysis - Mobile Apps

### 7.1 Discover Screens (Flutter)

```bash
# Find Flutter screens/pages
find lib -name "*screen*.dart" -o -name "*page*.dart" -o -name "*view*.dart" 2>/dev/null | head -30
grep -rl "Scaffold\|MaterialApp\|CupertinoPageScaffold" --include="*.dart" lib/ 2>/dev/null | head -20
```

### 7.2 Discover Screens (React Native)

```bash
# Find React Native screens
find . -name "*Screen*" -o -name "*screen*" 2>/dev/null | grep -v node_modules | head -30
grep -rl "createStackNavigator\|createBottomTabNavigator\|Screen" --include="*.tsx" --include="*.jsx" . 2>/dev/null |
  grep -v node_modules | head -20
```

### 7.3 Extract Navigation Structure

```bash
# Find navigation definitions
grep -rn "Navigator\|createNavigator\|navigation\|router" --include="*.dart" --include="*.tsx" --include="*.jsx" . 2>/dev/null |
  grep -v node_modules | head -30
```

## Step 8: Validate Existing Manual Document

If `docs/manual.md` exists, validate its structure.

### Check H1 Title

```bash
head -5 docs/manual.md
grep "^# " docs/manual.md | head -1
```

**Expected:** `# User Manual`

### Check Required H2 Sections

```bash
grep "^## " docs/manual.md
```

**Must include (in order):**

```text
## Table of Contents
## Getting Started
## Features
{Project-type-specific sections}
## Configuration
## Troubleshooting
## FAQ
```

### Cross-Reference with Code (MANDATORY - do not skip)

**You MUST create a two-column comparison table:**

| Documented Feature    | Code Evidence                               |
| --------------------- | ------------------------------------------- |
| {feature from manual} | {file:function where it exists, or MISSING} |

For EACH documented feature/page/command:

1. Verify it exists in the codebase - record the specific file and function
2. Check if the description matches the implementation - record mismatches
3. Flag outdated screenshots or examples

For EACH feature found in code (from Steps 3-7):

1. Check if it is documented in the manual
2. Record undocumented features with their code location

## Step 9: Generate Comprehensive Report

**MANDATORY PRE-REPORT VERIFICATION:**

Before generating the report, you MUST:

1. Review your checkpoint log from the start of analysis
2. Verify ALL applicable checkpoints have actual values (not "pending")
3. If ANY checkpoint is still pending, STOP and complete that step first
4. Cross-reference findings: features found in code analysis MUST appear in the report

**If you skipped any step, the review is incomplete and results will be inconsistent.**

### Report Format

```text
## User Manual Review Report

### Analysis Checkpoint Log

{Include your completed checkpoint log here - ALL values must be filled in, none should say "pending"}

### Repository Info
- **Organization:** {org}
- **Repository:** {repo}
- **Product Type:** {web_app/cli/api/library/mobile/desktop}
- **Document Status:** {exists/missing}

### Structure Checks
- [ ] H1 title "# User Manual": {PASS/FAIL}
- [ ] Required H2 sections present: {PASS/FAIL}
- [ ] Table of Contents links valid: {PASS/FAIL}

### Content Accuracy Checks
- [ ] Getting Started matches actual setup: {PASS/FAIL}
- [ ] All features documented: {PASS/FAIL}
- [ ] {Project-specific checks}

### Coverage Analysis
- **Documented features:** {n}
- **Features in code:** {n}
- **Undocumented features:** {list}
- **Documented but removed:** {list}

### Proposed Changes
{Show exact changes needed}
```

## Step 10: Create or Update Manual Document

### Web Application Template

```markdown
# User Manual

## Table of Contents

- [Getting Started](#getting-started)
- [Features](#features)
- [Navigation](#navigation)
- [Pages](#pages)
- [Forms & Input](#forms--input)
- [Workflows](#workflows)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Getting Started

### Prerequisites

{Based on detected requirements}

### Accessing the Application

{URL or deployment info}

### First-Time Setup

1. {Step based on onboarding flow}
2. {Step}
3. {Step}

### Logging In

{Based on discovered auth mechanism}

## Features

### Feature Overview

| Feature | Description | Location |
|---------|-------------|----------|

{For each discovered feature:} | {name} | {description} | {page/section} |

### Key Capabilities

{Based on code analysis}

## Navigation

### Main Menu

{Based on discovered navigation components}

| Menu Item | Description | Shortcut |
|-----------|-------------|----------|
| {item} | {description} | {if any} |

### Sidebar/Secondary Navigation

{If applicable}

## Pages

{For each discovered page/view:}

### {Page Name}

**URL:** `{route}`

**Purpose:** {Inferred from controller/view}

**Screenshot:** {placeholder or existing}

#### Page Elements

| Element | Type | Description |
|---------|------|-------------|

{For each UI element:} | {name} | {button/input/table/etc} | {description} |

#### Actions Available

- {Action 1}: {description}
- {Action 2}: {description}

## Forms & Input

{For each discovered form:}

### {Form Name}

**Location:** {page where form appears}

**Purpose:** {inferred from model/controller}

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|

{For each field from model/form:} | {name} | {type} | {yes/no} | {description} |

#### Validation Rules

{Based on model validations}

#### Submission

{What happens on submit}

## Workflows

{For each major user workflow:}

### {Workflow Name}

**Goal:** {what user accomplishes}

**Steps:**

1. **{Step 1}**
  - Navigate to {page}
  - {Action}

2. **{Step 2}**
  - {Action}
  - Expected result: {result}

3. **{Step 3}**
  - {Action}
  - Completion: {final state}

## Configuration

### User Settings

{Based on discovered settings pages/models}

| Setting | Description | Default |
|---------|-------------|---------|
| {setting} | {description} | {default} |

### Environment Variables

{If user-configurable}

| Variable | Description | Required |
|----------|-------------|----------|
| {var} | {description} | {yes/no} |

## Troubleshooting

### Common Issues

{Based on error handling in code}

#### {Issue 1}

**Symptom:** {what user sees}

**Cause:** {why it happens}

**Solution:** {how to fix}

#### {Issue 2}

{Repeat}

### Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|

{From discovered error messages:} | {error} | {meaning} | {fix} |

## FAQ

### General Questions

**Q: {Question based on common patterns}**

A: {Answer}

**Q: {Question}**

A: {Answer}

### Technical Questions

**Q: {Question}**

A: {Answer}
```

### CLI Tool Template

```markdown
# User Manual

## Table of Contents

- [Getting Started](#getting-started)
- [Features](#features)
- [Commands](#commands)
- [Options & Flags](#options--flags)
- [Examples](#examples)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Getting Started

### Installation

{Based on detected package manager}

\`\`\`bash {install command} \`\`\`

### Quick Start

\`\`\`bash {simplest usage example} \`\`\`

### Verifying Installation

\`\`\`bash {command} --version \`\`\`

## Features

{Overview of what the CLI can do}

## Commands

{For each discovered command:}

### `{command name}`

{Description from docstring or inferred}

**Usage:**

\`\`\`bash {command} [options] <arguments>
\`\`\`

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| {arg} | {yes/no} | {description} |

**Example:**

\`\`\`bash {command} {example args} \`\`\`

## Options & Flags

### Global Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|

{For each global option:} | `--{option}` | `-{short}` | {description} | {default} |

### Command-Specific Options

{Grouped by command}

## Examples

### Basic Usage

\`\`\`bash

# {Description of what this does}

{command} \`\`\`

### Common Workflows

#### {Workflow 1}

\`\`\`bash

# Step 1: {description}

{command}

# Step 2: {description}

{command} \`\`\`

### Advanced Usage

\`\`\`bash

# {Advanced example}

{command with complex options} \`\`\`

## Configuration

### Configuration File

**Location:** `{config file path}`

**Format:** {JSON/YAML/TOML}

\`\`\`{format} {example config} \`\`\`

### Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| {option} | {type} | {description} | {default} |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| {var} | {description} | {default} |

## Troubleshooting

### Common Errors

#### {Error message}

**Cause:** {why it happens}

**Solution:**

\`\`\`bash {fix command} \`\`\`

### Debug Mode

\`\`\`bash {command} --verbose

# or

{command} --debug \`\`\`

## FAQ

**Q: How do I {common task}?**

A: {Answer with example}

\`\`\`bash {example} \`\`\`
```

### API Template

```markdown
# User Manual

## Table of Contents

- [Getting Started](#getting-started)
- [Features](#features)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Request/Response Examples](#requestresponse-examples)
- [Error Handling](#error-handling)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Getting Started

### Base URL

\`\`\`text {base URL or how to determine it} \`\`\`

### Quick Start

\`\`\`bash

# Get your API key

# Then make your first request:

curl -X GET "{base_url}/endpoint" \\ -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

## Features

{Overview of API capabilities}

## Authentication

### Authentication Method

{Based on discovered auth: API Key / OAuth / JWT / etc.}

### Getting Credentials

1. {Step to get credentials}
2. {Step}

### Using Credentials

**Header Authentication:**

\`\`\`bash curl -H "Authorization: Bearer {token}" {url} \`\`\`

**Query Parameter:**

\`\`\`bash curl "{url}?api_key={key}"
\`\`\`

## Endpoints

{For each discovered endpoint:}

### {Endpoint Name}

**{METHOD}** `{path}`

{Description}

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|----- |----------|-------------|
| {param} | {path/query/body} | {type} | {yes/no} | {description} |

**Request Body:**

\`\`\`json {example request body} \`\`\`

**Response:**

\`\`\`json {example response} \`\`\`

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |

## Request/Response Examples

### {Use Case 1}

**Request:**

\`\`\`bash curl -X {METHOD} "{base_url}{path}" \\ -H "Authorization: Bearer {token}" \\ -H "Content-Type: application/json" \\ -d '{request body}' \`\`\`

**Response:**

\`\`\`json {response} \`\`\`

## Error Handling

### Error Response Format

\`\`\`json {
"error": {
"code": "{error_code}",
"message": "{human readable message}"
} } \`\`\`

### Error Codes

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|

{For each error code:} | {code} | {status} | {description} | {how to fix} |

## Configuration

### Rate Limiting

{Based on discovered rate limiting}

### Pagination

{Based on discovered pagination patterns}

## Troubleshooting

### Common Issues

{Based on error handling code}

## FAQ

**Q: What is the rate limit?**

A: {answer}

**Q: How do I handle pagination?**

A: {answer with example}
```

### Library Template

```markdown
# User Manual

## Table of Contents

- [Getting Started](#getting-started)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Getting Started

### Requirements

{Based on detected requirements}

### Installation

{Based on package manager}

\`\`\`bash {install command} \`\`\`

## Features

{Overview of library capabilities}

## Quick Start

\`\`\`{language} {minimal working example} \`\`\`

## API Reference

{For each public class/function:}

### `{name}`

{Description from docstring}

**Signature:**

\`\`\`{language} {function/class signature} \`\`\`

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| {param} | {type} | {yes/no} | {description} |

**Returns:**

{Return type and description}

**Example:**

\`\`\`{language} {usage example} \`\`\`

## Examples

### Basic Usage

\`\`\`{language} {example} \`\`\`

### {Use Case 1}

\`\`\`{language} {example} \`\`\`

### {Use Case 2}

\`\`\`{language} {example} \`\`\`

## Configuration

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| {option} | {type} | {default} | {description} |

## Troubleshooting

### Common Issues

{Based on error patterns}

## FAQ

**Q: {Common question}**

A: {Answer}
```

## Step 11: Run Linters

After making changes to docs/manual.md, run the linters skill:

```text
/co-dev:run-linters
```

Fix any linting errors before considering the task complete.

## Validation Checklist

Before completing, verify:

- [ ] H1 title is exactly `# User Manual`
- [ ] All required H2 sections present
- [ ] Table of Contents links work
- [ ] Getting Started actually gets users started
- [ ] All user-facing features are documented
- [ ] All documented features exist in code
- [ ] Examples are tested and working
- [ ] Configuration options match code
- [ ] Error messages and troubleshooting are accurate

## Important Rules

1. **Write for end-users** - Not developers; assume no code knowledge
2. **Never fabricate features** - Only document what exists
3. **Include real examples** - Examples must work with actual code
4. **Keep language simple** - Avoid jargon; explain technical terms
5. **Show, don't tell** - Use screenshots, code examples, step-by-step guides
6. **Document the happy path first** - Then edge cases
7. **Cross-reference with code** - Every feature documented must exist
8. **Ask before modifying** - Show proposed changes and get approval
9. **Preserve existing content** - Only update, don't remove valid content
10. **Run linters after changes** - Always run `/co-dev:run-linters`
11. **Complete ALL steps** - Never skip analysis steps. Each step may reveal features not visible in other steps
12. **Output checkpoint log** - Include the completed checkpoint log in your final report to prove all steps were executed
13. **Never validate against world knowledge alone** - Do NOT use your training data to fact-check version numbers, release dates, or external claims. If uncertain about something, use web search to verify before flagging. Only validate things that can be cross-referenced against actual files in the repository or verified online.
