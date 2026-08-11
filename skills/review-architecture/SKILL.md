---
name: review-architecture
description: Review, create, update, check, write, document, or audit architecture documentation (docs/architecture.md). Use when the user wants to review the architecture, check architecture docs, write architecture docs, document the architecture, or update architecture documentation to match organizational standards with accurate technical content.
allowed-tools: Bash(gh:*), Bash(git:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(mkdir:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*), Read, Write, Edit, Glob, Grep, TodoWrite, WebSearch, Skill, mcp__github__get_file_contents, mcp__fetch__fetch, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Review Architecture Documentation

Review or create `docs/architecture.md` to match organizational standards. Works for all repository types and languages.

When another skill invokes this one with a review-only instruction (e.g. code-review-deep's opt-in deep documentation pass), analyze and report findings only — do not create, write, or edit any file.

## Phase Tracking

Use `TodoWrite` to track each phase below. Mark `in_progress` on entry, `completed` when results are recorded. Do NOT include the task list in the final output.

**Required phases:**

1. Repository info gathered
2. Exemption check (skip-or-proceed decision)
3. Project type detected (standard vs ML/DL)
4. Read existing doc + extract claims inventory
5. Deep codebase analysis (relevant sub-phases per project type)
6. Existing doc structure validated
7. Report generated
8. Doc written/updated (if approved)
9. Linters run

**Evidence rule:** Every check must record (a) what the doc claims, (b) what the code shows (file:function), (c) MATCH / MISMATCH / MISSING. Bare "PASS" without code evidence is invalid.

## Architecture Document Types

### Standard Projects — required H2 sections

```text
## Table of Contents
## Architecture diagram
## Software units
## Software of Unknown Provenance
## Critical algorithms
## Risk controls
```

### ML/DL Projects — required H2 sections

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

## MCP Tools with Fallbacks

Prefer MCP tools when available; fall back to CLI on errors.

| Operation | Preferred | Fallback |
| --- | --- | --- |
| Get file contents | `mcp__github__get_file_contents` | `cat <file>` |
| Repo metadata | `gh repo view --json owner,name,visibility,description` | n/a |
| Library docs | `mcp__context7__*` | `WebSearch` → `mcp__fetch__fetch` |

## Phase 1: Repository Info

```bash
gh repo view --json owner,name,visibility,description
ls -la docs/architecture.md docs/ 2>/dev/null
git log -1 --format="%ci" -- docs/architecture.md 2>/dev/null
git log -1 --format="%ci" -- src lib app pkg internal cmd 2>/dev/null | head -1
```

Record: organization, repository, has_architecture_doc, has_docs_dir, doc_last_modified, code_last_modified. Flag as STALE if code changed significantly after the last doc update.

## Phase 2: Exemption Check

If `docs/architecture.md` already contains the line "Architecture documentation is not required for this repository." — the first body line of the exemption file written below (its H1 is `# Architecture Design`, so match the line anywhere in the file, not only at the start) — **stop here**.

Otherwise check whether the repo qualifies for an exemption:

| Exempt Type | Detection signal(s) | Reason |
| ----------- | ------------------- | ------ |
| Homebrew Tap | Repo name `homebrew-*`; `Formula/` or `Casks/` dirs | Package distribution, no application logic |
| Claude Code Plugin | `.claude-plugin/plugin.json`; `skills/` and/or `commands/` dirs | Plugin config/prompts, no application logic |
| Dotfiles / Config | >80% of git-tracked files (count via `git ls-files`) have a `.yaml`/`.yml`/`.json`/`.toml` extension or a dot-prefixed name; no source code | Configuration only |
| Documentation-only | Only `.md` files, no source files | No software architecture |
| GitHub Profile | Repo name equals owner name | Profile README only |
| GitHub Action | `action.yml` / `action.yaml` with `runs:` | Simple action wrapper |
| Terraform Module | Only `.tf` files (no `.terraform/`), no app | Infrastructure as code |
| Ansible Role | `playbooks/`, `roles/`, `tasks/`, `ansible.cfg` | Automation, not software |
| Helm Chart | `Chart.yaml`, `templates/` | K8s deployment config |
| Meta Repository | Name matches `.github`, `meta`, `org-*`, `*-config`, `*-settings` | Org settings, no application |

If exempt, write `docs/architecture.md` with this content (substitute `{type}` and the message/link from the table below) and STOP:

```markdown
# Architecture Design

Architecture documentation is not required for this repository.

## Reason

This repository is a **{type}** which does not contain application software requiring architecture documentation.

### Repository Type: {type}

{Reason from table below}

## Documentation

For more information about this repository type, see {link from table below}.

## When This Might Change

Architecture documentation would be required if this repository evolves to include:

- Application source code with business logic
- Software components that interact with each other
- External dependencies that need to be documented (SOUP)
- Critical algorithms or risk controls

If the repository scope changes, remove this file and run the architecture review again.
```

| Type | Reason text | Link |
| ---- | ----------- | ---- |
| Homebrew Tap | Homebrew taps contain package formulae for distribution, not application source code. | [Homebrew Taps](https://docs.brew.sh/Taps) |
| Claude Code Plugin | Claude Code plugins contain skill definitions and prompts, not application architecture. | [Claude Code Extensions](https://docs.anthropic.com/en/docs/claude-code/extensions) |
| Dotfiles/Config | This repository contains configuration files only, with no application logic to document. | n/a |
| Documentation | This repository contains documentation only, with no software architecture. | n/a |
| GitHub Profile | This is a GitHub profile README repository, not a software project. | [GitHub Profile README](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme) |
| GitHub Action | GitHub Actions are simple workflow wrappers, not applications requiring architecture docs. | [Creating Actions](https://docs.github.com/en/actions/sharing-automations/creating-actions) |
| Terraform Module | Terraform modules define infrastructure, not software architecture. | [Terraform Modules](https://developer.hashicorp.com/terraform/language/modules) |
| Ansible Role | Ansible roles define automation tasks, not software architecture. | [Ansible Roles](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_reuse_roles.html) |
| Helm Chart | Helm charts define Kubernetes deployments, not software architecture. | [Helm Charts](https://helm.sh/docs/topics/charts/) |
| Meta Repository | Meta repositories contain organization settings, not software projects. | [GitHub Organizations](https://docs.github.com/en/organizations) |

## Phase 3: Detect Project Type (Standard vs ML/DL)

Classify as **ML/DL** if ANY of:

- Repo name contains `-ml`, `-dl`, `-ai`, `-model`, `machine-learning`, or `deep-learning`.
- Dependencies include any of: `tensorflow`, `pytorch`/`torch`, `keras`, `scikit-learn`/`sklearn`, `xgboost`, `lightgbm`, `transformers`, `huggingface`, `jax`, `mlflow`, `wandb`, `optuna`. Check `requirements.txt`, `pyproject.toml`, `poetry.lock`, `package.json`.
- ML directories with content: `models/`, `training/`, `datasets/`, `notebooks/`, `checkpoints/`, `weights/`, `experiments/`.
- 3+ Jupyter notebooks anywhere.
- Model checkpoint files: `*.h5`, `*.pkl`, `*.pt`, `*.pth`, `*.onnx`, `*.pb`, `*.safetensors`.
- 5+ files match patterns: `model\.fit`, `model\.train`, `DataLoader`, `tf\.keras`, `torch\.nn`, `sklearn\.`.

Otherwise classify as **standard**. Record: `project_type`, `ml_frameworks`, `has_model_files`.

## Phase 4: Read Doc + Build Claims Inventory

```bash
cat docs/architecture.md 2>/dev/null
```

Build a verifiable claims list from the doc — for every entry, you'll cross-check against code in Phase 5:

- Module names + stated purposes
- File paths referenced
- Listed dependencies
- Algorithms described
- Security measures claimed
- Diagram components

## Phase 5: Deep Codebase Analysis

Run only the sub-phases matching the project type. Record exact counts and file:function evidence.

### 5.A Standard Projects

**5.A.1 Architecture diagram.** Find existing diagrams: `*.png`/`*.svg`/`*.drawio`/`*.mmd`/`*.mermaid`/`*.puml` matching `arch|diagram|overview|system|structure`; check if referenced in `architecture.md` (`![...](...)` or ` ```mermaid`). Compare modification dates — flag if diagram is older than significant code changes. List components shown vs actual modules.

**5.A.2 Software units.** Discover module structure:

- Python: `find . -name "__init__.py" -not -path "*/venv/*" -not -path "*/.venv/*"` → take parent dirs.
- Node/TypeScript: `package.json` `main`/`exports`; `src/`, `lib/`.
- Go: parent dirs of `*.go` (excluding `vendor/`).
- Rust: crate roots (`src/lib.rs`, `src/main.rs`) plus the `mod` declarations they pull in — each `src/**/*.rs` and `mod.rs` is a module. `Cargo.toml` marks crates, not modules.

For each module, extract docstring (head of `__init__.py`), exported symbols (`^class`, `^def`, `export`, `func [A-Z]`).

**Cross-reference (mandatory):** two-column table of modules-in-doc vs modules-in-code; record specific mismatches with names, not just counts.

**5.A.3 SOUP validation.** `soup.json` is the source of truth; `soup.md` is auto-generated and must never be edited.

```bash
ls -la docs/soup.json soup.json 2>/dev/null
cat docs/soup.json soup.json 2>/dev/null
```

Extract dependency lists from lock files: `poetry.lock`, `requirements.txt`, `package.json`, `Gemfile.lock`, `go.mod`, `Cargo.lock`.

Collect every import/require/use site in ONE repo-wide pass, then match those sites against the package list in memory. Never grep once per package — that exhausts context before the review finishes.

```bash
grep -rnE "^[[:space:]]*(import|from|use|require)[[:space:](]" --include="*.py" --include="*.js" --include="*.ts" --include="*.rb" --include="*.go" --include="*.rs" . | grep -v node_modules | grep -v venv
```

For **every** package in `soup.json` (not a sample), validate three fields:

1. **Requirements** — does the stated purpose match the usage sites collected above?

   - BAD: AWS SDK with Requirements "image processing"
   - GOOD: AWS SDK with Requirements "Cloud infrastructure API access"

2. **Risk Level** — appropriate for what the package does:

   | Package type | Expected Risk Level |
   | ------------ | ------------------- |
   | Auth, crypto, security | High |
   | Network, HTTP, API clients | High |
   | Database, data storage | High |
   | File system access | Medium |
   | Logging, monitoring | Medium |
   | UI, formatting, colors | Low |
   | Dev tools, linters, test utilities | Low |

3. **Verification Reasoning** — explains why THIS specific package was chosen:
   - BAD: "popular library"
   - GOOD: "Official AWS SDK maintained by Amazon", "Only library supporting protocol X"

**Completeness/staleness:** every package in lock files must be in `soup.json`; packages removed from lock files must be removed from `soup.json`.

**Architecture.md duplication check:** flag any version numbers or dependency tables in `architecture.md` for removal — it must reference `soup.md`, not duplicate it.

**5.A.4 Critical algorithms.** Find candidates:

```bash
find . \( -name "*algorithm*" -o -name "*crypto*" -o -name "*hash*" -o -name "*engine*" -o -name "*compute*" \) -not -path "*/node_modules/*" -not -path "*/venv/*"
grep -rn "encrypt\|decrypt\|hash\|hmac\|sha\|aes\|rsa" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" --include="*.rs" . | grep -v node_modules | grep -v venv
```

Also check for custom data structures (`class .*Tree|Graph|Queue|Stack|Heap`) and complex math (`matrix`, `gradient`, `fourier`, etc.).

For each: signature, docstring, complexity if documented. Flag undocumented critical algorithms; verify file paths in doc match actual locations.

**5.A.5 Risk controls.** Discover security measures:

- **Auth/authz:** `auth`, `login`, `session`, `token`, `jwt`, `oauth`, `permission`, `role`, `acl`.
- **Input validation:** `validate`, `sanitize`, `escape`, `filter`, `whitelist`.
- **Error handling:** `try:`, `catch`, `except`, `throw`, `panic`/`recover`.
- **Logging:** `logger.`, `logging.`, `console.log`, `fmt.Print`.
- **Security middleware/headers:** `helmet`, `cors`, `csrf`, `xss`, `rate.limit`.
- **Env vars / secrets:** `process.env`, `os.environ`, `os.Getenv`, `env::`.

### 5.B ML/DL Projects

**5.B.1 Datasets.** Find dataset classes/loaders (`class .*Dataset`, `DataLoader`, `tf.data`, `torch.utils.data`); list `data/`, `datasets/`, `raw/`, `processed/` with file counts (regular files, recursive: `find <dir> -type f | wc -l`) and sizes (total KiB, recursive: `du -sk <dir>`). For each: data format, features, labels, validation rules. Verify documented sources/sizes; flag undocumented.

**5.B.2 Data preprocessing.** Find `def preprocess`, `def transform`, `def normalize`, `def augment`, `class .*Transform`, `Pipeline`, `Compose`. For each: input/output specs, parameters, augmentation techniques. Verify documented order matches code; check parameter defaults.

**5.B.3 Data splits.** Find `train_test_split`, `StratifiedKFold`, `KFold`, `random_split`. Extract ratios from `test_size`, `val_size`, `train_size` and config files (`config.yaml`/`yml`/`json`). Check for random seed.

**5.B.4 Model architecture.** Find `class .*Model`, `class .*Net`, `nn.Module`, `tf.keras.Model`. Extract layers (`nn.Linear`, `nn.Conv`, `Dense`, `Conv2D`, `LSTM`, `Transformer`, `Attention`); read forward pass; record input/output shapes. Verify documented layers match code.

**5.B.5 Model training.** Find training scripts (`train*.py`, `*training*.py`, `main.py`). Extract hyperparameters: `learning_rate`/`lr`, `batch_size`, `epochs`, `optimizer` (Adam/SGD/etc.), `loss`. Check argparse defaults and config files (`training_config.*`, `hyperparameters.*`). Verify docs match.

**5.B.6 Model evaluation.** Find `eval*.py`, `*evaluate*.py`. Extract metrics: `accuracy`, `precision`, `recall`, `f1`, `auc`, `roc`, `mse`, `mae`. Look for `sklearn.metrics`, `torchmetrics`, `tf.keras.metrics`. Read saved results: `results.json`, `metrics.json`, `*evaluation*.json`. Verify documented benchmarks.

**5.B.7 Model deployment.** Find `deploy/`, `deployment/`, `serving/`, `inference/`, `Dockerfile`, `docker-compose*`, K8s manifests. Find inference code (`def predict`, `def inference`, `@app.route`, `@api`, FastAPI/Flask). Extract hardware requirements (`cuda`, `gpu`, `device`, `memory`). Verify deployment matches docs.

## Phase 6: Validate Existing Doc Structure

If `docs/architecture.md` exists:

1. **H1 must be exactly `# Architecture Design`.**
2. **Required H2 sections present in correct order** (per project type — see "Architecture Document Types" above). Additional H2 sections after the required ones are allowed.
3. **TOC links resolve** to actual headings.
4. **No version numbers or dep tables in architecture.md** — those belong in `soup.json`/`soup.md` only.

## Phase 7: Generate Report

Pre-report verification: every applicable phase task is complete; cross-reference evidence is recorded; counts are exact.

```text
## Architecture Documentation Review Report

### Repository Info
- Organization: {org}
- Repository: {repo}
- Project Type: {standard / ml_dl}
- Document Status: {exists / missing / exempt}
- Last Doc Update: {date}
- Last Code Update: {date}
- Documentation Freshness: {CURRENT / STALE}

### Structure Checks
- H1 title `# Architecture Design`: {PASS / FAIL — found "{actual}"}
- Required H2 sections present: {PASS / FAIL — list missing}
- Section order correct: {PASS / FAIL}
- TOC links valid: {PASS / FAIL}

### Content Accuracy (per section)
For each required section:
- Status: {PASS / NEEDS UPDATE / MISSING}
- Issues: {specific problems}
- Discovered in code: {evidence}
- Documented: {claim from doc}

### SOUP
- soup.json exists: {yes / no}
- architecture.md references soup.md (not duplicates): {yes / no}
- Total deps in lock files: {n}
- Documented in soup.json: {n}
- Missing from soup.json: {list}
- In soup.json but not in code: {list}
- Inaccurate Requirements: {list}
- Misclassified Risk Levels: {list}
- Weak Verification Reasoning: {list}

### Summary
- Sections accurate: {n}/{total}
- Sections need update: {n}
- Sections missing: {n}
- Critical issues: {high-priority list}

### Proposed Changes
{Specific edits with before/after for each section}
```

Ask before modifying: "I found the following issues with `docs/architecture.md`. Want me to fix them?"

## Phase 8: Write or Update the Doc

After approval, write `docs/architecture.md` (`mkdir -p docs` first if needed). **Do not paste the templates verbatim — fill them with content discovered in Phase 5.**

### Common skeleton (both project types)

```markdown
# Architecture Design

## Table of Contents

- [{Each required section as a link}](#...)

{Required sections per project type — see structure above}
```

### Standard project — section content guidance

- **Architecture diagram** — embed image (`![Architecture Diagram](./images/architecture.png)`) or fenced ` ```mermaid` block. Add a System Overview paragraph and a Component Interactions paragraph based on discovered modules and their imports.
- **Software units** — for each discovered module: Purpose (from docstring), Location (`path/to/module`), Key Components (classes/functions with docstring summaries), Internal Dependencies (other modules), External Dependencies (third-party packages).
- **Software of Unknown Provenance** — link to `soup.md` (auto-generated). Do NOT duplicate version numbers or dep tables. Include the SOUP fields explainer:
  - **Risk Level** (per IEC 62304): Low (cannot lead to harm), Medium (reversible harm), High (irreversible harm).
  - **Requirements**: "Why do you need this library?" — examples: "HTTP client for REST API", "CLI argument parsing", "Dependency" (transitive only).
  - **Verification Reasoning**: "Why this library among alternatives?" — examples: "Industry standard with active maintenance", "Official SDK provided by vendor", "Dependency" (transitive only).
  - Validation: Accuracy (Requirements match actual usage), Completeness (all lock-file packages present), Staleness (removed packages absent), Risk Level (appropriate for function).
- **Critical algorithms** — for each: Purpose, Location (`file` in `ClassName`/`function_name`), Implementation (brief description), Complexity (if documented), Security Considerations (if applicable).
- **Risk controls** — Security Measures (auth/authz, input validation, encryption), Error Handling (patterns from code), Logging & Monitoring, Failure Modes table (Failure Mode | Impact | Mitigation).

### ML/DL project — section content guidance

- **Datasets** — Data Sources table (Dataset | Source | Size | Format), Description (features, labels), Statistics from actual file analysis.
- **Data Preprocessing** — Pipeline (numbered steps with `file:function`), Transformations table (Transformation | Purpose | Implementation), Augmentation if applicable.
- **Data Splits** — Split table (Split | Ratio | Size | Method), Implementation location, random seed if found.
- **Model Architecture** — Model Type, Framework, Layer Specifications table (Layer | Type | Parameters | Output Shape), Configuration with the actual model class signature in a fenced code block, Input/Output specs.
- **Model Training** — Training Configuration table (Parameter | Value | Source) covering Optimizer, Learning Rate, Batch Size, Epochs, Loss Function, LR Scheduler. Training Script location, Procedure summary, Checkpointing approach.
- **Model Evaluation** — Metrics table (Metric | Implementation | Latest Value), Evaluation Script location, Benchmark Results table (Dataset | Metric | Value | Date).
- **Software of Unknown Provenance** — same as Standard, plus call out ML frameworks and data libraries.
- **Risk controls** — Model Risks table (Model drift, Data leakage, Overfitting — each with Likelihood | Impact | Mitigation), Data Risks, Operational Risks.
- **Model Deployment** — Deployment Architecture, Inference Implementation (`file`, entry point), Hardware Requirements table (GPU | Memory | Storage with Source column), Serving Configuration, Monitoring.

## Phase 9: Run Linters

After writing/updating, run `/co-dev:run-linters` and fix any errors.

## Validation Checklist

- [ ] H1 is exactly `# Architecture Design`
- [ ] All required H2 sections present in correct order
- [ ] TOC links resolve
- [ ] All documented modules exist in code; all code modules are documented
- [ ] `soup.json` exists; `architecture.md` references `soup.md` without duplicating
- [ ] `soup.json` Requirements match actual usage
- [ ] `soup.json` Risk Levels appropriate for each package's function
- [ ] File paths in doc point to actual files
- [ ] (ML/DL) hyperparameters / model architecture / metrics match implementation
- [ ] Risk controls reflect actual security measures

## Important Rules

1. **Never fabricate.** Only document what's in the code.
2. **Use stable references** — class/method/function names, not line numbers.
3. **Never duplicate SOUP data in architecture.md** — reference `soup.md`. Lock files are the version source of truth. All edits go to `soup.json`.
4. **Verify all paths** exist.
5. **Never remove existing valid content** — only update or add.
6. **Preserve custom sections** after the required ones.
7. **Ask before modifying.** Show proposed changes; get approval.
8. **Flag stale doc** if code changed significantly since last doc update.
9. **Document security deps with extra care** (crypto, auth).
10. **Keep metrics current** if results files exist.
11. **Run linters after changes.**
12. **Complete every phase** — skipping reveals nothing; cross-referencing reveals everything.
13. **Never validate against world knowledge alone.** Don't fact-check version numbers or external claims from training data — use web search or repo files.
