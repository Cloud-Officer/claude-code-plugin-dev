---
name: playstore
description: Fetch, filter, or analyze Google Play Store reviews, or post replies. Use when the user wants to check Google Play reviews, filter reviews by rating or date, analyze review sentiment, respond to reviews, or get review analytics for an Android app.
allowed-tools: Bash(echo:*), Bash(jq:*), mcp__playstore__*
---

# Google Play Store Reviews

Fetch, analyze, and respond to Google Play Store reviews.

## MCP Tools (no CLI fallback)

Use MCP tools (`mcp__playstore__*`) for all Google Play review operations. **There is no Google Play CLI.** If MCP tools are not available, inform the user and stop.

| Operation | MCP Tool |
| --- | --- |
| Fetch reviews | `mcp__playstore__get_reviews` |
| Filter by rating | `mcp__playstore__get_reviews` (with rating filter) |
| Filter by date | `mcp__playstore__get_reviews` (with date filter) |
| Filter by language | `mcp__playstore__get_reviews` (with language filter) |
| Filter by device | `mcp__playstore__get_reviews` (with device filter) |
| Search by keyword | `mcp__playstore__search_reviews` |
| Post reply | `mcp__playstore__reply_to_review` |
| Update reply | `mcp__playstore__update_reply` |
| Get analytics | `mcp__playstore__get_analytics` |

## Prerequisites

Requires a Google Cloud service account with Google Play Developer API access:

- `GOOGLE_PLAY_CREDENTIALS_PATH` — Path to service account JSON credentials file

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

## Important Rules

- **Never post replies without user confirmation** — Always show the reply text before posting
- **Be professional** — Draft replies that are helpful, empathetic, and constructive
- **MCP required** — This skill cannot function without Google Play MCP access. If unavailable, inform the user.
