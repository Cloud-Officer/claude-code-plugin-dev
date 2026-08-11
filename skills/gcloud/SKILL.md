---
name: gcloud
description: Manage Google Cloud infrastructure, services, or resources. Use when the user wants to manage any GCP service including Compute Engine, Cloud Run, Cloud SQL, GKE, Cloud Storage, IAM, Pub/Sub, Cloud Logging, Cloud Monitoring, Firebase, Artifact Registry, Secret Manager, Cloud Functions, App Engine, Dataflow, BigTable, Spanner, Cloud CDN, Cloud DNS, VPC, Load Balancing, or any other Google Cloud service. Also use for running any gcloud, gsutil, or kubectl command.
allowed-tools: Bash(gcloud:*), Bash(gsutil:*), Bash(kubectl:*), Bash(curl:*), Bash(jq:*), Bash(echo:*), mcp__gcloud__*
---

# Google Cloud

Manage Google Cloud Platform infrastructure and services.

## MCP Tools with Fallbacks

**Prefer MCP tools.** MCP is available exactly when the session's tool list contains a tool named `mcp__gcloud__run_gcloud_command`. If that name is absent from the tool list, or a call to it is rejected by the tool harness before any gcloud output is produced, **fall back to the `gcloud` CLI**.

The `gcloud` MCP server wraps the `gcloud` CLI and provides access to all GCP services through a single entry point.

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Run gcloud command | `mcp__gcloud__run_gcloud_command` | `gcloud <command>` |
| Compute Engine | `mcp__gcloud__run_gcloud_command` | `gcloud compute instances list` |
| Cloud Run | `mcp__gcloud__run_gcloud_command` | `gcloud run services list` |
| Cloud SQL | `mcp__gcloud__run_gcloud_command` | `gcloud sql instances list` |
| GKE | `mcp__gcloud__run_gcloud_command` | `gcloud container clusters list` |
| Cloud Storage | `mcp__gcloud__run_gcloud_command` | `gsutil ls` |
| IAM | `mcp__gcloud__run_gcloud_command` | `gcloud iam service-accounts list` |
| Pub/Sub | `mcp__gcloud__run_gcloud_command` | `gcloud pubsub topics list` |

**Common CLI examples:**

```bash
# Compute Engine
gcloud compute instances list --format=json
gcloud compute instances describe <instance> --zone=<zone> --format=json

# Cloud Run
gcloud run services list --format=json
gcloud run services describe <service> --region=<region> --format=json
gcloud run services logs read <service> --region=<region> --limit=50

# Cloud SQL
gcloud sql instances list --format=json
gcloud sql databases list --instance=<instance> --format=json

# GKE
gcloud container clusters list --format=json
kubectl get pods --all-namespaces

# Cloud Storage
gsutil ls
gsutil ls gs://<bucket>/
gsutil du -s gs://<bucket>/

# IAM
gcloud iam service-accounts list --format=json
gcloud projects get-iam-policy <project> --format=json

# Pub/Sub
gcloud pubsub topics list --format=json
gcloud pubsub subscriptions list --format=json

# Logs
gcloud logging read "resource.type=cloud_run_revision" --limit=50 --format=json

# Project info
gcloud config get-value project
gcloud projects describe <project> --format=json
```

**Note:** The `gcloud` CLI requires authentication via `gcloud auth login` and a configured project via `gcloud config set project <project-id>`. Set `CLOUDSDK_ACTIVE_CONFIG_NAME` to select a specific named configuration (e.g., `export CLOUDSDK_ACTIVE_CONFIG_NAME=production`). Each configuration stores its own account, project, and region. Both the MCP server and CLI respect this variable. If neither the MCP nor CLI is available, inform the user and stop.

## Usage

1. **Understand the request** — What service and operation? (Compute, Cloud Run, Cloud SQL, GKE, etc.)
2. **Execute** — Use MCP tools (preferred) or CLI fallback
3. **Present results** — Format resource info clearly with IDs, statuses, regions, and project

## Important Rules

- **Never create, modify, or delete resources without user confirmation**
- **Cost awareness** — Warn before operations that incur costs (launching instances, creating resources)
- **Region/zone awareness** — Always specify or confirm the region/zone
- **Use `--format=json`** — Prefer JSON output for structured parsing, pipe to `jq` for filtering
- **Project awareness** — Confirm which GCP project is active before running commands
