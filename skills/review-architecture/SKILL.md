---
name: review-architecture
description: Review, create, update, check, write, document, or audit architecture documentation (docs/architecture.md). Use when the user wants to review the architecture, check architecture docs, write architecture docs, document the architecture, or update architecture documentation to match organizational standards with accurate technical content.
allowed-tools: Bash(gh:*), Bash(git:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(mkdir:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*), Read, Write, Edit, Glob, Grep, WebSearch
---

# Review Architecture Documentation

Review the `docs/architecture.md` file in a repository and create or update it to match organizational standards. This skill deeply analyzes the codebase to ensure architecture documentation is accurate, complete, and reflects the actual implementation. Works for all repository types and languages.

## CRITICAL: Mandatory Analysis Tracking

**You MUST maintain an analysis checklist throughout execution.** At each step, record what was found. This ensures consistent, reproducible results.

**Before starting, create this tracking structure and update it as you progress:**

```text
=== ANALYSIS CHECKPOINT LOG ===
[ ] Step 1: Repository Information
    - organization: (pending)
    - repository: (pending)
    - has_architecture_doc: (pending)
    - has_docs_dir: (pending)
    - doc_last_modified: (pending)
    - code_last_modified: (pending)

[ ] Step 2: Exemption Check
    - existing_exemption: (pending)
    - exempt_type_detected: (pending)

[ ] Step 3: Project Type Detection
    - project_type: (pending)
    - ml_frameworks: (pending)
    - has_model_files: (pending)

[ ] Step 4/5: Deep Codebase Analysis (complete ALL applicable sub-checks)
    For Standard Projects:
    [ ] 4.1 Architecture Diagram - diagrams_found: (pending), referenced_in_doc: (pending)
    [ ] 4.2 Software Units - modules_in_code: (pending), modules_in_doc: (pending), missing_from_doc: (pending)
    [ ] 4.3 SOUP Validation - soup_json_exists: (pending), packages_in_lockfile: (pending), packages_in_soup: (pending), missing: (pending), stale: (pending)
    [ ] 4.4 Critical Algorithms - algorithms_found: (pending), documented: (pending), undocumented: (pending)
    [ ] 4.5 Risk Controls - auth_patterns: (pending), validation_patterns: (pending), error_handling: (pending), logging: (pending)

    For ML/DL Projects:
    [ ] 5.1 Datasets - datasets_found: (pending), documented: (pending)
    [ ] 5.2 Data Preprocessing - preprocessing_found: (pending), documented: (pending)
    [ ] 5.3 Data Splits - splits_found: (pending), documented: (pending)
    [ ] 5.4 Model Architecture - models_found: (pending), documented: (pending)
    [ ] 5.5 Model Training - training_config_found: (pending), documented: (pending)
    [ ] 5.6 Model Evaluation - metrics_found: (pending), documented: (pending)
    [ ] 5.7 Model Deployment - deployment_found: (pending), documented: (pending)

[ ] Step 6: Document Structure Validation
    - h1_title_correct: (pending)
    - required_sections_present: (pending)
    - section_order_correct: (pending)
    - toc_links_valid: (pending)

[ ] Step 7: Report Generated
    - all_checks_completed: (pending)
    - issues_found: (pending)
=== END CHECKPOINT LOG ===
```

**COMPLETION REQUIREMENT:** Before generating the final report, you MUST verify that ALL applicable checkpoints show actual values (not "pending"). If any checkpoint is still "pending", go back and complete that analysis step.

**EVIDENCE REQUIREMENT:** For every check, you MUST record:

1. **What was found in docs** - the exact text/claim from architecture.md
2. **What was found in code** - the actual code evidence (file paths, function names, imports)
3. **Comparison result** - MATCH, MISMATCH, or MISSING with specific details

A bare "PASS" without evidence is not acceptable. If you cannot provide evidence, the check is incomplete.

**DO NOT SKIP STEPS.** Even if an earlier check seems to suggest no issues, you MUST complete ALL steps. Issues are often only revealed when cross-referencing multiple sources.

## Step 0: Read the Full Architecture Document

**Before any code analysis**, read the entire `docs/architecture.md` (if it exists) and extract every factual claim that needs verification:

```bash
cat docs/architecture.md 2>/dev/null
```

Create a **claims inventory** listing every verifiable claim in the document:

- Module names and their stated purposes
- File paths referenced
- Dependencies listed
- Algorithms described
- Security measures claimed
- Diagram components shown

This claims inventory becomes your verification checklist for Steps 4-5. Every claim must be checked against actual code.

## Architecture Document Types

There are two types of architecture documents based on project type:

### Standard Projects

Required H2 sections:

```text
## Table of Contents
## Architecture diagram
## Software units
## Software of Unknown Provenance
## Critical algorithms
## Risk controls
```

### ML/DL Projects

For machine learning and deep learning projects, required H2 sections:

```text
## Table of Contents
## Datasets
## Data Preprocessing
## Data Splits
## Model Architecture
## Model Training
## Model Evaluation
## Software of Unknown Provenance
## Risk controls
## Model Deployment
```

## Step 1: Gather Repository Information

Run these commands to collect repository metadata:

```bash
# Get organization and repository name
gh repo view --json owner,name,visibility,description
```

```bash
# Check if docs/architecture.md exists
ls -la docs/architecture.md 2>/dev/null || echo "No docs/architecture.md found"
```

```bash
# Check if docs directory exists
ls -la docs/ 2>/dev/null || echo "No docs directory found"
```

```bash
# Get last modified date of architecture.md vs source code
git log -1 --format="%ci" -- docs/architecture.md 2>/dev/null || echo "N/A"
git log -1 --format="%ci" -- src lib app pkg internal cmd 2>/dev/null | head -5
```

Store these values:

- `organization`: The owner/organization name
- `repository`: The repository name
- `has_architecture_doc`: true/false
- `has_docs_dir`: true/false
- `doc_last_modified`: Date of last architecture.md change
- `code_last_modified`: Date of most recent source code change

## Step 2: Check if Architecture Documentation is Required

Some repository types do not require architecture documentation. Detect these and create an exemption file instead of nonsensical documentation.

### Check for Existing Exemption

```bash
# Check if already marked as not required
head -5 docs/architecture.md 2>/dev/null | grep -q "Architecture documentation is not required" && echo "EXEMPT" ||
  echo "NOT_EXEMPT"
```

If the file already contains the exemption marker, **stop here** - no further action needed.

### Detect Exempt Repository Types

**Homebrew Taps:**

```bash
# Check for Homebrew tap pattern
gh repo view --json name --jq '.name' | grep -qE "^homebrew-" && echo "HOMEBREW_TAP"
ls -la Formula/ Casks/ 2>/dev/null
```

**Claude Code Plugins:**

```bash
# Check for Claude Code plugin
ls -la .claude-plugin/plugin.json skills/ commands/ 2>/dev/null
```

**Configuration/Dotfiles Repositories:**

```bash
# Check if repo is mostly config files
find . -maxdepth 2 -type f \( -name "*.yml" -o -name "*.yaml" -o -name "*.json" -o -name "*.toml" -o -name ".*" \) 2>/dev/null |
  wc -l
find . -maxdepth 2 -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.go" -o -name "*.rs" -o -name "*.rb" -o -name "*.java" \) 2>/dev/null |
  wc -l
```

**Documentation-Only Repositories:**

```bash
# Check if repo is only documentation
find . -maxdepth 3 -type f -name "*.md" 2>/dev/null | wc -l
find . -maxdepth 3 -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.go" -o -name "*.rs" -o -name "*.rb" \) 2>/dev/null |
  wc -l
```

**GitHub Profile Repositories:**

```bash
# Check if repo name matches owner (profile README repo)
OWNER=$(gh repo view --json owner --jq '.owner.login')
NAME=$(gh repo view --json name --jq '.name')
[ "$OWNER" = "$NAME" ] && echo "PROFILE_REPO"
```

**GitHub Actions:**

```bash
# Check for GitHub Action
ls -la action.yml action.yaml 2>/dev/null
cat action.yml action.yaml 2>/dev/null | grep -q "runs:" && echo "GITHUB_ACTION"
```

**Terraform Modules:**

```bash
# Check for Terraform module (no main application)
ls -la *.tf modules/ 2>/dev/null
find . -name "*.tf" -not -path "*/.terraform/*" 2>/dev/null | head -5
```

**Ansible Roles/Playbooks:**

```bash
# Check for Ansible
ls -la playbooks/ roles/ tasks/ handlers/ ansible.cfg 2>/dev/null
```

**Kubernetes/Helm Charts:**

```bash
# Check for Helm chart or K8s manifests only
ls -la Chart.yaml values.yaml templates/ 2>/dev/null
find . -name "*.yaml" -path "*/templates/*" 2>/dev/null | head -5
```

**Meta/Organization Repositories:**

```bash
# Check for org-wide config repos
gh repo view --json name --jq '.name' | grep -qiE "^\.github$|^meta$|^org-|^team-|^-config$|-settings$" && echo "META_REPO"
```

### Exempt Repository Types

| Type               | Detection                                      | Reason                                      |
|--------------------|------------------------------------------------|---------------------------------------------|
| Homebrew Tap       | `homebrew-*` name, `Formula/` or `Casks/` dirs | Package distribution, no application logic  |
| Claude Code Plugin | `.claude-plugin/`, `skills/`, `commands/` dirs | Plugin config/prompts, no application logic |
| Dotfiles/Config    | >80% config files, no source code              | Configuration only                          |
| Documentation      | Only `.md` files, no source code               | No software architecture                    |
| GitHub Profile     | Repo name matches owner                        | Profile README only                         |
| GitHub Action      | `action.yml` with `runs:`                      | Simple action wrapper                       |
| Terraform Module   | Only `.tf` files, no application               | Infrastructure as code, not software        |
| Ansible Role       | `playbooks/`, `roles/`, `tasks/`               | Automation scripts, not software            |
| Helm Chart         | `Chart.yaml`, `templates/`                     | K8s deployment config                       |
| Meta Repository    | `.github`, `meta`, `org-*`, `*-config`         | Org settings, no application                |

### Create Exemption File

If the repository matches an exempt type, create the exemption file:

```bash
mkdir -p docs
```

**Exemption Template:**

```markdown
# Architecture Design

Architecture documentation is not required for this repository.

## Reason

This repository is a **{type}** which does not contain application software requiring architecture documentation.

### Repository Type: {type}

{Description of why this type doesn't need architecture docs}

## Documentation

For more information about this repository type, see:

{Link to relevant documentation}

## When This Might Change

Architecture documentation would be required if this repository evolves to include:

- Application source code with business logic
- Software components that interact with each other
- External dependencies that need to be documented (SOUP)
- Critical algorithms or risk controls

If the repository scope changes, remove this file and run the architecture review again.
```

**Exemption Messages and Documentation Links by Type:**

| Type | Message | Documentation |
| ---- | ------- | ------------- |
| Homebrew Tap | Homebrew taps contain package formulae for distribution, not application source code. | [Homebrew Taps](https://docs.brew.sh/Taps) |
| Claude Code Plugin | Claude Code plugins contain skill definitions and prompts, not application architecture. | [Claude Code Extensions](https://docs.anthropic.com/en/docs/claude-code/extensions) |
| Dotfiles/Config | This repository contains configuration files only, with no application logic to document. | N/A |
| Documentation | This repository contains documentation only, with no software architecture. | N/A |
| GitHub Profile | This is a GitHub profile README repository, not a software project. | [GitHub Profile README](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme) |
| GitHub Action | GitHub Actions are simple workflow wrappers, not applications requiring architecture docs. | [Creating Actions](https://docs.github.com/en/actions/sharing-automations/creating-actions) |
| Terraform Module | Terraform modules define infrastructure, not software architecture. | [Terraform Modules](https://developer.hashicorp.com/terraform/language/modules) |
| Ansible Role | Ansible roles define automation tasks, not software architecture. | [Ansible Roles](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_reuse_roles.html) |
| Helm Chart | Helm charts define Kubernetes deployments, not software architecture. | [Helm Charts](https://helm.sh/docs/topics/charts/) |
| Meta Repository | Meta repositories contain organization settings, not software projects. | [GitHub Organizations](https://docs.github.com/en/organizations) |

**After creating the exemption file, STOP** - do not proceed with architecture documentation steps.

## Step 3: Detect Project Type (Standard vs ML/DL)

Determine if this is a Machine Learning / Deep Learning project.

### Detection Method 1: Repository Name Patterns

```bash
gh repo view --json name --jq '.name'
```

ML/DL indicators in repository name:

- Contains `-ml`, `-dl`, `-ai`
- Ends with `-model`, `-models`
- Contains `machine-learning`, `deep-learning`

### Detection Method 2: ML/DL Framework Dependencies

**Python projects:**

```bash
# Check requirements.txt
cat requirements.txt 2>/dev/null | grep -iE "tensorflow|pytorch|torch|keras|scikit-learn|sklearn|xgboost|lightgbm|transformers|huggingface|jax|mlflow|wandb|optuna|numpy|pandas|scipy"
```

```bash
# Check pyproject.toml
cat pyproject.toml 2>/dev/null | grep -iE "tensorflow|pytorch|torch|keras|scikit-learn|sklearn|xgboost|lightgbm|transformers|huggingface|jax|mlflow|wandb|optuna"
```

```bash
# Check poetry.lock or requirements for ML framework presence
cat poetry.lock requirements.txt 2>/dev/null | grep -iE "^(tensorflow|torch|keras|scikit-learn)==" | head -10
```

**Node.js projects:**

```bash
cat package.json 2>/dev/null | jq -r '.dependencies, .devDependencies | keys[]' 2>/dev/null | grep -iE "tensorflow|brain|ml5|synaptic"
```

### Detection Method 3: ML/DL Directory Structure

```bash
# Check for ML-specific directories
ls -la models/ model/ training/ train/ data/ datasets/ notebooks/ checkpoints/ weights/ experiments/ 2>/dev/null
```

```bash
# Check for Jupyter notebooks
find . -maxdepth 3 -name "*.ipynb" 2>/dev/null | wc -l
```

```bash
# Check for model files
find . -maxdepth 3 \( -name "*.h5" -o -name "*.pkl" -o -name "*.pt" -o -name "*.pth" -o -name "*.onnx" -o -name "*.pb" -o -name "*.safetensors" \) 2>/dev/null |
  head -5
```

### Detection Method 4: Code Pattern Analysis

```bash
# Search for ML patterns in Python files
grep -rl "model\.fit\|model\.train\|DataLoader\|tf\.keras\|torch\.nn\|sklearn\." --include="*.py" . 2>/dev/null | wc -l
```

### Classification Rules

**Classify as ML/DL project if ANY of these are true:**

- Repository name matches ML/DL patterns
- ML frameworks found in dependencies (tensorflow >= any, pytorch/torch, keras, scikit-learn)
- Has `models/`, `training/`, `datasets/` directories with content
- Contains 3+ Jupyter notebooks
- Has model checkpoint files (.h5, .pt, .pth, .onnx, .pkl)
- 5+ files contain ML code patterns

**Otherwise, classify as Standard project.**

Store:

- `project_type`: "ml_dl" or "standard"
- `ml_frameworks`: List of detected ML frameworks
- `has_model_files`: true/false

## Step 4: Deep Codebase Analysis - Standard Projects

### 4.1 Architecture Diagram Verification

```bash
# Find existing diagram files
find . -maxdepth 3 \( -name "*.png" -o -name "*.svg" -o -name "*.drawio" -o -name "*.mmd" -o -name "*.mermaid" -o -name "*.puml" \) 2>/dev/null |
  grep -iE "arch|diagram|overview|system|structure"
```

```bash
# Check if diagrams are referenced in architecture.md
grep -iE "\!\[.*\]\(.*\.(png|svg|drawio)\)" docs/architecture.md 2>/dev/null
grep -iE "```mermaid" docs/architecture.md 2>/dev/null
```

**Verification:**

- If diagram exists, check modification date vs code changes
- Flag if diagram is older than significant code changes
- List components shown in diagram vs actual modules

### 4.2 Software Units Deep Analysis

**Discover actual module structure:**

```bash
# Python packages
find . -name "__init__.py" -not -path "*/venv/*" -not -path "*/.venv/*" -not -path "*/node_modules/*" 2>/dev/null |
  sed 's|/[^/]*$||' | sort -u
```

```bash
# Node.js/TypeScript modules
cat package.json 2>/dev/null | jq -r '.main, .exports | if type == "object" then keys[] else . end' 2>/dev/null
ls -la src/ lib/ 2>/dev/null
```

```bash
# Go packages
find . -name "*.go" -not -path "*/vendor/*" 2>/dev/null | xargs -I {} dirname {} | sort -u
```

```bash
# Rust crates
find . -name "Cargo.toml" 2>/dev/null | xargs -I {} dirname {}
```

**For each discovered module, extract:**

```bash
# Python: Get module docstring and main classes/functions
head -30 {module}/__init__.py 2>/dev/null
grep -E "^class |^def |^async def " {module}/*.py 2>/dev/null | head -20
```

```bash
# Node.js: Get exports
grep -E "^export |^module\.exports" {module}/index.{js,ts} {module}.{js,ts} 2>/dev/null | head -20
```

```bash
# Go: Get package doc and exported functions
head -20 {module}/*.go 2>/dev/null | grep -E "^package |^// |^func [A-Z]"
```

**Cross-reference with documentation (MANDATORY - do not skip):**

- Read the "Software units" section from docs/architecture.md
- Create a two-column comparison: modules listed in docs vs modules found in code
- For EACH module in docs: verify it exists in code and its description matches actual functionality
- For EACH module in code: verify it is documented
- Record the specific mismatches found (not just counts)

### 4.3 Software of Unknown Provenance (SOUP) Validation

**IMPORTANT:** The source of truth for SOUP data is `soup.json` (not `soup.md`). The `soup.md` file is auto-generated from `soup.json` and must never be edited directly. All validation and changes must target `soup.json`.

**Verify soup.json exists:**

```bash
ls -la docs/soup.json soup.json 2>/dev/null || echo "No soup.json found"
```

**Extract dependency list from lock files for comparison:**

```bash
# Python
cat poetry.lock 2>/dev/null | grep -E "^name = " | sed 's/name = "//;s/"//' | head -50
cat requirements.txt 2>/dev/null | grep -v "^#" | cut -d'=' -f1 | cut -d'>' -f1 | cut -d'<' -f1 | head -50
```

```bash
# Node.js
cat package.json 2>/dev/null | jq -r '.dependencies, .devDependencies | keys[]' 2>/dev/null | head -50
```

```bash
# Ruby
cat Gemfile.lock 2>/dev/null | grep -E "^    [a-z]" | awk '{print $1}' | head -50
```

```bash
# Go
cat go.mod 2>/dev/null | grep -E "^\t" | awk '{print $1}' | head -50
```

**Validate soup.json content against actual code usage:**

**Step 1: Read soup.json and extract all package entries:**

```bash
# Read soup.json to see all documented packages with their Risk Level, Requirements, and Verification Reasoning
cat docs/soup.json soup.json 2>/dev/null
```

**Step 2: For EACH package in soup.json, validate the three fields:**

**You MUST validate EVERY package, not a sample.** For each package, record:

- Package name
- Stated Requirements vs actual code usage found
- Stated Risk Level vs expected risk level for this type of package
- Stated Verification Reasoning vs whether it explains the specific choice

For each package entry, run these commands to verify accuracy:

```bash
# Find how the package is actually used in the codebase
grep -rn "require.*{package}\|import.*{package}\|from {package}\|use {package}" --include="*.py" --include="*.js" --include="*.ts" --include="*.rb" --include="*.go" --include="*.rs" . 2>/dev/null | grep -v node_modules | grep -v vendor | head -20
```

Then validate:

1. **Requirements field:** Does the stated purpose match the actual usage found above?
   - BAD: AWS SDK with Requirements saying "image processing"
   - GOOD: AWS SDK with Requirements saying "Cloud infrastructure API access"

2. **Risk Level:** Is it appropriate for what the package does?

   | Package Type                       | Expected Risk Level |
   | ---------------------------------- | ------------------- |
   | Auth, crypto, security             | High                |
   | Network, HTTP, API clients         | High                |
   | Database, data storage             | High                |
   | File system access                 | Medium              |
   | Logging, monitoring                | Medium              |
   | UI, formatting, colors             | Low                 |
   | Dev tools, linters, test utilities | Low                 |

3. **Verification Reasoning:** Does it explain why THIS package was chosen?
   - BAD: Generic "popular library"
   - GOOD: "Official AWS SDK maintained by Amazon" or "Only library supporting X protocol"

**Step 3: Check completeness and staleness:**

- All packages in lock files must be in soup.json
- Packages removed from lock files must be removed from soup.json

**Cross-reference with architecture.md:**

- Verify architecture.md references soup.md (the auto-generated file) and does not duplicate its content
- Flag any version numbers or dependency tables in architecture.md for removal

### 4.4 Critical Algorithms Deep Analysis

**Discover algorithm implementations:**

```bash
# Search for algorithm-related files
find . -name "*algorithm*" -o -name "*crypto*" -o -name "*hash*" -o -name "*sort*" -o -name "*search*" -o -name "*calculate*" -o -name "*compute*" -o -name "*process*" -o -name "*engine*" 2>/dev/null |
  grep -v node_modules | grep -v venv
```

```bash
# Search for cryptographic operations
grep -rn "crypto\|encrypt\|decrypt\|hash\|hmac\|sha\|md5\|aes\|rsa" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" --include="*.rs" . 2>/dev/null |
  grep -v node_modules | grep -v venv | head -20
```

```bash
# Search for complex mathematical operations
grep -rn "matrix\|vector\|gradient\|derivative\|integral\|fourier\|transform" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" --include="*.rs" . 2>/dev/null |
  grep -v node_modules | grep -v venv | head -20
```

```bash
# Search for custom data structures
grep -rn "class.*Tree\|class.*Graph\|class.*Queue\|class.*Stack\|class.*Heap" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" --include="*.rs" . 2>/dev/null |
  head -20
```

**For each discovered algorithm, extract details:**

- Read the file containing the algorithm
- Extract function/class signature
- Extract docstring/comments explaining the algorithm
- Note time/space complexity if documented

**Cross-reference with documentation:**

- Compare documented algorithms vs discovered implementations
- Flag undocumented critical algorithms
- Verify file paths in docs match actual locations
- Check if complexity claims are accurate

### 4.5 Risk Controls Deep Analysis

**Discover security measures:**

```bash
# Authentication/Authorization patterns
grep -rn "auth\|login\|session\|token\|jwt\|oauth\|permission\|role\|acl" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" . 2>/dev/null |
  grep -v node_modules | grep -v test | head -20
```

```bash
# Input validation patterns
grep -rn "validate\|sanitize\|escape\|filter\|whitelist\|blacklist" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" . 2>/dev/null |
  grep -v node_modules | head -20
```

```bash
# Error handling patterns
grep -rn "try:\|catch\|except\|error\|throw\|panic\|recover" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" . 2>/dev/null |
  grep -v node_modules | grep -v test | wc -l
```

```bash
# Logging patterns
grep -rn "log\.\|logger\.\|logging\.\|console\.log\|fmt\.Print" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" . 2>/dev/null |
  grep -v node_modules | grep -v test | head -20
```

**Check for security configurations:**

```bash
# Environment variables
grep -rn "process\.env\|os\.environ\|os\.Getenv\|env::" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" --include="*.rs" . 2>/dev/null |
  grep -v node_modules | head -20
```

```bash
# Security headers/middleware
grep -rn "helmet\|cors\|csrf\|xss\|rate.limit\|security" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" . 2>/dev/null |
  grep -v node_modules | head -10
```

## Step 5: Deep Codebase Analysis - ML/DL Projects

### 5.1 Datasets Deep Analysis

**Discover dataset definitions:**

```bash
# Find dataset classes/loaders
grep -rn "class.*Dataset\|DataLoader\|tf\.data\|torch\.utils\.data" --include="*.py" . 2>/dev/null | grep -v venv |
  head -20
```

```bash
# Find data directories and files
find data datasets raw processed -type f 2>/dev/null | head -30
ls -la data/ datasets/ 2>/dev/null
```

```bash
# Extract dataset statistics
wc -l data/*.csv datasets/*.csv 2>/dev/null
find data datasets -name "*.json" -exec wc -l {} \; 2>/dev/null | head -10
```

**For each dataset, extract:**

- Read dataset class implementation
- Extract data loading logic
- Note data format, features, labels
- Extract any data validation rules

**Cross-reference with documentation:**

- Compare documented datasets vs actual data files
- Verify dataset sizes/statistics
- Check data source URLs are still valid
- Flag undocumented datasets

### 5.2 Data Preprocessing Deep Analysis

**Discover preprocessing code:**

```bash
# Find preprocessing functions/classes
grep -rn "def preprocess\|def transform\|def normalize\|def augment\|def clean\|class.*Transform\|class.*Preprocess" --include="*.py" . 2>/dev/null |
  grep -v venv | head -20
```

```bash
# Find preprocessing pipelines
grep -rn "Pipeline\|Compose\|Sequential.*transform" --include="*.py" . 2>/dev/null | grep -v venv | head -10
```

**For each preprocessing step, extract:**

- Read the preprocessing function/class
- Extract input/output specifications
- Note any parameters or configurations
- Check for data augmentation techniques

**Cross-reference with documentation:**

- Compare documented preprocessing steps vs actual code
- Verify transformation order matches implementation
- Check if parameters in docs match code defaults

### 5.3 Data Splits Deep Analysis

**Discover split implementation:**

```bash
# Find train/test split code
grep -rn "train_test_split\|split\|StratifiedKFold\|KFold\|random_split" --include="*.py" . 2>/dev/null | grep -v venv |
  head -15
```

```bash
# Extract split ratios from code
grep -rn "test_size\|val_size\|train_size\|split.*=" --include="*.py" . 2>/dev/null | grep -v venv | head -15
```

```bash
# Check for split configuration files
cat config.yaml config.yml config.json 2>/dev/null | grep -iE "split|train|val|test"
```

**Cross-reference with documentation:**

- Compare documented split ratios vs actual code
- Verify split methodology description
- Check if cross-validation strategy matches

### 5.4 Model Architecture Deep Analysis

**Discover model definitions:**

```bash
# Find model classes
grep -rn "class.*Model\|class.*Net\|class.*Network\|nn\.Module\|tf\.keras\.Model" --include="*.py" . 2>/dev/null |
  grep -v venv | head -20
```

```bash
# Find model configuration
cat model_config.json model_config.yaml config/model.* 2>/dev/null
```

**For each model, extract architecture details:**

```bash
# Read model class definition (first 100 lines)
# For each model file found above, read it to extract:
# - Layer definitions
# - Forward pass logic
# - Input/output shapes
```

```bash
# Extract layer specifications from code
grep -rn "nn\.Linear\|nn\.Conv\|Dense\|Conv2D\|LSTM\|Transformer\|Attention" --include="*.py" . 2>/dev/null |
  grep -v venv | head -30
```

```bash
# Check for model summary/print
grep -rn "model\.summary\|print.*model\|torchsummary" --include="*.py" . 2>/dev/null | grep -v venv | head -5
```

**Cross-reference with documentation:**

- Compare documented architecture vs actual model code
- Verify layer specifications match implementation
- Check input/output shapes are accurate
- Flag architecture changes not reflected in docs

### 5.5 Model Training Deep Analysis

**Discover training configuration:**

```bash
# Find training scripts
find . -name "train*.py" -o -name "*training*.py" -o -name "main.py" 2>/dev/null | grep -v venv
```

```bash
# Extract hyperparameters from code
grep -rn "learning_rate\|lr\|batch_size\|epochs\|optimizer\|Adam\|SGD\|loss" --include="*.py" . 2>/dev/null |
  grep -v venv | head -30
```

```bash
# Check for config files
cat config.yaml config.yml config.json training_config.* hyperparameters.* 2>/dev/null | head -50
```

```bash
# Find argument parsers for hyperparameters
grep -rn "add_argument.*lr\|add_argument.*batch\|add_argument.*epoch" --include="*.py" . 2>/dev/null | head -15
```

**Extract actual training parameters:**

- Default values in code
- Values in config files
- Command-line argument defaults

**Cross-reference with documentation:**

- Compare documented hyperparameters vs actual code
- Check if optimizer, loss function, lr match
- Verify batch size, epochs are accurate
- Flag any training procedure changes

### 5.6 Model Evaluation Deep Analysis

**Discover evaluation code:**

```bash
# Find evaluation scripts/functions
find . -name "eval*.py" -o -name "*evaluate*.py" -o -name "test*.py" 2>/dev/null | grep -v venv | grep -v __pycache__
```

```bash
# Extract metrics used
grep -rn "accuracy\|precision\|recall\|f1\|auc\|roc\|confusion\|mse\|mae\|loss" --include="*.py" . 2>/dev/null |
  grep -v venv | head -30
```

```bash
# Find metric computation
grep -rn "sklearn\.metrics\|torchmetrics\|tf\.keras\.metrics" --include="*.py" . 2>/dev/null | grep -v venv | head -15
```

```bash
# Check for saved evaluation results
find . -name "*results*.json" -o -name "*metrics*.json" -o -name "*eval*.json" 2>/dev/null | head -5
cat results.json metrics.json evaluation_results.json 2>/dev/null | head -30
```

**Cross-reference with documentation:**

- Compare documented metrics vs actual evaluation code
- Check if benchmark results are up-to-date
- Verify evaluation methodology matches implementation

### 5.7 Model Deployment Deep Analysis

**Discover deployment configuration:**

```bash
# Find deployment files
ls -la deploy/ deployment/ serving/ inference/ 2>/dev/null
find . -name "Dockerfile*" -o -name "docker-compose*" -o -name "*deploy*" -o -name "*serve*" 2>/dev/null |
  grep -v node_modules | head -15
```

```bash
# Find inference code
grep -rn "def predict\|def inference\|@app\.route\|@api\|FastAPI\|Flask" --include="*.py" . 2>/dev/null | grep -v venv |
  head -15
```

```bash
# Check for model serving configs
cat serve.yaml serving.yaml deployment.yaml kubernetes/*.yaml 2>/dev/null | head -50
```

```bash
# Find hardware requirements
grep -rn "cuda\|gpu\|device\|cpu\|memory" --include="*.py" --include="*.yaml" --include="*.yml" . 2>/dev/null |
  grep -v venv | head -15
```

**Cross-reference with documentation:**

- Compare documented deployment vs actual configuration
- Verify inference requirements match code
- Check if serving infrastructure is accurate

## Step 6: Validate Existing Architecture Document Structure

If `docs/architecture.md` exists, validate its structure.

### Check H1 Title

```bash
head -5 docs/architecture.md
grep "^# " docs/architecture.md | head -1
```

**Expected:** `# Architecture Design` (exactly this)

### Check H2 Sections

```bash
grep "^## " docs/architecture.md
```

**For Standard projects, must start with (in order):**

```text
## Table of Contents
## Architecture diagram
## Software units
## Software of Unknown Provenance
## Critical algorithms
## Risk controls
```

**For ML/DL projects, must start with (in order):**

```text
## Table of Contents
## Datasets
## Data Preprocessing
## Data Splits
## Model Architecture
## Model Training
## Model Evaluation
## Software of Unknown Provenance
## Risk controls
## Model Deployment
```

Additional H2 sections may appear after the required ones.

### Check Table of Contents Links

```bash
# Extract TOC links
grep -E "^\s*-\s*\[.*\]\(#" docs/architecture.md
```

Verify each link resolves to an actual heading in the document.

## Step 7: Generate Comprehensive Accuracy Report

**MANDATORY PRE-REPORT VERIFICATION:**

Before generating the report, you MUST:

1. Review your checkpoint log from the start of analysis
2. Verify ALL applicable checkpoints have actual values (not "pending")
3. If ANY checkpoint is still pending, STOP and complete that step first
4. Cross-reference findings: issues found in code analysis MUST appear in the report

**If you skipped any step, the review is incomplete and results will be inconsistent.**

After deep analysis, provide a detailed report:

### Report Format

```text
## Architecture Documentation Review Report

### Analysis Checkpoint Log

{Include your completed checkpoint log here - ALL values must be filled in, none should say "pending"}

### Repository Info
- **Organization:** {org}
- **Repository:** {repo}
- **Project Type:** {standard/ml_dl}
- **Document Status:** {exists/missing}
- **Last Doc Update:** {date}
- **Last Code Update:** {date}
- **Documentation Freshness:** {CURRENT/STALE - code changed since last doc update}

### Structure Checks
- [ ] H1 title "# Architecture Design": {PASS/FAIL - found: "{actual}"}
- [ ] Required H2 sections present: {PASS/FAIL}
- [ ] Section order correct: {PASS/FAIL}
- [ ] Table of Contents links valid: {PASS/FAIL}

### Content Accuracy Checks

#### {For Standard: "Architecture Diagram" / For ML: "Datasets"}
- **Status:** {PASS/FAIL/NEEDS UPDATE/MISSING}
- **Issues:**
  - {Specific issue 1}
  - {Specific issue 2}
- **Discovered in code:** {what was actually found}
- **Documented:** {what's currently in docs}

{Repeat for each section}

#### Software of Unknown Provenance
- **Status:** {PASS/FAIL/NEEDS UPDATE}
- **soup.json exists:** {yes/no}
- **architecture.md references soup.md:** {yes/no - flag if duplicating content}
- **Total dependencies in lock files:** {n}
- **Documented in soup.json:** {n}
- **Missing from soup.json:** {list}
- **In soup.json but not in code:** {list}
- **Inaccurate Requirements fields:** {list packages where stated purpose doesn't match actual code usage}
- **Misclassified Risk Levels:** {list packages with inappropriate risk level for their function}
- **Weak Verification Reasoning:** {list packages with generic reasoning like "popular library"}

### Summary
- **Sections accurate:** {n}/{total}
- **Sections need update:** {n}
- **Sections missing:** {n}
- **Critical issues:** {list of high-priority fixes}

### Proposed Changes
{Show exact changes needed with before/after for each section}
```

**Ask the user before making changes:**

> "I found the following issues with docs/architecture.md. Would you like me to fix them?"

## Step 8: Create or Update Architecture Document

### If Creating New Document

First create the docs directory if needed:

```bash
mkdir -p docs
```

### Standard Project Template

```markdown
# Architecture Design

## Table of Contents

- [Architecture diagram](#architecture-diagram)
- [Software units](#software-units)
- [Software of Unknown Provenance](#software-of-unknown-provenance)
- [Critical algorithms](#critical-algorithms)
- [Risk controls](#risk-controls)

## Architecture diagram

{Include or reference architecture diagram - create if missing}

![Architecture Diagram](./images/architecture.png)

### System Overview

{High-level description based on discovered modules and their interactions}

### Component Interactions

{Description of how components interact - based on imports/dependencies analysis}

## Software units

{For each discovered module:}

### {Module Name}

**Purpose:** {Extracted from docstring or inferred from code}

**Location:** `{actual/path/to/module}`

**Key Components:**

- `{ClassName}`: {description from docstring}
- `{function_name}`: {description from docstring}

**Internal Dependencies:**

- {Other modules this depends on}

**External Dependencies:**

- {Third-party packages used}

## Software of Unknown Provenance

See [soup.md](soup.md) for the complete list of third-party dependencies.

**Verification:** Cross-reference soup.md entries against actual code usage to ensure accuracy:

### Risk Level

Classify the potential harm if the library has a vulnerability (per IEC 62304):

| Level | Definition |
|-------|------------|
| Low | Cannot lead to harm |
| Medium | Can lead to reversible harm |
| High | Can lead to irreversible harm |

### Requirements

Answer: "Why do you need this library in your project?"

Examples:
- "HTTP client for REST API communication"
- "CLI argument parsing and validation"
- "YAML/JSON configuration file parsing"
- "Dependency" (for transitive dependencies only)

### Verification Reasoning

Answer: "Why did you select this library among alternatives?"

Examples:
- "Industry standard with active maintenance and security updates"
- "Official SDK provided by the service vendor"
- "Recommended by framework documentation"
- "Dependency" (for transitive dependencies only)

### Validation Checks

1. **Accuracy:** Verify each package's Requirements field matches its actual usage in the codebase (e.g., an AWS SDK should not say "image processing")
2. **Completeness:** All packages in lock files must be in soup.json
3. **Staleness:** Packages removed from lock files must be removed from soup.json
4. **Risk Level:** Verify risk classifications are appropriate (e.g., crypto/auth libraries should be High)

**Note:** `soup.md` is auto-generated from `soup.json`. All edits must be made to `soup.json`.

## Critical algorithms

{For each discovered algorithm:}

### {Algorithm/Function Name}

**Purpose:** {From docstring or inferred}

**Location:** `{actual/path/to/file}` in `{ClassName}` or `{function_name}`

**Implementation:**
{Brief description of how it works}

**Complexity:** {If documented or inferrable}

**Security Considerations:** {If applicable}

## Risk controls

### Security Measures

{Based on discovered security patterns:}

- **Authentication:** {Discovered auth mechanisms}
- **Authorization:** {Discovered authz patterns}
- **Input Validation:** {Discovered validation}
- **Encryption:** {Discovered crypto usage}

### Error Handling

{Based on discovered error handling patterns}

### Logging & Monitoring

{Based on discovered logging patterns}

### Failure Modes

| Failure Mode | Impact | Mitigation |
|--------------|--------|------------|
| {Inferred from error handling} | {Impact} | {Mitigation} |
```

### ML/DL Project Template

```markdown
# Architecture Design

## Table of Contents

- [Datasets](#datasets)
- [Data Preprocessing](#data-preprocessing)
- [Data Splits](#data-splits)
- [Model Architecture](#model-architecture)
- [Model Training](#model-training)
- [Model Evaluation](#model-evaluation)
- [Software of Unknown Provenance](#software-of-unknown-provenance)
- [Risk controls](#risk-controls)
- [Model Deployment](#model-deployment)

## Datasets

### Data Sources

| Dataset | Source | Size | Format |
|---------|--------|------|--------|

{For each discovered dataset:} | {name} | {source if found} | {actual size} | {format} |

### Data Description

{Based on discovered dataset classes and data files}

**Features:**
{Extracted from data loading code}

**Labels:**
{Extracted from data loading code}

### Data Statistics

{Based on actual data file analysis}

## Data Preprocessing

### Preprocessing Pipeline

{Based on discovered preprocessing code:}

1. **{Step from code}**: {Description}
  - Implementation: `{file}:{function}`
  - Parameters: {extracted parameters}

### Data Transformations

| Transformation | Purpose | Implementation |
|----------------|---------|----------------|

{For each discovered transform:} | {transform_name} | {from docstring} | `{file}` in `{class/function}` |

### Data Augmentation

{Based on discovered augmentation code}

## Data Splits

### Split Configuration

| Split | Ratio | Size | Method |
|-------|-------|------|--------|
| Training | {from code}% | {n} samples | {method} |
| Validation | {from code}% | {n} samples | {method} |
| Test | {from code}% | {n} samples | {method} |

### Split Implementation

**Location:** `{file}` in `{function_name}`

**Method:** {random/stratified/temporal/custom}

**Random Seed:** {if found}

## Model Architecture

### Architecture Overview

{Based on discovered model class}

**Model Type:** {CNN/RNN/Transformer/etc.}

**Framework:** {PyTorch/TensorFlow/etc.}

### Architecture Diagram

{Generate or reference based on model structure}

### Layer Specifications

| Layer | Type | Parameters | Output Shape |
|-------|------|------------|--------------|

{For each layer discovered in model:} | {layer_name} | {layer_type} | {params} | {shape if inferrable} |

### Model Configuration

**Location:** `{model_file}` in `{ClassName}`

~~~python
{Actual model class signature and key layers}
~~~

### Input/Output Specifications

- **Input:** {shape, dtype from code}
- **Output:** {shape, dtype from code}

## Model Training

### Training Configuration

| Parameter | Value | Source |
|-----------|-------|--------|
| Optimizer | {actual optimizer} | `{file}` in `{function/class}` |
| Learning Rate | {actual lr} | `{file}` in `{function/class}` |
| Batch Size | {actual batch_size} | `{file}` in `{function/class}` |
| Epochs | {actual epochs} | `{file}` in `{function/class}` |
| Loss Function | {actual loss} | `{file}` in `{function/class}` |
| LR Scheduler | {if found} | `{file}` in `{function/class}` |

### Training Script

**Location:** `{training_script}`

### Training Procedure

{Based on actual training loop analysis}

### Checkpointing

{Based on discovered checkpoint saving code}

## Model Evaluation

### Evaluation Metrics

| Metric | Implementation | Latest Value |
|--------|----------------|--------------|
| {metric_name} | `{file}` in `{function/class}` | {from results file if exists} |

### Evaluation Script

**Location:** `{eval_script}`

### Benchmark Results

{From discovered results files}

| Dataset | Metric | Value | Date |
|---------|--------|-------|------|
| {dataset} | {metric} | {value} | {date} |

## Software of Unknown Provenance

See [soup.md](soup.md) for the complete list of third-party dependencies including ML frameworks and data processing libraries.

**Verification:** Cross-reference soup.json entries against actual code usage. See the Standard Project Template above for Risk Level, Requirements, and Verification Reasoning guidelines. Note that `soup.md` is auto-generated from `soup.json`; all edits must target `soup.json`.

## Risk controls

### Model Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Model drift | {assess} | {assess} | {from code} |
| Data leakage | {assess} | {assess} | {from code} |
| Overfitting | {assess} | {assess} | {from code} |

### Data Risks

{Based on data handling code analysis}

### Operational Risks

{Based on deployment code analysis}

## Model Deployment

### Deployment Architecture

{Based on discovered deployment configs}

### Inference Implementation

**Location:** `{inference_file}`

**Entry Point:** `{function/endpoint}`

### Hardware Requirements

| Requirement | Specification | Source |
|-------------|---------------|--------|
| GPU | {from code} | `{file}` |
| Memory | {from code/config} | `{file}` |
| Storage | {estimated} | - |

### Serving Configuration

{From discovered serving configs}

### Monitoring

{Based on discovered monitoring/logging code}
```

## Validation Checklist

Before completing, verify:

- [ ] H1 title is exactly `# Architecture Design`
- [ ] All required H2 sections present in correct order
- [ ] Table of Contents links all work
- [ ] All documented modules exist in codebase
- [ ] All codebase modules are documented
- [ ] soup.json exists and is referenced (not duplicated) in architecture.md
- [ ] soup.json Requirements fields match actual code usage
- [ ] soup.json Risk Levels are appropriate for each package's function
- [ ] File paths in docs point to actual files
- [ ] For ML/DL: Hyperparameters match actual code
- [ ] For ML/DL: Model architecture matches implementation
- [ ] For ML/DL: Metrics match evaluation code
- [ ] Risk controls reflect actual security measures

## Step 9: Run Linters

After making changes to docs/architecture.md, run the linters skill to ensure the file passes all markdown linting rules:

```text
/co-dev:run-linters
```

Fix any linting errors before considering the task complete.

## Important Rules

1. **Never fabricate information** - Only document what actually exists in the code
2. **Use stable code references** - Reference classes, methods, and functions instead of line numbers (line numbers change too quickly)
3. **Never document versions or duplicate SOUP data** - Do not include version numbers or dependency tables in architecture.md. Reference soup.md instead (which is auto-generated from soup.json). Lock files are the source of truth for versions. All SOUP edits must be made to soup.json. If versions or dependency tables are found in architecture.md, flag them for removal.
4. **Verify all paths** - Every file path must exist
5. **Never remove existing content** - Only add missing sections or fix inaccuracies
6. **Preserve custom sections** - Additional H2/H3 sections after required ones should be kept
7. **Ask before modifying** - Always show proposed changes and get user approval
8. **Flag stale documentation** - Warn if code changed significantly since last doc update
9. **Document security dependencies** - SOUP handling crypto/auth needs extra attention
10. **Keep metrics current** - If evaluation results exist, include latest values
11. **Run linters after changes** - Always run `/co-dev:run-linters` after modifying docs/architecture.md
12. **Complete ALL steps** - Never skip analysis steps. Each step may reveal issues not visible in other steps
13. **Output checkpoint log** - Include the completed checkpoint log in your final report to prove all steps were executed
14. **Never validate against world knowledge alone** - Do NOT use your training data to fact-check version numbers, release dates, library existence, or external claims. If uncertain about something, use web search to verify before flagging. Only validate things that can be cross-referenced against actual files in the repository or verified online.
