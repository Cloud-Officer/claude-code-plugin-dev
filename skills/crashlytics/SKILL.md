---
name: crashlytics
description: Query, list, analyze, or investigate Firebase Crashlytics crash data. Use when the user wants to check crashes, list top crashes, investigate a crash, get stack traces, view crash trends, analyze crash data, or find crash issues. Queries Crashlytics data exported to BigQuery via the bq CLI. Supports Android, iOS, and tvOS.
allowed-tools: Bash(bq:*), Read, Grep, Glob, Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(mkdir:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*)
---

## Purpose

Query Firebase Crashlytics crash data exported to BigQuery. List top crashes, investigate specific issues, retrieve stack traces, and help identify fixes. Supports Android, iOS, and tvOS platforms.

## Environment Variables

This skill requires the following environment variables:

- `BQ_PROJECT` — GCP project ID
- `BQ_CRASHLYTICS_DATASET` — BigQuery dataset name (e.g., `firebase_crashlytics`)
- `BQ_CRASHLYTICS_ANDROID_TABLE` — Android REALTIME table name
- `BQ_CRASHLYTICS_IOS_TABLE` — iOS REALTIME table name
- `BQ_CRASHLYTICS_TVOS_TABLE` — tvOS REALTIME table name

## Steps

### 1. Validate environment

Check that required environment variables are set:

```bash
echo "BQ_PROJECT=$BQ_PROJECT"
echo "BQ_CRASHLYTICS_DATASET=$BQ_CRASHLYTICS_DATASET"
echo "BQ_CRASHLYTICS_ANDROID_TABLE=$BQ_CRASHLYTICS_ANDROID_TABLE"
echo "BQ_CRASHLYTICS_IOS_TABLE=$BQ_CRASHLYTICS_IOS_TABLE"
echo "BQ_CRASHLYTICS_TVOS_TABLE=$BQ_CRASHLYTICS_TVOS_TABLE"
```

If any required variable is missing, tell the user which variables need to be set and stop.

### 2. Verify BigQuery connectivity

```bash
bq query --use_legacy_sql=false --project_id="$BQ_PROJECT" "SELECT 1"
```

If this fails, tell the user to run `gcloud auth application-default login` and `gcloud auth application-default set-quota-project $BQ_PROJECT`.

### 3. Determine platform and query parameters

Parse the user's request to determine:

- **Platform**: Android, iOS, tvOS, or all. Default to **all** if not specified.
- **Time range**: Default to last **7 days** if not specified.
- **Query type**: Top crashes, specific issue details, stack trace, trend, etc.

Map platform to table environment variable:

| Platform | Table Variable                  |
| -------- | ------------------------------- |
| Android  | `$BQ_CRASHLYTICS_ANDROID_TABLE` |
| iOS      | `$BQ_CRASHLYTICS_IOS_TABLE`     |
| tvOS     | `$BQ_CRASHLYTICS_TVOS_TABLE`    |

The fully qualified table name is: `` `$BQ_PROJECT.$BQ_CRASHLYTICS_DATASET.$TABLE_NAME` ``

### 4. Show the query before executing

**NEVER execute a query without showing it to the user first.** Display the query in a code block and briefly explain what it does.

### 5. Execute the query

Use `bq query` with `--use_legacy_sql=false` and `--project_id="$BQ_PROJECT"`.

Always add `--max_rows=100` to prevent huge outputs unless the user asks for more.

### 6. Present results

- Format output as a clear table or summary
- Highlight the top crashes by count and affected users
- Include issue ID, title, subtitle, crash count, affected users, and last seen
- When showing results for multiple platforms, clearly label each platform

### 7. Deep dive (when requested)

If the user asks about a specific crash issue, fetch detailed information:

```sql
SELECT
  issue_id,
  issue_title,
  issue_subtitle,
  blame_frame.file AS blame_file,
  blame_frame.line AS blame_line,
  blame_frame.symbol AS blame_symbol,
  event_timestamp,
  application.display_version AS app_version,
  application.build_version AS build_version,
  device.model AS device_model,
  device.os_version AS os_version,
  threads
FROM `PROJECT.DATASET.TABLE`
WHERE issue_id = 'ISSUE_ID'
ORDER BY event_timestamp DESC
LIMIT 5
```

When presenting deep dive results:

- Show the blame frame (file, line, symbol) prominently
- Show the full stack trace if the user asks for it
- Show affected app versions and devices
- If the blame frame file maps to a file in the current repo, use Glob/Grep to locate it and show the relevant code

### 8. Locate source code (optional)

If a crash blame frame references a file in the current codebase:

1. Use `Glob` to find the file by name
2. Use `Read` to show the code around the blamed line
3. Suggest a potential fix if the cause is apparent

## Common Queries

### Top crashes (last N days)

```sql
SELECT
  issue_id,
  issue_title,
  issue_subtitle,
  COUNT(*) AS crash_count,
  COUNT(DISTINCT installation_uuid) AS affected_users,
  MAX(event_timestamp) AS last_seen,
  ANY_VALUE(application.display_version) AS latest_version
FROM `PROJECT.DATASET.TABLE`
WHERE event_timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL N DAY)
GROUP BY issue_id, issue_title, issue_subtitle
ORDER BY crash_count DESC
LIMIT 20
```

### Crash trend for a specific issue

```sql
SELECT
  DATE(event_timestamp) AS day,
  COUNT(*) AS crash_count,
  COUNT(DISTINCT installation_uuid) AS affected_users
FROM `PROJECT.DATASET.TABLE`
WHERE issue_id = 'ISSUE_ID'
  AND event_timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY day
ORDER BY day DESC
```

### Crashes by app version

```sql
SELECT
  application.display_version AS app_version,
  COUNT(*) AS crash_count,
  COUNT(DISTINCT installation_uuid) AS affected_users
FROM `PROJECT.DATASET.TABLE`
WHERE event_timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY app_version
ORDER BY crash_count DESC
LIMIT 20
```

### Crashes by device/OS

```sql
SELECT
  device.model AS device_model,
  device.os_version AS os_version,
  COUNT(*) AS crash_count
FROM `PROJECT.DATASET.TABLE`
WHERE event_timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY device_model, os_version
ORDER BY crash_count DESC
LIMIT 20
```

### New crashes (not seen before a date)

```sql
SELECT
  issue_id,
  issue_title,
  issue_subtitle,
  COUNT(*) AS crash_count,
  COUNT(DISTINCT installation_uuid) AS affected_users,
  MIN(event_timestamp) AS first_seen,
  MAX(event_timestamp) AS last_seen
FROM `PROJECT.DATASET.TABLE`
WHERE event_timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY issue_id, issue_title, issue_subtitle
HAVING first_seen > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
ORDER BY crash_count DESC
LIMIT 20
```

## Rules

- **Read-only**: BigQuery Crashlytics tables are read-only. No write operations.
- **Always show query first**: Display every query before executing it.
- **Default to 7 days**: Use a 7-day window unless the user specifies otherwise.
- **Default to all platforms**: Query all platforms unless the user specifies one.
- **Limit results**: Always use LIMIT (default 20) to prevent excessive output.
- **Label platforms**: When querying multiple platforms, clearly label which results belong to which platform.
- **Suggest next steps**: After showing crashes, suggest investigating specific issues, creating Jira tickets (`/create-issue`), or attempting a fix if the code is in the current repo.
