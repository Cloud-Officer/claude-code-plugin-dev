# claude-code-plugin-dev [![Build](https://github.com/Cloud-Officer/claude-code-plugin-dev/actions/workflows/build.yml/badge.svg)](https://github.com/Cloud-Officer/claude-code-plugin-dev/actions/workflows/build.yml)

Claude Code plugin for development workflow automation.

## Table of Contents

* [Introduction](#introduction)
* [Installation](#installation)
  * [Quick Start](#quick-start)
  * [Configure Remote MCPs (optional)](#configure-remote-mcps-optional)
  * [Google Workspace MCP (optional)](#google-workspace-mcp-optional)
  * [Complementary Plugins (optional)](#complementary-plugins-optional)
  * [Configure Environment Variables](#configure-environment-variables)
  * [Multi-Account Setups (direnv)](#multi-account-setups-direnv)
  * [Recommended Permissions](#recommended-permissions)
* [Usage](#usage)
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
* Automated test generation with coverage enforcement across 10 languages (RSpec, PHPUnit/Pest, pytest, Jest/Vitest, xUnit, Swift Testing/XCUITest, Kotest, Go, GoogleTest, Rust)
* Database schema documentation and natural language querying
* Project documentation review (README, architecture, user guide)
* Sprint work summaries grouped by repository
* Translation asset management via Loco (localise.biz) API
* monday.com board, item, and work-management operations
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
* Google Workspace integration (Gmail, Calendar, Drive, Docs, Sheets, Slides, Forms, Tasks, Contacts, Chat) via optional [`workspace-mcp`](#google-workspace-mcp-optional) setup

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
claude plugin marketplace add cloud-officer/claude-code-plugin-dev
claude plugin install co-dev@cloud-officer
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
claude plugin marketplace add cloud-officer/claude-code-plugin-dev
claude plugin install co-dev@cloud-officer
```

After install:

```bash
npx playwright install chromium
```

Optional service CLIs: each tool ships its own Linux installer — see official docs for `aws`, `gcloud`, `heroku`,
`stripe`, `vercel`, `newrelic`, `jira-cli`. App Store Connect is macOS-only.

Language servers (LSPs): the `npm`, `gem`, `go install`, and `rustup`
install commands listed under the macOS section are cross-platform. Use your distro's package manager for
`clangd` (often `clang-tools` or `llvm`) and `pyright` (or
`pip install pyright`). Swift LSP requires Xcode (macOS only).

#### Windows (Scoop)

```powershell
# Core (required)
scoop install nodejs uv gh jq
```

In Claude Code:

```text
claude plugin marketplace add cloud-officer/claude-code-plugin-dev
claude plugin install co-dev@cloud-officer
```

After install:

```powershell
npx playwright install chromium
```

Optional service CLIs: install via `scoop`, `winget`, or each tool's installer. App Store Connect is macOS-only.

Language servers (LSPs): the `npm`, `gem`, `go install`, and `rustup`
install commands listed under the macOS section work on Windows under their respective toolchains. Use
`scoop install llvm` for `clangd`. Swift LSP is macOS-only (requires Xcode).

### Configure Remote MCPs (optional)

Some skills use remote MCP servers (no local install). Add only the ones you'll use — `claude mcp add` defaults to *
*local scope**, so each is registered for the current folder only rather than always-loaded for every project:

```bash
claude mcp add atlassian --transport http https://mcp.atlassian.com/v1/mcp
claude mcp add bigquery --transport http https://bigquery.googleapis.com/mcp
claude mcp add figma --transport http https://mcp.figma.com/mcp
claude mcp add monday --transport http https://mcp.monday.com/mcp --header 'Authorization: Bearer ${MONDAY_TOKEN}'
claude mcp add newrelic --transport http https://mcp.newrelic.com/mcp/
claude mcp add paypal --transport http https://mcp.paypal.com/http
claude mcp add stripe --transport http https://mcp.stripe.com
claude mcp add vercel --transport http https://mcp.vercel.com
```

Most prompt for OAuth on first use. **monday
** is the exception — it authenticates with a personal access token instead of OAuth, so it takes a Bearer header (the token stays a runtime
`${MONDAY_TOKEN}` reference, never written into the stored config). Skills that need a remote MCP fall back to a CLI when one exists — see the **Setup
** column in the [Skills](#skills) table for which skill needs which.

**Naming caveat for multi-tenant setups.
** Each server name owns exactly one OAuth grant — Claude Code stores the access token keyed by the name and reuses it for every call. If you work across multiple tenants of the same service (e.g. two Atlassian sites, two Stripe accounts) from different folders on one machine,
**give each instance a distinct name
** rather than reusing the bare name. Otherwise the OAuth token from whichever folder authorized first leaks into the other folder, even though local-scope registration looks isolated.

```bash
# in ~/work/companya
claude mcp add atlassian-companya --transport http https://mcp.atlassian.com/v1/mcp

# in ~/work/companyb
claude mcp add atlassian-companyb --transport http https://mcp.atlassian.com/v1/mcp
```

This applies to every OAuth-at-connect remote MCP listed above (`atlassian`, `bigquery`, `figma`, `newrelic`, `paypal`,
`stripe`, `vercel`) — not to stdio servers like
`google-workspace`, which select identity per-call via a parameter. If you rename instances, update the [Recommended Permissions](#recommended-permissions) entries to allow each variant.

### Google Workspace MCP (optional)

The
`co-dev` plugin focuses on engineering workflows (issues, PRs, code review, deployments). Pair it with the open-source [`workspace-mcp`](https://github.com/taylorwilsdon/google_workspace_mcp) server to add Gmail, Calendar, Drive, Docs, Sheets, Slides, Forms, Tasks, Contacts, and Google Chat — useful alongside several of this plugin's skills (e.g.
`weekly-dev-report` can email the report directly once Gmail is wired up, and
`sprint-summary` output can be pasted straight into a shared Doc or Calendar event).

This MCP is **not bundled
** with the plugin — the steps below are independent and only needed if you want Workspace access from Claude Code.

#### Step 1 — Google Cloud admin setup (one-time, per Workspace org)

Sign in at [console.cloud.google.com](https://console.cloud.google.com) **with your Workspace admin account
** — the org must be associated with the project, otherwise the **Internal** audience option will not appear later.

1. **Create the project** — top-bar dropdown → **New Project** → name `workspace-mcp`, **Organization** = your Workspace org (e.g. `yourcompany.com`). If your org doesn't appear, the Workspace and Cloud accounts aren't linked yet — fix at [admin.google.com](https://admin.google.com) → Account → Google Cloud.
2. **Enable the APIs** — APIs & Services → Library → enable each, one by one: Gmail, Google Calendar, Google Drive, Google Docs, Google Sheets, Google Slides, Google Forms, Tasks, People (for Contacts), Google Chat.
3. **Configure the OAuth consent screen** — APIs & Services → OAuth consent screen → **Get started**.
   * **App name:** `Workspace MCP`
   * **User support email:** your admin email
   * **Audience:** **Internal** (restricts auth to users in your org, no Google verification, no 100-user testing cap). If only **External** is offered, you signed in with the wrong account or created the project under No Organization.
   * **Developer contact:** your admin email
4. **Create the OAuth client credentials** — APIs & Services → Credentials → **Create Credentials → OAuth Client ID**.
   * **Application type:** **Desktop app** (Web application will not work — it causes redirect URI errors during auth)
   * **Name:** `workspace-mcp-desktop`
5. Copy the **Client ID** (`...apps.googleusercontent.com`) and **Client Secret** (`GOCSPX-...`). Treat the secret like a password; never commit it.

The same Client ID and Secret work for every user in the org since the consent screen is Internal. **Multiple Workspace
organizations
** (e.g. a personal org and a separate company org) each need their own Cloud project and credentials — the same Client ID cannot be reused across orgs.

#### Step 2 — Per-machine install

**macOS:**

```bash
brew install uv direnv
```

Hook direnv into your shell — add to `~/.zshrc` (once, then `source ~/.zshrc`):

```bash
eval "$(direnv hook zsh)"
```

Then in the directory where you'll launch Claude Code, create an `.envrc` file with everything workspace-mcp needs:

```bash
export GOOGLE_OAUTH_CLIENT_ID="your-client-id"
export GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
export USER_GOOGLE_EMAIL="you@yourdomain.com"
export PORT="8765" # any unused port — see "Multi-account & multi-session" below for why this matters
```

Approve it with `direnv allow` (run from that directory). direnv loads the vars whenever you
`cd` in and unloads them when you `cd` out — keep one
`.envrc` per workspace org / per concurrently-running session, each with its own `USER_GOOGLE_EMAIL` and
`PORT`. See [Multi-Account Setups (direnv)](#multi-account-setups-direnv) below for the caveats around switching mid-session.

**Windows (PowerShell, no admin needed):**

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
[System.Environment]::SetEnvironmentVariable("GOOGLE_OAUTH_CLIENT_ID", "your-client-id", "User")
[System.Environment]::SetEnvironmentVariable("GOOGLE_OAUTH_CLIENT_SECRET", "your-client-secret", "User")
[System.Environment]::SetEnvironmentVariable("USER_GOOGLE_EMAIL", "you@yourdomain.com", "User")
[System.Environment]::SetEnvironmentVariable("PORT", "8765", "User")
```

Close and reopen PowerShell so the new env vars take effect. Git for Windows must also be installed (Claude Code uses Git Bash internally) — get it from [git-scm.com](https://git-scm.com/download/win) with default options.

User-scope env vars are global on Windows, so if you need a second workspace account or run multiple Claude sessions concurrently, override
`USER_GOOGLE_EMAIL` and `PORT` per session before launching Claude (
`$env:USER_GOOGLE_EMAIL="..."; $env:PORT="8766"; claude`).

#### Step 3 — Add the MCP server

Run this **from the directory
** where you want the server active (the default scope is local — the registration is tied to that working directory, not your whole user account). The server inherits
`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `USER_GOOGLE_EMAIL`, and
`PORT` from the shell environment Claude Code is launched in, so no `-e` flags are needed:

```bash
claude mcp add google-workspace -- uvx workspace-mcp --tool-tier complete
```

(Add `--scope user` if you want the server available globally in every directory; add
`--scope project` to write it to a shared `.mcp.json` in the repo — but never with hard-coded credentials, since
`.mcp.json` typically gets committed.)

On first use, a browser window opens for OAuth — sign in with the matching Google account and approve the scopes. Tokens cache locally:

* macOS: `~/.google_workspace_mcp/credentials/`
* Windows: `%USERPROFILE%\.google_workspace_mcp\credentials\`

No browser prompt on subsequent startups. To **update** workspace-mcp:
`uv cache clean` — Claude Code fetches the latest version on next startup. To **revoke
** access: delete the credentials directory above, or remove the
`Workspace MCP` app at [myaccount.google.com/permissions](https://myaccount.google.com/permissions). To **rotate
** the Client Secret if it leaks: APIs & Services → Credentials → `workspace-mcp-desktop` → **Reset Secret
**, then update env vars and re-auth.

#### Multi-account & multi-session port assignment (important)

The workspace-mcp server binds a local port for its OAuth callback (default `8000`). **Every workspace-mcp instance
running concurrently on the machine needs a unique port.
** There are two scenarios where this matters — most people anticipate the first but not the second:

1. **Multiple accounts on the same machine** (e.g. personal + company in different folders). Each folder's
   `.envrc` (macOS/direnv) — or each session's PowerShell overrides (Windows) — needs its own
   `PORT`, otherwise both instances try to bind `8000` and the second one fails.
2. **Multiple Claude Code sessions running at the same time, even from different directories.
   ** Per-directory env vars don't help if two sessions still resolve to the same
   `PORT` — every running Claude Code session spawns its own MCP processes, and if any two of them point at the same port, the later one's workspace-mcp won't start. Even with a single account per directory, every directory whose Claude session might run
   *concurrently* with another needs its own port.

Pick ports above 8000 (e.g. `8765`, `8766`, `8767`, …) and assign one per account
*and* per concurrently-running session. The setup is then **one `.envrc` per directory** plus a single
`claude mcp add` from each. Example with two accounts on macOS:

```bash
# ~/work/personal-stuff/.envrc
export GOOGLE_OAUTH_CLIENT_ID="personal-client-id"
export GOOGLE_OAUTH_CLIENT_SECRET="personal-secret"
export USER_GOOGLE_EMAIL="you@personal.com"
export PORT="8765"
```

```bash
# ~/work/cloudofficer/.envrc
export GOOGLE_OAUTH_CLIENT_ID="company-client-id"
export GOOGLE_OAUTH_CLIENT_SECRET="company-secret"
export USER_GOOGLE_EMAIL="you@company.com"
export PORT="8766"
```

Run `direnv allow` once in each directory, then register the server from each (no
`-e` flags — credentials and port come from `.envrc`):

```bash
cd ~/work/personal-stuff && claude mcp add google-workspace -- uvx workspace-mcp --tool-tier complete
cd ~/work/cloudofficer && claude mcp add google-workspace -- uvx workspace-mcp --tool-tier complete
```

The port only matters during the OAuth callback handshake; it does not need to be reachable from outside the machine. Verify everything is registered (run from inside each directory):

```bash
claude mcp list
```

Sample prompts once it's up:

```text
List my unread emails
Search drive for the Q3 proposal
Create a calendar event for tomorrow at 2pm
```

### Complementary Plugins (optional)

These official plugins from the `claude-plugins-official` marketplace pair well with
`co-dev`. They're independent — install only the ones relevant to your work. The
`claude-plugins-official` marketplace is auto-installed by Claude Code, so no `marketplace add` step is needed.

| Plugin                 | What it adds                                                                                                                                                                          | Install                                                                                                               |
|------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| `plugin-dev`           | Toolkit for developing Claude Code plugins — 7 skills (hooks, MCP, structure, settings, commands, agents, skills) + validators                                                        | `claude plugin install plugin-dev@claude-plugins-official`                                                            |
| `claude-md-management` | Audit and revise CLAUDE.md files based on session learnings                                                                                                                           | `claude plugin install claude-md-management@claude-plugins-official`                                                  |
| `claude-code-setup`    | Analyze a codebase and recommend Claude Code automations to add                                                                                                                       | `claude plugin install claude-code-setup@claude-plugins-official`                                                     |
| `skill-creator`        | Guided skill creation workflow (overlaps with `plugin-dev`'s skill-development skill — pick one)                                                                                      | `claude plugin install skill-creator@claude-plugins-official`                                                         |
| `code-simplifier`      | Refactor recently-modified code for clarity, DRY, and consistency                                                                                                                     | `claude plugin install code-simplifier@claude-plugins-official`                                                       |
| `code-review`          | Lean automated PR review with confidence scoring (alternative to `co-dev`'s `/code-review-deep`, which is broader and not PR-bound)                                                   | `claude plugin install code-review@claude-plugins-official`                                                           |
| `security-guidance`    | Proactive security hints via PreToolUse hooks (complements `code-review-deep`'s reactive audit)                                                                                       | `claude plugin install security-guidance@claude-plugins-official`                                                     |
| `frontend-design`      | Opinionated patterns for production-grade frontend interfaces                                                                                                                         | `claude plugin install frontend-design@claude-plugins-official`                                                       |
| `superpowers`          | Brainstorming and subagent-driven workflows                                                                                                                                           | `claude plugin install superpowers@claude-plugins-official`                                                           |
| `agent-sdk-dev`        | Toolkit for building apps on the Anthropic **Agent SDK** (a different stack from Claude Code plugins)                                                                                 | `claude plugin install agent-sdk-dev@claude-plugins-official`                                                         |
| `document-skills`      | Anthropic's `xlsx`/`docx`/`pptx`/`pdf` skills — deliver `co-dev` reports (`weekly-dev-report`, `sprint-summary`, `query-db`, …) as Office/PDF files. Separate marketplace (see note). | `claude plugin marketplace add anthropics/skills` then `claude plugin install document-skills@anthropic-agent-skills` |

> `document-skills` lives on Anthropic's own `anthropic-agent-skills` marketplace (not
> `claude-plugins-official`), so it needs the one-time `claude plugin marketplace add` step above. It is
> **not** open source — review each skill's `LICENSE.txt`. Optional: Claude Code can already generate
> these formats on demand via open-source libraries (`openpyxl`, `python-docx`, `python-pptx`,
> `reportlab`); the skills mainly add standardized, repeatable formatting.

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
      "mcp__monday__*",
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

**Renamed instances
** (see [Naming caveat for multi-tenant setups](#configure-remote-mcps-optional)) need their own permission entry — e.g.
`mcp__atlassian-companya__*` and `mcp__atlassian-companyb__*` instead of (or in addition to) the bare
`mcp__atlassian__*`.

## Usage

### Skills

These skills are automatically available to Claude. The **Setup
** column lists what you need to configure for each — env vars, one-time auth commands, or remote MCP additions. Skills with no setup work out of the box.

| Skill                    | Description                                                                                                             | Setup                                                                                                                                                                                                                                               |
|--------------------------|-------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `analyze-db`             | Generate docs/db.md with database schema docs                                                                           | DB-specific env vars — see `query-db` row                                                                                                                                                                                                           |
| `appstore`               | Manage App Store Connect (builds, TestFlight, reviews, IAPs)                                                            | macOS-only. `mint install zelentsov-dev/asc-mcp`. Env: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY_PATH` (path to `.p8`). [Create API key](https://appstoreconnect.apple.com/access/integrations/api)                                           |
| `aws`                    | Manage AWS infrastructure and services                                                                                  | `aws configure`, or env: `AWS_PROFILE` *(or)* `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_REGION`                                                                                                                                          |
| `code-review-deep`       | Exhaustive multi-phase code audit using parallel agents                                                                 | None — uses bundled `github` + `context7` MCPs                                                                                                                                                                                                      |
| `create-issue`           | Create GitHub or Jira issues with proper templates                                                                      | GitHub: `GITHUB_PERSONAL_ACCESS_TOKEN` *(or)* `gh auth login`. Jira: atlassian remote MCP *(or)* `jira init`                                                                                                                                        |
| `create-pr`              | Generate PR content, open the PR, return to default branch                                                              | GitHub: `gh auth login` *(or)* `GITHUB_PERSONAL_ACCESS_TOKEN`                                                                                                                                                                                       |
| `crashlytics`            | Query Firebase Crashlytics crash data from BigQuery                                                                     | bigquery remote MCP *(or)* `gcloud auth application-default login`. Env: `BQ_PROJECT`, `BQ_CRASHLYTICS_DATASET`                                                                                                                                     |
| `doc-tracker-coverage`   | Verify a Google Doc section's items are tracked in Monday/Jira                                                          | Google Doc read: Workspace Docs MCP *(or)* `claude.ai Google Drive` MCP *(or)* published-to-web doc. monday: `claude mcp add monday` (`${MONDAY_TOKEN}`). Jira: atlassian remote MCP *(or)* `jira init` Optional env: `DOC_TRACKER_COVERAGE_TEAMS`  |
| `gcloud`                 | Manage Google Cloud infrastructure and services                                                                         | `gcloud auth login && gcloud config set project <id>`. Optional: `CLOUDSDK_ACTIVE_CONFIG_NAME` for named configs                                                                                                                                    |
| `heroku`                 | Manage Heroku apps, dynos, logs, and databases                                                                          | `heroku login`                                                                                                                                                                                                                                      |
| `loco`                   | Manage Loco translation assets (create, delete, scan)                                                                   | Env: `LOCO_API_KEY` *(or)* per-project `LOCO_API_KEY_<PROJECT>` (e.g. `LOCO_API_KEY_IOS`)                                                                                                                                                           |
| `monday`                 | Manage monday.com boards, items, groups, columns, and updates                                                           | `claude mcp add monday` with a `${MONDAY_TOKEN}` Bearer header — see [Configure Remote MCPs](#configure-remote-mcps-optional). Token from avatar → Developers → My access tokens. MCP-only, no CLI fallback                                         |
| `monday-weekly-report`   | Weekly project-status report from monday.com board(s)                                                                   | `claude mcp add monday` with a `${MONDAY_TOKEN}` Bearer header (see `monday` above). For attribution enable dynamic API. Optional env: `MONDAY_WEEKLY_REPORT_BOARDS`, `MONDAY_WEEKLY_REPORT_TO` (required for `--send`), `MONDAY_WEEKLY_REPORT_CC`  |
| `newrelic`               | Query New Relic observability data, alerts, and logs                                                                    | newrelic remote MCP *(or)* `newrelic profile add --name default --apiKey NRAK-... --accountId ...`                                                                                                                                                  |
| `paypal`                 | Manage PayPal invoices, payments, and disputes                                                                          | paypal remote MCP **(required — no CLI fallback)**                                                                                                                                                                                                  |
| `playstore`              | Fetch, analyze, and respond to Google Play reviews                                                                      | Env: `GOOGLE_APPLICATION_CREDENTIALS` (path to service-account JSON; needs Google Play Developer API + Play Console access). Requires `uv`/`uvx` on PATH.                                                                                           |
| `query-db`               | Query databases using natural language via CLI                                                                          | Per DB: PG (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) · MySQL (`MYSQL_*`) · Mongo (`MDB_MCP_CONNECTION_STRING`) · Redis (`REDIS_URL`) · SQLite (`SQLITE_DB`) · BigQuery (`BQ_PROJECT`, `BQ_DATASETS`) · ES (`ES_URL`, `ES_API_KEY`) |
| `review-architecture`    | Review or create docs/architecture.md                                                                                   | None — uses bundled `fetch` + `context7` MCPs                                                                                                                                                                                                       |
| `review-copy`            | Audit user-facing copy — microcopy, form/help text, voice & tone, i18n readiness, marketing; writes docs/copy-review.md | None — uses `git` + optional `loco` handoff for i18n keys                                                                                                                                                                                           |
| `review-design`          | Compare UI code against Figma designs (Android, iOS, web)                                                               | figma remote MCP **(required — no CLI fallback)**                                                                                                                                                                                                   |
| `review-readme`          | Review or create README.md to match standards                                                                           | None — uses bundled `fetch` + `context7` MCPs                                                                                                                                                                                                       |
| `review-seo`             | Audit SEO + GEO (AI answer-engine) for a codebase and/or live URL; writes docs/seo-audit.md                             | None — uses `curl` + bundled `fetch` MCP; optional `chrome-devtools-mcp` for Core Web Vitals                                                                                                                                                        |
| `review-user-guide`      | Review or create docs/user-guide.md with user documentation                                                             | None — uses bundled `fetch` + `context7` MCPs                                                                                                                                                                                                       |
| `run-linters`            | Run linters and fix any issues found                                                                                    | None — runs project linters already configured in the repo                                                                                                                                                                                          |
| `sprint-summary`         | Summarize sprint items grouped by repo in ~3-day blocks                                                                 | atlassian remote MCP *(or)* `jira init`                                                                                                                                                                                                             |
| `stripe`                 | Manage Stripe payments, customers, and subscriptions                                                                    | stripe remote MCP *(or)* `stripe login`                                                                                                                                                                                                             |
| `vercel`                 | Manage Vercel deployments and projects                                                                                  | vercel remote MCP *(or)* `vercel login`                                                                                                                                                                                                             |
| `verify-resolved-issues` | Audit resolved/fixed/done issues, verify fixes, close or reopen                                                         | GitHub: `gh auth login` *(or)* `GITHUB_PERSONAL_ACCESS_TOKEN`. Jira: atlassian remote MCP *(or)* `jira init`                                                                                                                                        |
| `weekly-dev-report`      | Weekly dev activity report from Jira sprint + GitHub                                                                    | atlassian remote MCP *(or)* `jira init`. GitHub: `gh auth login`. Optional env: `WEEKLY_DEV_REPORT_TO` (required for `--send`), `WEEKLY_DEV_REPORT_CC`, `GITHUB_USERNAME_MAP`                                                                       |
| `work-issue`             | Implement GitHub/Jira issue(s) end-to-end and open a PR                                                                 | GitHub: `gh auth login` *(or)* `GITHUB_PERSONAL_ACCESS_TOKEN`. Jira: atlassian remote MCP *(or)* `jira init`                                                                                                                                        |
| `write-tests`            | Generate and run tests in the repo's own framework (unit/integration/e2e); enforces 80/80 line/branch coverage          | None — uses the test runner already in the repo (RSpec, pytest, Jest/Vitest, go test, dotnet, xcodebuild, gradle, PHPUnit/Pest, cargo, ctest, …)                                                                                                    |

### Language Servers (LSPs)

The plugin declares LSPs for 13 languages. Each is **idle until you open a matching file** in your workspace — opening
`app.ts` activates the TypeScript LSP, opening `lib.go` activates
`gopls`, etc. No LSP runs in a repo that doesn't have matching file extensions.

**Why they matter:** an active LSP gives Claude **real type information
** from your installed dependencies — function signatures, references, type definitions, completions — instead of inferring from source code. This is what stops Claude from hallucinating method names on third-party libraries or guessing the shape of a return type. Any skill that touches code (
`code-review-deep`, `run-linters`, `work-issue`, `write-tests`,
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
