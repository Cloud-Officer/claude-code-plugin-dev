---
name: appstore
description: Manage App Store Connect apps, builds, or distribution. Use when the user wants to check builds, manage TestFlight beta groups and testers, read or respond to App Store reviews, manage in-app purchases, subscriptions, pricing, list app versions, check app status, manage certificates, provisioning profiles, screenshots, app metadata, or perform any App Store Connect operation.
allowed-tools: Bash(echo:*), Bash(jq:*), mcp__appstore__*
---

# App Store Connect

Manage iOS/macOS apps on App Store Connect.

## MCP Tools (no CLI fallback)

Use MCP tools (`mcp__appstore__*`) for all App Store Connect operations. **There is no separate CLI.** The `asc-mcp` binary IS the MCP server. If MCP tools are not available, inform the user and stop.

The MCP server provides ~60 tools across these categories:

| Category | Operations |
| --- | --- |
| Apps | List apps, get app info, get app availability |
| Versions | List versions, get version details, manage version states |
| Builds | List builds, get build details, get build beta details |
| TestFlight | Manage beta groups, beta testers, beta app review submissions |
| Reviews | List customer reviews, get review details, respond to reviews |
| In-App Purchases | List IAPs, get IAP details, manage IAP price schedules |
| Subscriptions | List subscription groups, subscriptions, manage pricing |

## Prerequisites

Requires `asc-mcp` installed via Mint and App Store Connect API credentials:

- `ASC_KEY_ID` — API key ID
- `ASC_ISSUER_ID` — Issuer ID
- `ASC_PRIVATE_KEY_PATH` — Path to `.p8` key file

If these are not set, the MCP server will fail to start.

## Usage

1. **Understand the request** — What does the user want? (check builds, manage TestFlight, read reviews)
2. **Identify the app** — Which app? Use `mcp__appstore__list_apps` if needed.
3. **Execute** — Use MCP tools
4. **Present results** — Format app info clearly with version numbers, build states, and dates

## Important Rules

- **Never submit for review, release, or modify pricing without user confirmation**
- **Review responses** — Always show the response text before posting a reply to a customer review
- **TestFlight** — Confirm before adding/removing testers from beta groups
- **MCP required** — This skill cannot function without App Store Connect MCP access. If unavailable, inform the user.
