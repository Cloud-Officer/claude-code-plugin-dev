---
name: heroku
description: Manage Heroku applications, deployments, or infrastructure. Use when the user wants to check a Heroku app, view logs, scale dynos, restart, manage Postgres databases, view config vars, manage addons, check pipelines, enable maintenance mode, manage domains, view metrics, or check app health.
allowed-tools: Bash(heroku:*), Bash(curl:*), Bash(jq:*), Bash(echo:*)
---

# Heroku

Manage Heroku applications and databases.

## CLI Reference

This skill uses the `heroku` CLI for all operations.

| Operation | Command |
| --- | --- |
| List apps | `heroku apps` |
| Get app info | `heroku apps:info -a <app>` |
| View logs | `heroku logs -a <app> --num 100` |
| Scale dynos | `heroku ps:scale web=N -a <app>` |
| Restart app | `heroku ps:restart -a <app>` |
| List dynos | `heroku ps -a <app>` |
| List addons | `heroku addons -a <app>` |
| Run DB query | `heroku pg:psql -a <app> -c "SQL"` |
| Get DB info | `heroku pg:info -a <app>` |
| List config vars | `heroku config -a <app>` |
| Manage pipelines | `heroku pipelines:info <pipeline>` |
| Maintenance mode | `heroku maintenance:on -a <app>` |
| Manage domains | `heroku domains -a <app>` |

**Note:** The `heroku` CLI requires authentication via `heroku login`. If the CLI is not available, inform the user and stop.

## Usage

1. **Understand the request** — What does the user want? (check status, view logs, scale, DB operations)
2. **Identify the app** — Which Heroku app? Ask if ambiguous.
3. **Execute** — Use the `heroku` CLI
4. **Present results** — Format app info clearly with status, dyno counts, and URLs

## Important Rules

- **Never scale, restart, or modify config without user confirmation**
- **Mask config vars** — Config vars may contain secrets; do not display values unless explicitly asked
- **Log tail** — When viewing logs, use `--num 100` or similar limit to avoid flooding output
- **Cost awareness** — Warn when scaling up dynos as it affects billing
