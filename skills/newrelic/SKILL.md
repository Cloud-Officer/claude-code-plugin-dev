---
name: newrelic
description: Query New Relic observability data or manage monitoring. Use when the user wants to run NRQL queries, check alerts, view incidents, analyze logs, get golden metrics, inspect entity health, check dashboards, view SLIs/SLOs, track deployments, monitor synthetics, check error rates, view throughput, or query any New Relic data.
allowed-tools: Bash(newrelic:*), Bash(curl:*), Bash(jq:*), Bash(echo:*), mcp__newrelic__*
---

# New Relic

Query observability data, alerts, and application health.

## MCP Tools with Fallbacks

**Prefer MCP tools** (`mcp__newrelic__*`) when available. If MCP tools are not available (tool not found errors), **fall back to the `newrelic` CLI**.

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Run NRQL query | `mcp__newrelic__run_nrql_query` | `newrelic nrql query --query "..."` |
| Natural language to NRQL | `mcp__newrelic__nrql_from_natural_language` | N/A (no CLI equivalent) |
| Get entity by GUID | `mcp__newrelic__get_entity_by_guid` | `newrelic entity get --guid "..."` |
| Search entities | `mcp__newrelic__search_entities` | `newrelic entity search --name "..."` |
| List alert conditions | `mcp__newrelic__list_alert_conditions` | `newrelic alert condition list --policyId ...` |
| Search incidents | `mcp__newrelic__search_incidents` | `newrelic alert incident list` |
| Analyze application logs | `mcp__newrelic__analyze_application_logs` | N/A (use NRQL via CLI) |
| Get golden metrics | `mcp__newrelic__get_golden_metrics` | N/A (use NRQL via CLI) |

**Note:** The `newrelic` CLI requires a User API key via `newrelic profile add --name default --apiKey NRAK-... --accountId ...`. If neither the MCP nor CLI is available, inform the user and stop.

## Usage

1. **Understand the request** — What does the user want? (metrics, alerts, logs, entity health)
2. **Execute** — Use MCP tools (preferred) or CLI fallback
3. **Present results** — Format metrics and alerts clearly with timestamps, values, and thresholds

## Common NRQL Queries

```sql
-- Error rate last hour
SELECT percentage(count(*), WHERE error IS true) FROM Transaction SINCE 1 hour ago

-- Response time percentiles
SELECT percentile(duration, 50, 95, 99) FROM Transaction SINCE 1 hour ago

-- Top errors
SELECT count(*) FROM TransactionError FACET error.message SINCE 1 day ago LIMIT 10

-- Deployment markers
SELECT * FROM Deployment SINCE 1 week ago
```

## Important Rules

- **Read-only by default** — Only query data, never modify alert policies or configurations without user confirmation
- **Time ranges** — Always include `SINCE` in NRQL queries to scope results
- **Entity context** — When the user asks about "the app", search for the entity first to get the GUID
