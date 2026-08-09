---
name: aws
description: Manage AWS infrastructure, services, or resources. Use when the user wants to manage any AWS service including EC2, S3, Lambda, RDS, DynamoDB, ECS, EKS, IAM, CloudWatch, CloudFront, Route53, SQS, SNS, API Gateway, CloudFormation, Secrets Manager, VPC, ELB, or any other AWS service. Also use for searching AWS documentation, checking costs, or running any AWS CLI command.
allowed-tools: Bash(aws:*), Bash(curl:*), Bash(jq:*), Bash(echo:*), mcp__aws__*
---

# AWS

Manage AWS infrastructure and services.

## MCP Tools with Fallbacks

**Prefer MCP tools** (`mcp__aws__*`) when available. If MCP tools are not available (tool not found errors), **fall back to the `aws` CLI**.

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Search documentation | `mcp__aws__aws___search_documentation` | N/A (no CLI equivalent) |
| Read documentation page | `mcp__aws__aws___read_documentation` | N/A |
| Execute API call | `mcp__aws__aws___call_aws` | `aws <service> <command>` |
| List resources | `mcp__aws__aws___call_aws` | `aws <service> list-*` / `aws <service> describe-*` |
| List regions | `mcp__aws__aws___list_regions` | `aws ec2 describe-regions` |
| Regional availability | `mcp__aws__aws___get_regional_availability` | N/A |

The AWS MCP server provides access to 15,000+ AWS APIs. The `aws` CLI provides equivalent access for all services.

**Common CLI examples:**

```bash
# EC2
aws ec2 describe-instances --query 'Reservations[].Instances[].{ID:InstanceId,State:State.Name,Type:InstanceType}'
# S3
aws s3 ls
aws s3 ls s3://bucket-name/
# Lambda
aws lambda list-functions --query 'Functions[].FunctionName'
# CloudWatch (BSD/GNU date — works on macOS and Linux)
START_TS="$(date -u -v-1H +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)"
aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name CPUUtilization --period 3600 --statistics Average --start-time "$START_TS" --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)"
# RDS
aws rds describe-db-instances --query 'DBInstances[].{ID:DBInstanceIdentifier,Status:DBInstanceStatus,Engine:Engine}'
```

**Note:** The `aws` CLI requires credentials via `aws configure` or env vars (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`). Set `AWS_PROFILE` to select a specific named profile (e.g., `export AWS_PROFILE=production`). Both the MCP server and CLI respect this variable. If neither the MCP nor CLI is available, inform the user and stop.

## Usage

1. **Understand the request** — What service and operation? (EC2, S3, Lambda, RDS, etc.)
2. **Execute** — Use MCP tools (preferred) or CLI fallback
3. **Present results** — Format resource info clearly with IDs, statuses, and regions

## Important Rules

- **Never create, modify, or delete resources without user confirmation**
- **Cost awareness** — Warn before operations that incur costs (launching instances, creating resources)
- **Region awareness** — Always specify or confirm the AWS region
- **Use `--query` with CLI** — Filter output with JMESPath to avoid overwhelming results
