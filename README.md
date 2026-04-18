# claude-code-plugin-dev [![Build](https://github.com/Cloud-Officer/claude-code-plugin-dev/actions/workflows/build.yml/badge.svg)](https://github.com/Cloud-Officer/claude-code-plugin-dev/actions/workflows/build.yml)

Claude Code plugin for development workflow automation.

## Table of Contents

* [Introduction](#introduction)
* [Installation](#installation)
* [Usage](#usage)
  * [Commands](#commands)
  * [Skills](#skills)
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

### Prerequisites

#### GitHub Integration

This plugin includes a bundled [GitHub MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/github) for structured GitHub access. Skills that interact with GitHub (issues, PRs, repo metadata) will prefer MCP tools when available and automatically fall back to the [`gh` CLI](https://cli.github.com/) if the MCP server is unavailable.

| Method | Requirement | Setup |
| --- | --- | --- |
| GitHub MCP (preferred) | `GITHUB_PERSONAL_ACCESS_TOKEN` env var | [Create a PAT](https://github.com/settings/tokens) with `repo` scope and export it |
| `gh` CLI (fallback) | [GitHub CLI](https://cli.github.com/) | `gh auth login` |

**Note:** At least one method must be configured for GitHub-dependent skills to work (`create-issue`, `review-readme`, `review-architecture`, `review-user-guide`, `work-issue`, `code-review-deep`).

#### Web Fetch

This plugin includes a bundled [Fetch MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/fetch) that lets skills retrieve and read web page content. It converts HTML to markdown for easier analysis. Used by documentation review skills (`review-readme`, `review-architecture`, `review-user-guide`) to verify external links and references.

| Requirement | Setup |
| --- | --- |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | `curl -LsSf https://astral.sh/uv/install.sh \| sh` or `brew install uv` |

**Note:** No additional configuration needed. The fetch server runs automatically via `uvx` when the plugin is enabled.

#### Library Documentation (Context7)

This plugin includes a bundled [Context7 MCP server](https://github.com/upstash/context7) that provides up-to-date, version-specific documentation for libraries and frameworks. Used by documentation review skills (`review-readme`, `review-architecture`, `review-user-guide`) and `code-review-deep` to verify API usage and best practices against current library docs.

**Note:** No configuration needed. The Context7 server runs automatically via `npx` when the plugin is enabled.

#### Jira Integration (optional)

Skills that interact with Jira (issues, sprints, transitions) will prefer the Atlassian MCP when available and automatically fall back to the [`jira` CLI](https://github.com/ankitpokhrel/jira-cli).

| Method | Requirement | Setup |
| --- | --- | --- |
| Atlassian MCP (preferred) | Atlassian Cloud account | See [Remote MCP Servers](#remote-mcp-servers-optional) below |
| `jira` CLI (fallback) | [Jira CLI](https://github.com/ankitpokhrel/jira-cli) | `jira init` |

**Note:** At least one method must be configured for Jira-dependent skills to work (`create-issue`, `work-issue`, `sprint-summary`).

#### AWS Integration (optional)

This plugin includes a bundled [AWS MCP server](https://docs.aws.amazon.com/aws-mcp/latest/userguide/what-is-mcp-server.html) for managing AWS infrastructure, searching documentation, and executing AWS API calls.

| Requirement | Setup |
| --- | --- |
| AWS account + [uv](https://docs.astral.sh/uv/getting-started/installation/) | Configure AWS credentials via `aws configure` and set `AWS_PROFILE` to select the profile, or use env vars (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) |

#### Google Cloud Integration (optional)

This plugin includes a bundled [gcloud MCP server](https://github.com/googleapis/gcloud-mcp) for managing all Google Cloud services (Compute Engine, Cloud Run, Cloud SQL, GKE, Cloud Storage, IAM, Pub/Sub, etc.). The `gcloud` skill provides general GCP management, while `crashlytics`, `query-db`, and `analyze-db` skills use BigQuery with `bq` CLI fallback.

| Method | Requirement | Setup |
| --- | --- | --- |
| gcloud MCP (preferred) | [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) | `gcloud auth login && gcloud config set project <project-id>`. Set `CLOUDSDK_ACTIVE_CONFIG_NAME` to select a named configuration |
| `gcloud` CLI (fallback) | Same | Same |
| BigQuery MCP | GCP auth | See [Remote MCP Servers](#remote-mcp-servers-optional) below |
| `bq` CLI (fallback) | Same | `gcloud auth application-default login` |

#### App Store Connect Integration (optional)

This plugin includes a bundled [asc-mcp](https://github.com/zelentsov-dev/asc-mcp) server for managing iOS/macOS apps on App Store Connect — builds, TestFlight, customer reviews, in-app purchases, and subscriptions. Provides ~60 tools (apps, builds, versions, reviews, beta groups, IAPs).

**Prerequisites:**

1. Install [Mint](https://github.com/yonaskolb/Mint) (Swift package manager) and add it to your PATH:

   ```bash
   brew install mint
   ```

   Add `~/.mint/bin` to your PATH in `~/.zshrc` (Mint installs binaries there):

   ```bash
   export PATH="$HOME/.mint/bin:$PATH"
   ```

2. Install asc-mcp:

   ```bash
   mint install zelentsov-dev/asc-mcp
   ```

3. Create an App Store Connect API key:
   * Go to [App Store Connect > Users and Access > Integrations > App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
   * Generate a new key and download the `.p8` file

4. Set environment variables:

   ```bash
   export ASC_KEY_ID="your-key-id"
   export ASC_ISSUER_ID="your-issuer-id"
   export ASC_PRIVATE_KEY_PATH="/path/to/AuthKey_XXXXXXXX.p8"
   ```

**Note:** If `asc-mcp` is not installed, this MCP server will silently fail and other tools remain unaffected.

#### Google Play Reviews Integration (optional)

This plugin includes a bundled [GPlay Reviews MCP server](https://github.com/Kirill812/GPlay_reviews_MCP_server) for fetching and analyzing Google Play Store reviews — filter by rating, date, language, and device, and post or update replies.

**Prerequisites:**

1. Create a Google Cloud service account:
   * Go to [Google Cloud Console > IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
   * Create a service account and download the JSON credentials file
   * Enable the [Google Play Developer API](https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com)
   * Grant the service account access in [Google Play Console > Users and permissions](https://play.google.com/console/developers)

2. Set environment variables:

   ```bash
   export GOOGLE_PLAY_CREDENTIALS_PATH="/path/to/service-account.json"
   ```

**Note:** If credentials are not configured, this MCP server will silently fail and other tools remain unaffected.

#### Remote MCP Servers (optional)

Claude Code plugins can only bundle local (stdio) MCP servers. The following remote MCP servers use OAuth authentication and must be added by the user. Run these commands once to configure them:

```bash
# Design
claude mcp add figma --transport http https://mcp.figma.com/mcp

# Project management
claude mcp add atlassian --transport http https://mcp.atlassian.com/v1/mcp

# Deployment
claude mcp add vercel --transport http https://mcp.vercel.com

# Payments
claude mcp add stripe --transport http https://mcp.stripe.com
claude mcp add paypal --transport http https://mcp.paypal.com/http

# Observability
claude mcp add newrelic --transport http https://mcp.newrelic.com/mcp/

# Google Cloud (BigQuery)
claude mcp add bigquery --transport http https://bigquery.googleapis.com/mcp
```

Each server will prompt for OAuth authentication on first use. Only add the servers you need — skills will fall back to CLI tools if a remote MCP server is unavailable.

#### Database Integration (optional)

This plugin includes bundled MCP servers for [PostgreSQL](https://www.npmjs.com/package/@modelcontextprotocol/server-postgres), [MySQL](https://github.com/benborla/mcp-server-mysql), [MongoDB](https://www.mongodb.com/docs/mcp-server/), and [Redis](https://redis.io/docs/latest/integrate/redis-mcp/). The `query-db` and `analyze-db` skills will prefer MCP tools when available and fall back to CLI clients if the MCP servers are unavailable.

| Database | MCP Server | Env Vars (set in your shell) | CLI Fallback |
| --- | --- | --- | --- |
| PostgreSQL | `@modelcontextprotocol/server-postgres` | `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | `psql` |
| MySQL | `@benborla/mcp-server-mysql` | `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | `mysql` |
| MongoDB | `mongodb-mcp-server` | `MDB_MCP_CONNECTION_STRING` | `mongosh` |
| Redis | `redis-mcp-server` | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PWD` or `REDIS_URL` | `redis-cli` |

**Note:** MCP servers inherit connection env vars from your shell — no credentials are stored in the plugin. BigQuery has a remote MCP server (see [Remote MCP Servers](#remote-mcp-servers-optional) above). SQLite and Elasticsearch have no MCP servers and always use CLI (`sqlite3`, `curl`). For SQLite, set `SQLITE_DB` to the path of your database file.

#### Other Prerequisites

Some skills require additional CLI tools:

| Skill | Requires | Setup |
| --- | --- | --- |
| `crashlytics` | [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`bq` CLI) | `gcloud auth application-default login` and set `BQ_*` env vars |
| `query-db` / `analyze-db` | BigQuery CLI (`bq`) or Elasticsearch (`curl`) | Install the relevant client and set connection env vars |
| `loco` | `curl`, `jq` | Set `LOCO_API_KEY_*` env vars |
| `vercel` (fallback) | [Vercel CLI](https://vercel.com/docs/cli) | `npm i -g vercel && vercel login` |
| `stripe` (fallback) | [Stripe CLI](https://docs.stripe.com/stripe-cli) | `brew install stripe/stripe-cli/stripe && stripe login` |
| `aws` (fallback) | [AWS CLI](https://aws.amazon.com/cli/) | `aws configure` |
| `gcloud` (fallback) | [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) | `gcloud auth login` |
| `newrelic` (fallback) | [New Relic CLI](https://github.com/newrelic/newrelic-cli) | `brew install newrelic-cli && newrelic profile add` |
| `heroku` (fallback) | [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) | `brew install heroku && heroku login` |

```bash
/plugin marketplace add cloud-officer/claude-code-plugin-dev
/plugin install co-dev@cloud-officer
```

#### Recommended Permissions

This plugin bundles several MCP servers. By default, Claude Code will prompt for permission each time an MCP tool is called. To auto-approve these tools, add the following entries to the `permissions.allow` array in your `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__appstore__*",
      "mcp__aws__*",
      "mcp__context7__*",
      "mcp__fetch__*",
      "mcp__gcloud__*",
      "mcp__github__*",
      "mcp__mongodb__*",
      "mcp__mysql__*",
      "mcp__playstore__*",
      "mcp__postgres__*",
      "mcp__redis__*"
    ]
  }
}
```

If you also use remote MCP servers (see [Remote MCP Servers](#remote-mcp-servers-optional)), add their patterns too:

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

**Note:** These entries merge with your existing `allow` list — you don't need to replace it. Only add entries for the MCP servers you actually use.

## Usage

### Commands

| Command                         | Description                                            |
| ------------------------------- | ------------------------------------------------------ |
| `/co-dev:work-issue <issue-id>` | Work on a GitHub or Jira issue (bug, feature, or task) |
| `/co-dev:code-review-deep`      | Deep code review using parallel agent strategy         |

### Skills

These skills are automatically available to Claude:

| Skill                 | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| `analyze-db`          | Generate docs/DB.md with database schema docs                |
| `appstore`            | Manage App Store Connect (builds, TestFlight, reviews, IAPs) |
| `aws`                 | Manage AWS infrastructure and services                       |
| `create-issue`        | Create GitHub or Jira issues with proper templates           |
| `create-pr`           | Generate commit message, PR title, and PR body               |
| `crashlytics`         | Query Firebase Crashlytics crash data from BigQuery          |
| `gcloud`              | Manage Google Cloud infrastructure and services              |
| `heroku`              | Manage Heroku apps, dynos, logs, and databases               |
| `loco`                | Manage Loco translation assets (create, delete, scan)        |
| `newrelic`            | Query New Relic observability data, alerts, and logs         |
| `paypal`              | Manage PayPal invoices, payments, and disputes               |
| `playstore`           | Fetch, analyze, and respond to Google Play reviews           |
| `query-db`            | Query databases using natural language via CLI               |
| `review-architecture` | Review or create docs/architecture.md                        |
| `review-design`       | Compare UI code against Figma designs (Android, iOS, web)    |
| `review-readme`       | Review or create README.md to match standards                |
| `review-user-guide`   | Review or create docs/user-guide.md with user documentation  |
| `run-linters`         | Run linters and fix any issues found                         |
| `sprint-summary`      | Summarize sprint items grouped by repo in ~3-day blocks      |
| `stripe`              | Manage Stripe payments, customers, and subscriptions         |
| `vercel`              | Manage Vercel deployments and projects                       |

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

When you submit code changes, your submissions are understood to be under the same [License](LICENSE) that covers the
project. Feel free to contact the maintainers if that's a concern.
