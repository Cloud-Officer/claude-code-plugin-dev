---
name: vercel
description: Manage Vercel deployments, projects, or infrastructure. Use when the user wants to check a deployment, view build logs, list projects, manage domains, manage environment variables, check edge functions, view analytics, check speed insights, promote a deployment, manage teams, or search Vercel documentation.
allowed-tools: Bash(vercel:*), Bash(curl:*), Bash(jq:*), Bash(echo:*), mcp__vercel__*
---

# Vercel

Manage Vercel deployments and projects.

## MCP Tools with Fallbacks

**Prefer MCP tools** (`mcp__vercel__*`) when available. If MCP tools are not available (tool not found errors), **fall back to the `vercel` CLI**.

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| List deployments | `mcp__vercel__list_deployments` | `vercel ls` |
| Get deployment status | `mcp__vercel__get_deployment` | `vercel inspect <url>` |
| View build logs | `mcp__vercel__get_deployment_logs` | `vercel logs <url>` |
| List projects | `mcp__vercel__list_projects` | `vercel project ls` |
| Search docs | `mcp__vercel__search_docs` | N/A (no CLI equivalent) |
| List domains | `mcp__vercel__list_domains` | `vercel domains ls` |
| Promote deployment | `mcp__vercel__promote_deployment` | `vercel promote <url>` |

**Note:** The `vercel` CLI requires authentication via `vercel login`. If neither the MCP nor CLI is available, inform the user and stop.

## Usage

1. **Understand the request** — What does the user want? (check status, view logs, list projects)
2. **Execute** — Use MCP tools (preferred) or CLI fallback
3. **Present results** — Format deployment info clearly with status, URL, timestamps

## Important Rules

- **Never promote or redeploy without user confirmation**
- **Show deployment URL** when presenting results
- **For failed deployments** — Show relevant log lines to help diagnose the issue
