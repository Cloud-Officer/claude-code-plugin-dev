# claude-code-plugin-dev [![Build](https://github.com/Cloud-Officer/claude-code-plugin-dev/actions/workflows/build.yml/badge.svg)](https://github.com/Cloud-Officer/claude-code-plugin-dev/actions/workflows/build.yml)

Claude Code plugin for development workflow automation.

## Table of Contents

* [Introduction](#introduction)
* [Installation](#installation)
  * [Quick Start](#quick-start)
  * [Configure Remote MCPs (optional)](#configure-remote-mcps-optional)
  * [Complementary Plugins (optional)](#complementary-plugins-optional)
  * [Configure Environment Variables](#configure-environment-variables)
  * [Multi-Account Setups (direnv)](#multi-account-setups-direnv)
  * [Recommended Permissions](#recommended-permissions)
* [Usage](#usage)
  * [Commands](#commands)
  * [Skills](#skills)
  * [Language Servers (LSPs)](#language-servers-lsps)
  * [Local Development](#local-development)
* [Contributing](#contributing)

## Introduction

This plugin provides development workflow automation for Claude Code.

### Features

* Issue tracking integration (GitHub Issues and Jira)
* Automated deep code reviews using parallel agents
* PR generation with commit messages
* Linting and code quality checks
* Database schema documentation and natural language querying
* Project documentation review (README, architecture, user guide)
* Sprint work summaries grouped by repository
* Translation asset management via Loco (localise.biz) API
* Firebase Crashlytics crash analysis via BigQuery
* Figma design-to-code review for Android, iOS, and web
* Vercel deployment management and documentation search
* Stripe and PayPal payment management
* AWS infrastructure management and documentation search
* Google Cloud infrastructure management via gcloud
* New Relic observability data and alert management
* Heroku application management and deployment
* App Store Connect management (builds, TestFlight, reviews, IAPs)
* Google Play Store review management and analytics

## Installation

### Quick Start

The plugin bundles MCP servers that need `node` (for `npx`) and `uv` (for
`uvx`). Most skills also use a CLI as a fallback when the MCP isn't available. Install the **core
** for everyone, then only the optional CLIs for the skills you actually use.

#### macOS (Homebrew)

```bash
# Core (required)
brew install node uv gh jq
```

In Claude Code:

```text
/plugin marketplace add cloud-officer/claude-code-plugin-dev
/plugin install co-dev@cloud-officer
```

After install:

```bash
# Browser automation (Playwright MCP) — first run only
npx playwright install chromium
```

Optional service CLIs — install only what you need (each maps to a skill in the [Skills](#skills) table below):

```bash
brew install awscli google-cloud-sdk heroku newrelic-cli # cloud
brew install stripe/stripe-cli/stripe # stripe
brew tap ankitpokhrel/jira-cli && brew install jira-cli # jira
brew install mint && mint install zelentsov-dev/asc-mcp # iOS App Store Connect
npm i -g vercel # vercel
```

Language servers (LSPs) — only what you write. The plugin declares LSPs for many languages, but each binary needs to be on your PATH for that language to activate:

```bash
# JavaScript/TypeScript (covers .ts/.tsx/.js/.jsx/.mts/.cts/.mjs/.cjs)
npm i -g typescript typescript-language-server

# Python (covers .py/.pyi)
brew install pyright

# Ruby (covers .rb/.rake/.gemspec/.ru)
gem install ruby-lsp

# Go (covers .go)
go install golang.org/x/tools/gopls@latest

# Bash/shell (covers .sh/.bash/.zsh)
npm i -g bash-language-server

# Rust (covers .rs)
rustup component add rust-analyzer

# YAML (covers .yml/.yaml; provides GitHub Actions/k8s schema validation)
npm i -g yaml-language-server

# Swift (covers .swift) — bundled with Xcode, no install needed if Xcode is installed

# PHP (covers .php)
npm i -g intelephense

# Kotlin (covers .kt/.kts) — JetBrains' official LSP, requires Java 17+
brew install JetBrains/utils/kotlin-lsp

# Java (covers .java)
brew install jdtls

# C/C++/Objective-C (covers .c/.cpp/.h/.hpp/.m/.mm) — bundled with llvm
brew install llvm

# Perl (covers .pl/.pm/.t)
npm i -g perlnavigator-server
```

Each LSP is **inert until matching files exist
** — you only pay startup cost in repos that actually have those file types.

#### Linux (Debian/Ubuntu)

```bash
# Core (required)
sudo apt update && sudo apt install -y curl jq git nodejs npm
curl -LsSf https://astral.sh/uv/install.sh | sh
# gh: https://github.com/cli/cli/blob/trunk/docs/install_linux.md
```

In Claude Code:

```text
/plugin marketplace add cloud-officer/claude-code-plugin-dev
/plugin install co-dev@cloud-officer
```

After install:

```bash
npx playwright install chromium
```

Optional service CLIs: each tool ships its own Linux installer — see official docs for `aws`, `gcloud`, `heroku`,
`stripe`, `vercel`, `newrelic`, `jira-cli`. App Store Connect is macOS-only.

Language servers (LSPs): the `npm`, `gem`, `go install`, `rustup`, and
`cpan` install commands listed under the macOS section are cross-platform. Use your distro's package manager for
`clangd` (often `clang-tools` or `llvm`) and `pyright` (or
`pip install pyright`). Swift LSP requires Xcode (macOS only).

#### Windows (Scoop)

```powershell
# Core (required)
scoop install nodejs uv gh jq
```

In Claude Code:

```text
/plugin marketplace add cloud-officer/claude-code-plugin-dev
/plugin install co-dev@cloud-officer
```

After install:

```powershell
npx playwright install chromium
```

Optional service CLIs: install via `scoop`, `winget`, or each tool's installer. App Store Connect is macOS-only.

Language servers (LSPs): the `npm`, `gem`, `go install`, `rustup`, and
`cpan` install commands listed under the macOS section work on Windows under their respective toolchains. Use
`scoop install llvm` for `clangd`. Swift LSP is macOS-only (requires Xcode).

### Configure Remote MCPs (optional)

Some skills use remote MCP servers (OAuth, no local install). Add only the ones you'll use:

```bash
claude mcp add atlassian --transport http https://mcp.atlassian.com/v1/mcp
claude mcp add bigquery --transport http https://bigquery.googleapis.com/mcp
claude mcp add figma --transport http https://mcp.figma.com/mcp
claude mcp add newrelic --transport http https://mcp.newrelic.com/mcp/
claude mcp add paypal --transport http https://mcp.paypal.com/http
claude mcp add stripe --transport http https://mcp.stripe.com
claude mcp add vercel --transport http https://mcp.vercel.com
```

Each prompts for OAuth on first use. Skills that need a remote MCP fall back to a CLI when one exists — see the **Setup
** column in the [Skills](#skills) table for which skill needs which.

### Complementary Plugins (optional)

These official plugins from the `claude-plugins-official` marketplace pair well with
`co-dev`. They're independent — install only the ones relevant to your work. The
`claude-plugins-official` marketplace is auto-installed by Claude Code, so no `marketplace add` step is needed.

| Plugin                 | What it adds                                                                                                                        | Install                                                        |
|------------------------|-------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------|
| `plugin-dev`           | Toolkit for developing Claude Code plugins — 7 skills (hooks, MCP, structure, settings, commands, agents, skills) + validators      | `/plugin install plugin-dev@claude-plugins-official`           |
| `claude-md-management` | Audit and revise CLAUDE.md files based on session learnings                                                                         | `/plugin install claude-md-management@claude-plugins-official` |
| `claude-code-setup`    | Analyze a codebase and recommend Claude Code automations to add                                                                     | `/plugin install claude-code-setup@claude-plugins-official`    |
| `skill-creator`        | Guided skill creation workflow (overlaps with `plugin-dev`'s skill-development skill — pick one)                                    | `/plugin install skill-creator@claude-plugins-official`        |
| `code-simplifier`      | Refactor recently-modified code for clarity, DRY, and consistency                                                                   | `/plugin install code-simplifier@claude-plugins-official`      |
| `code-review`          | Lean automated PR review with confidence scoring (alternative to `co-dev`'s `/code-review-deep`, which is broader and not PR-bound) | `/plugin install code-review@claude-plugins-official`          |
| `security-guidance`    | Proactive security hints via PreToolUse hooks (complements `code-review-deep`'s reactive audit)                                     | `/plugin install security-guidance@claude-plugins-official`    |
| `frontend-design`      | Opinionated patterns for production-grade frontend interfaces                                                                       | `/plugin install frontend-design@claude-plugins-official`      |
| `superpowers`          | Brainstorming and subagent-driven workflows                                                                                         | `/plugin install superpowers@claude-plugins-official`          |
| `agent-sdk-dev`        | Toolkit for building apps on the Anthropic **Agent SDK** (a different stack from Claude Code plugins)                               | `/plugin install agent-sdk-dev@claude-plugins-official`        |

### Configure Environment Variables

All credentials are read from **environment variables
** — they are never stored in the plugin. Each skill's required vars are listed in the **Setup
** column of the [Skills](#skills) table below.

For switching between accounts/projects per directory, see the [Multi-Account Setups](#multi-account-setups-direnv) section.

### Multi-Account Setups (direnv)

Every account-bound MCP server in this plugin reads its credentials from environment variables — no credentials are stored in
`.mcp.json`. This makes [direnv](https://direnv.net/) a natural fit for switching between accounts (different AWS profiles, separate Postgres instances, multiple GitHub orgs, etc.) by setting per-directory env vars in an
`.envrc` file.

**Important caveat:** Claude Code spawns MCP servers **once, at startup
**, and they inherit the shell environment at that moment. The implication:

* ✓ Works: `cd ~/project-a && claude` — MCPs pick up project-a's env vars from `.envrc`. Quit,
  `cd ~/project-b && claude` — MCPs pick up project-b's env vars.
* ✗ Does not work: starting Claude Code in one project, then
  `cd`-ing to another mid-session. The already-running MCP servers keep the original env vars and continue talking to the original account.

**Bottom line:
** to switch accounts, quit Claude Code and relaunch it from the target directory. direnv handles the rest.

### Recommended Permissions

This plugin bundles several MCP servers. By default, Claude Code will prompt for permission each time an MCP tool is called. To auto-approve these tools, add the following entries to the
`permissions.allow` array in your `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__appstore__*",
      "mcp__aws__*",
      "mcp__chrome-devtools__*",
      "mcp__context7__*",
      "mcp__fetch__*",
      "mcp__gcloud__*",
      "mcp__github__*",
      "mcp__mongodb__*",
      "mcp__mysql__*",
      "mcp__playstore__*",
      "mcp__playwright__*",
      "mcp__postgres__*",
      "mcp__redis__*"
    ]
  }
}
```

If you also use remote MCP servers (see [Configure Remote MCPs](#configure-remote-mcps-optional)), add their patterns too:

```json
{
  "permissions": {
    "allow": [
      "mcp__atlassian__*",
      "mcp__bigquery__*",
      "mcp__figma__*",
      "mcp__newrelic__*",
      "mcp__paypal__*",
      "mcp__stripe__*",
      "mcp__vercel__*"
    ]
  }
}
```

**Note:** These entries merge with your existing
`allow` list — you don't need to replace it. Only add entries for the MCP servers you actually use.

## Usage

### Commands

| Command                         | Description                                            |
|---------------------------------|--------------------------------------------------------|
| `/co-dev:work-issue <issue-id>` | Work on a GitHub or Jira issue (bug, feature, or task) |
| `/co-dev:code-review-deep`      | Deep code review using parallel agent strategy         |

### Skills

These skills are automatically available to Claude. The **Setup
** column lists what you need to configure for each — env vars, one-time auth commands, or remote MCP additions. Skills with no setup work out of the box.

| Skill                 | Description                                                  | Setup                                                                                                                                                                                                                                               |
|-----------------------|--------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `analyze-db`          | Generate docs/DB.md with database schema docs                | DB-specific env vars — see `query-db` row                                                                                                                                                                                                           |
| `appstore`            | Manage App Store Connect (builds, TestFlight, reviews, IAPs) | macOS-only. `mint install zelentsov-dev/asc-mcp`. Env: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY_PATH` (path to `.p8`). [Create API key](https://appstoreconnect.apple.com/access/integrations/api)                                           |
| `aws`                 | Manage AWS infrastructure and services                       | `aws configure`, or env: `AWS_PROFILE` *(or)* `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_REGION`                                                                                                                                          |
| `create-issue`        | Create GitHub or Jira issues with proper templates           | GitHub: `GITHUB_PERSONAL_ACCESS_TOKEN` *(or)* `gh auth login`. Jira: atlassian remote MCP *(or)* `jira init`                                                                                                                                        |
| `create-pr`           | Generate commit message, PR title, and PR body               | None — uses local `git`                                                                                                                                                                                                                             |
| `crashlytics`         | Query Firebase Crashlytics crash data from BigQuery          | bigquery remote MCP *(or)* `gcloud auth application-default login`. Env: `BQ_PROJECT`, `BQ_CRASHLYTICS_DATASET`                                                                                                                                     |
| `gcloud`              | Manage Google Cloud infrastructure and services              | `gcloud auth login && gcloud config set project <id>`. Optional: `CLOUDSDK_ACTIVE_CONFIG_NAME` for named configs                                                                                                                                    |
| `heroku`              | Manage Heroku apps, dynos, logs, and databases               | `heroku login`                                                                                                                                                                                                                                      |
| `loco`                | Manage Loco translation assets (create, delete, scan)        | Env: `LOCO_API_KEY` *(or)* per-project `LOCO_API_KEY_<PROJECT>` (e.g. `LOCO_API_KEY_IOS`)                                                                                                                                                           |
| `newrelic`            | Query New Relic observability data, alerts, and logs         | newrelic remote MCP *(or)* `newrelic profile add --name default --apiKey NRAK-... --accountId ...`                                                                                                                                                  |
| `paypal`              | Manage PayPal invoices, payments, and disputes               | paypal remote MCP **(required — no CLI fallback)**                                                                                                                                                                                                  |
| `playstore`           | Fetch, analyze, and respond to Google Play reviews           | Env: `GOOGLE_PLAY_CREDENTIALS_PATH` (path to service-account JSON; needs Google Play Developer API + Play Console access)                                                                                                                           |
| `query-db`            | Query databases using natural language via CLI               | Per DB: PG (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) · MySQL (`MYSQL_*`) · Mongo (`MDB_MCP_CONNECTION_STRING`) · Redis (`REDIS_URL`) · SQLite (`SQLITE_DB`) · BigQuery (`BQ_PROJECT`, `BQ_DATASETS`) · ES (`ES_URL`, `ES_API_KEY`) |
| `review-architecture` | Review or create docs/architecture.md                        | None — uses bundled `fetch` + `context7` MCPs                                                                                                                                                                                                       |
| `review-design`       | Compare UI code against Figma designs (Android, iOS, web)    | figma remote MCP **(required — no CLI fallback)**                                                                                                                                                                                                   |
| `review-readme`       | Review or create README.md to match standards                | None — uses bundled `fetch` + `context7` MCPs                                                                                                                                                                                                       |
| `review-user-guide`   | Review or create docs/user-guide.md with user documentation  | None — uses bundled `fetch` + `context7` MCPs                                                                                                                                                                                                       |
| `run-linters`         | Run linters and fix any issues found                         | None — runs project linters already configured in the repo                                                                                                                                                                                          |
| `sprint-summary`      | Summarize sprint items grouped by repo in ~3-day blocks      | atlassian remote MCP *(or)* `jira init`                                                                                                                                                                                                             |
| `stripe`              | Manage Stripe payments, customers, and subscriptions         | stripe remote MCP *(or)* `stripe login`                                                                                                                                                                                                             |
| `vercel`              | Manage Vercel deployments and projects                       | vercel remote MCP *(or)* `vercel login`                                                                                                                                                                                                             |
| `weekly-dev-report`   | Weekly dev activity report from Jira sprint + GitHub         | atlassian remote MCP *(or)* `jira init`. GitHub: `gh auth login`. Optional env: `WEEKLY_DEV_REPORT_TO` (required for `--send`), `WEEKLY_DEV_REPORT_CC`, `GITHUB_USERNAME_MAP`                                                                       |

### Language Servers (LSPs)

The plugin declares LSPs for 13 languages. Each is **idle until you open a matching file** in your workspace — opening
`app.ts` activates the TypeScript LSP, opening `lib.go` activates
`gopls`, etc. No LSP runs in a repo that doesn't have matching file extensions.

**Why they matter:** an active LSP gives Claude **real type information
** from your installed dependencies — function signatures, references, type definitions, completions — instead of inferring from source code. This is what stops Claude from hallucinating method names on third-party libraries or guessing the shape of a return type. Any skill that touches code (
`code-review-deep`, `run-linters`, `work-issue`,
`create-pr`, the deep-analysis agents) becomes meaningfully more accurate.

**Activation rules:**

* LSPs spawn on demand when matching file extensions exist in the workspace, and stop when Claude Code exits.
* If the LSP binary is not on your
  `PATH`, that language silently falls back to source-only analysis — the rest of the plugin is unaffected.
* Each LSP communicates over stdio with Claude Code's LSP host; you don't interact with them directly.
* They are **independent of the bundled MCP servers
  ** — different protocol, different lifecycle, different purpose. MCPs give Claude tools (e.g., "search GitHub", "query a database"). LSPs give Claude knowledge of your code.

**Bundled LSPs:**

| Language               | LSP binary                           | File extensions                                                       |
|------------------------|--------------------------------------|-----------------------------------------------------------------------|
| TypeScript /JavaScript | `typescript-language-server`         | `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`          |
| Python                 | `pyright-langserver`                 | `.py`, `.pyi`                                                         |
| Ruby                   | `ruby-lsp`                           | `.rb`, `.rake`, `.gemspec`, `.ru`                                     |
| Go                     | `gopls`                              | `.go`                                                                 |
| Bash                   | `bash-language-server`               | `.sh`, `.bash`, `.zsh`                                                |
| Rust                   | `rust-analyzer`                      | `.rs`                                                                 |
| YAML                   | `yaml-language-server`               | `.yml`, `.yaml` (provides GitHub Actions / k8s schema validation)     |
| Swift                  | `sourcekit-lsp` (bundled with Xcode) | `.swift`                                                              |
| PHP                    | `intelephense`                       | `.php`                                                                |
| Kotlin                 | `kotlin-lsp` (JetBrains, pre-alpha)  | `.kt`, `.kts` — JVM-only Gradle/Maven projects; KMP not yet supported |
| Java                   | `jdtls`                              | `.java`                                                               |
| C / C++ / Objective-C  | `clangd`                             | `.c`, `.cpp`, `.cc`, `.cxx`, `.h`, `.hpp`, `.hh`, `.hxx`, `.m`, `.mm` |
| Perl                   | `perlnavigator`                      | `.pl`, `.pm`, `.t`                                                    |

Install commands per LSP are in the [macOS Quick Start](#macos-homebrew) section. **Install only the LSPs for languages
you actually write** — each one adds a small startup cost only when its file types appear in a workspace.

### Local Development

```bash
claude --plugin-dir /path/to/claude-code-plugin-dev
```

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
