---
name: playstore
description: Fetch, filter, or analyze Google Play Store reviews, or post replies. Use when the user wants to check Google Play reviews, filter reviews by rating or date, analyze review sentiment, respond to reviews, or get review analytics for an Android app.
allowed-tools: Bash(echo:*), Bash(jq:*), mcp__playstore__*
---

# Google Play Store Reviews

Fetch, analyze, and respond to Google Play Store reviews.

## MCP Tools (no CLI fallback)

Use MCP tools (`mcp__playstore__*`) for all Google Play operations. **There is no Google Play CLI.** If MCP tools are not available, inform the user and stop.

| Operation | MCP Tool |
| --- | --- |
| List apps in the developer account | `mcp__playstore__list_apps` |
| Get app metadata | `mcp__playstore__get_app_details` |
| Fetch reviews (filter by rating, date, language, device via tool args) | `mcp__playstore__get_reviews` |
| Reply to a review (also updates an existing reply by re-replying) | `mcp__playstore__reply_to_review` |
| Android Vitals overview (crashes, ANRs) | `mcp__playstore__get_vitals_overview` |
| Specific vitals metrics | `mcp__playstore__get_vitals_metrics` |

Keyword search and sentiment analysis are not server-side tools — fetch reviews then filter / classify in the response.

## Prerequisites

Requires a Google Cloud service account with Google Play Developer API access:

- `GOOGLE_APPLICATION_CREDENTIALS` — Path to service account JSON credentials file
- `uv` / `uvx` available on PATH (the server is launched via `uvx play-store-mcp`)

If this is not set, the MCP server will fail to start.

## Usage

1. **Understand the request** — What does the user want? (read reviews, filter, respond, analytics)
2. **Execute** — Use MCP tools
3. **Present results** — Format reviews clearly with rating, date, user, device, and text

## Common Workflows

### Review triage

1. Fetch recent 1-star and 2-star reviews
2. Group by common themes (crashes, bugs, features)
3. Present summary with actionable items

### Respond to reviews

1. Fetch unresponded reviews
2. Draft a response for user approval
3. Post the approved response

### Trend analysis

1. Fetch reviews over a date range
2. Calculate average rating trend
3. Identify sentiment shifts

### App health check

1. `get_vitals_overview` for crash/ANR rate at a glance
2. `get_vitals_metrics` for specific metrics over time
3. Correlate spikes with recent reviews

## Important Rules

- **Never post replies without user confirmation** — Always show the reply text before posting
- **Be professional** — Draft replies that are helpful, empathetic, and constructive
- **MCP required** — This skill cannot function without Google Play MCP access. If unavailable, inform the user.
