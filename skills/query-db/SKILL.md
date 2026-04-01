---
name: query-db
description: Query the database, run a query, look up data, search the database, or check data. Use when the user wants to query the database, run a SQL query, look up data, find data, search for records, check the database, or ask questions about data. Executes queries via CLI commands using natural language. Reads schema context from docs/DB.md. Supports MySQL, PostgreSQL, MongoDB, Elasticsearch, Redis, and BigQuery.
allowed-tools: Read, Bash(mysql:*), Bash(psql:*), Bash(mongosh:*), Bash(redis-cli:*), Bash(bq:*), Bash(curl:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(mkdir:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*)
---

## Purpose

Answer questions about data by generating and running queries against the database using CLI commands. Works for developers, analysts, and anyone who needs to query the database.

## Environment Variables

This skill assumes database connection environment variables are already set:

### MySQL

- `MYSQL_HOST` - Database host
- `MYSQL_PORT` - Database port
- `MYSQL_USER` - Database user
- `MYSQL_PASS` - Database password
- `MYSQL_DB` - Database name

### PostgreSQL

- `PGHOST` - Database host
- `PGPORT` - Database port
- `PGUSER` - Database user
- `PGPASSWORD` - Database password
- `PGDATABASE` - Database name

### MongoDB

- `MONGODB_URI` - Full connection URI (e.g., `mongodb://localhost:27017/dbname`)

### Elasticsearch

- `ES_URL` - Elasticsearch URL (e.g., `http://localhost:9200`)
- `ES_API_KEY` - Optional API key for authentication

### Redis

- `REDIS_URL` - Redis connection URL (e.g., `redis://localhost:6379`)

### BigQuery

- `BQ_PROJECT` - GCP project ID
- `BQ_DATASETS` - Comma-separated list of BigQuery datasets (e.g., `archive_2023,archive_2024,archive_2025`)

## CLI Command Reference

Use these exact command formats:

### MySQL

```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --password="$MYSQL_PASS" "$MYSQL_DB" -e "SQL_QUERY"
```

**Useful flags:**

- `-e "query"` - Execute query and exit
- `-N` - Skip column names (headers)
- `-B` - Batch mode (tab-separated, no grid lines)
- `--table` - Force table output format

### PostgreSQL

```bash
psql -c "SQL_QUERY"
```

**Useful flags:**

- `-c "query"` - Execute query and exit
- `-t` - Tuples only (no headers or footers)
- `-A` - Unaligned output (no padding)
- `-F ","` - Set field separator (e.g., for CSV)

### MongoDB

```bash
mongosh "$MONGODB_URI" --eval "JS_CODE"
```

**Useful flags:**

- `--eval "code"` - Execute JavaScript and exit
- `--quiet` - Suppress connection messages
- `--json` - Output in JSON format

### Elasticsearch

```bash
curl -s "$ES_URL/index/_search" -H "Content-Type: application/json" -d 'JSON_QUERY'
```

**Useful flags:**

- `-s` - Silent mode (no progress)
- Pipe to `| jq` for formatted JSON output

### Redis

```bash
redis-cli -u "$REDIS_URL" COMMAND
```

**Useful flags:**

- `-u URL` - Connect using URL
- `--no-raw` - Force formatted output

### BigQuery

```bash
bq query --use_legacy_sql=false --format=prettyjson --project_id="$BQ_PROJECT" "STANDARD_SQL_QUERY"
```

**Useful flags:**

- `--use_legacy_sql=false` - Use Standard SQL (always use this)
- `--format=prettyjson` - JSON output (also: `csv`, `pretty`, `sparse`)
- `--max_rows=1000` - Limit displayed rows
- `--dry_run` - Estimate bytes scanned without running (use for cost estimation)
- `--project_id` - Target GCP project

## Steps

### 1. Check for database context file

Check if `docs/DB.md` exists in the project root.

**If the file does not exist:**

- Tell the user: "No database context found. Run `/analyze-db` first to generate `docs/DB.md`."
- Stop here.

**If the file exists:**

- Read it and continue to step 2.

### 2. Load database context

Read `docs/DB.md` to understand:

- Which database type(s) and CLI command(s) to use
- Schema/collection/index structures
- Field meanings, enums, and status codes
- Date/time and money field handling
- Key patterns (for Redis)

### 3. Verify database connectivity

Look for the "CLI Command" section in `docs/DB.md`. It specifies the command to use for queries.

**How to check:
** Run a simple connectivity test using the CLI tool. If it fails, ask the user to set the required environment variables.

**Connectivity Tests:**

| Database      | Test Command                                                                                                  |
|---------------|---------------------------------------------------------------------------------------------------------------|
| MySQL         | `mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --password="$MYSQL_PASS" "$MYSQL_DB" -e "SELECT 1"` |
| PostgreSQL    | `psql -c "SELECT 1"`                                                                                          |
| MongoDB       | `mongosh "$MONGODB_URI" --eval "db.runCommand({ping: 1})"`                                                    |
| Elasticsearch | `curl -s "$ES_URL/_cluster/health"`                                                                           |
| Redis         | `redis-cli -u "$REDIS_URL" PING`                                                                              |

**If connection fails:** Output the required environment variables and ask the user to configure them before proceeding.

### 4. Identify the target database

From `docs/DB.md`, determine which CLI command to use:

| Database      | CLI Command | Query Language                    |
|---------------|-------------|-----------------------------------|
| MySQL         | `mysql`     | SQL                               |
| PostgreSQL    | `psql`      | SQL                               |
| MongoDB       | `mongosh`   | JavaScript / Aggregation pipeline |
| Elasticsearch | `curl`      | Elasticsearch DSL (JSON)          |
| Redis         | `redis-cli` | Redis commands                    |
| BigQuery      | `bq`        | Standard SQL                      |

### 4b. Prefer MySQL MCP over CLI (when available)

If the target database is **MySQL**, check whether a MySQL MCP tool is available (e.g., `mcp__mysql-bi__mysql_query` or similar `mcp__*__mysql_query` tool).

**If a MySQL MCP tool is available — use it instead of the CLI.** Benefits:

- **Write operations blocked at server level** — no need to scan for write keywords
- **Built-in query timeout** (typically 30s) — no need to prepend `SET SESSION MAX_EXECUTION_TIME`
- **Connection pooling and rate limiting** — safer for production databases
- **Structured output** — cleaner results without CLI formatting quirks

Generate a plain SQL query (no CLI wrapper needed) and execute it via the MCP tool. The Safety Guardrails (Automatic LIMIT Injection, showing the query first) still apply.

**If no MySQL MCP tool is available — fall back to the CLI** approach described in Step 6.

### 4c. Multi-dataset queries for BigQuery

If the target database is **BigQuery** and the user's question spans multiple years or datasets:

1. Parse `$BQ_DATASETS` (comma-separated) to get the list of available datasets
2. Identify which datasets are relevant to the query's date range
3. Generate a `UNION ALL` query across the relevant datasets:

```sql
SELECT * FROM `project.archive_2023.orders` WHERE created_at >= '2023-01-01'
UNION ALL
SELECT * FROM `project.archive_2024.orders` WHERE created_at >= '2024-01-01'
UNION ALL
SELECT * FROM `project.archive_2025.orders`
```

**Important:**

- Always use backtick-quoted fully-qualified table names: `` `project.dataset.table` ``
- Only include datasets relevant to the requested time range — do not query all datasets if the user asks about a single year
- If the user doesn't specify a time range, ask which years to include before running a cross-dataset query

### 5. Understand the question

Parse what the user is asking for:

- What metrics? (counts, sums, averages, cardinality)
- What dimensions? (time periods, categories, segments)
- What filters? (date ranges, statuses, specific entities)

### 6. Generate the appropriate query

#### For MySQL

```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --password="$MYSQL_PASS" "$MYSQL_DB" -e "
SELECT DATE(created_at) as day, COUNT(*) as orders, SUM(total)/100 as revenue
FROM orders
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY day DESC
LIMIT 100;"
```

#### For PostgreSQL

```bash
psql -c "
SELECT DATE(created_at) as day, COUNT(*) as orders, SUM(total)/100 as revenue
FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day DESC
LIMIT 100;"
```

#### For MongoDB

```bash
mongosh "$MONGODB_URI" --eval "db.orders.aggregate([
  { \$match: { createdAt: { \$gte: new Date(Date.now() - 30*24*60*60*1000) } } },
  { \$group: {
      _id: { \$dateToString: { format: '%Y-%m-%d', date: '\$createdAt' } },
      total: { \$sum: '\$total' },
      count: { \$sum: 1 }
  }},
  { \$sort: { _id: -1 } },
  { \$limit: 100 }
])"
```

#### For Elasticsearch

```bash
curl -s "$ES_URL/orders/_search" -H "Content-Type: application/json" -d '{
  "size": 0,
  "query": {
    "range": { "timestamp": { "gte": "now-30d" } }
  },
  "aggs": {
    "daily": {
      "date_histogram": { "field": "timestamp", "calendar_interval": "day" },
      "aggs": {
        "revenue": { "sum": { "field": "total" } }
      }
    }
  }
}'
```

#### For Redis

Redis queries are command-based. Common patterns:

```bash
# Get hash data
redis-cli -u "$REDIS_URL" HGETALL user:123

# Get sorted set range (e.g., recent orders)
redis-cli -u "$REDIS_URL" ZREVRANGE orders:daily:2024-01-15 0 99 WITHSCORES

# Count unique visitors
redis-cli -u "$REDIS_URL" PFCOUNT stats:dau:2024-01-15

# Scan keys matching pattern
redis-cli -u "$REDIS_URL" SCAN 0 MATCH "user:*" COUNT 100

# Get multiple keys
redis-cli -u "$REDIS_URL" MGET cache:product:1 cache:product:2 cache:product:3
```

#### For BigQuery

```bash
bq query --use_legacy_sql=false --format=pretty --project_id="$BQ_PROJECT" "
SELECT DATE(created_at) as day, COUNT(*) as orders, SUM(total)/100 as revenue
FROM \`$BQ_PROJECT.archive_2025.orders\`
WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY day
ORDER BY day DESC
LIMIT 100;"
```

**Multi-dataset example:**

```bash
bq query --use_legacy_sql=false --format=pretty --project_id="$BQ_PROJECT" "
WITH all_orders AS (
  SELECT * FROM \`$BQ_PROJECT.archive_2024.orders\`
  UNION ALL
  SELECT * FROM \`$BQ_PROJECT.archive_2025.orders\`
)
SELECT DATE(created_at) as day, COUNT(*) as orders, SUM(total)/100 as revenue
FROM all_orders
WHERE created_at >= '2024-06-01'
GROUP BY day
ORDER BY day DESC
LIMIT 100;"
```

### 7. Show the query to the user

**NEVER execute a query without showing it to the user first.** This is mandatory, not optional.

Display the query and allow the user to:

- Verify the query logic is correct
- Catch potential issues before execution
- Learn the query syntax for future reference

Format: Show the query in a code block with the appropriate language tag (sql, javascript, json, or redis).

**For large tables (>1M rows):** Add an estimated impact note below the query, e.g., "Note: `order` table has ~5.5M rows. This query filters by `created_at` date range and uses LIMIT 1000."

Example output:

> "I'll run this query to get last month's order count:"
>
> ```sql
> SET SESSION MAX_EXECUTION_TIME=30000;
> SELECT COUNT(*) as total_orders FROM orders WHERE created_at >= '2024-01-01';
> ```
>
> *Note: `orders` table has ~5.5M rows. Query is filtered by date range.*

### 8. Execute via CLI

Run the appropriate CLI command with the generated query.

**Important formatting notes:**

- **MySQL**: Use `-e "query"` for single queries, or `-N` to skip column headers, `-B` for batch mode (tab-separated)
- **PostgreSQL**: Use `-c "query"` for single queries, `-t` for tuples only (no headers), `-A` for unaligned output
- **MongoDB**: Use `--eval "code"` for JavaScript execution, `--quiet` to suppress connection messages
- **Elasticsearch**: Use `curl` with `-s` (silent) and pipe to `jq` for formatting
- **Redis**: Commands are executed directly with `redis-cli`

### 9. Present results

- Format the output clearly (tables for SQL, formatted JSON for document stores)
- Add context to help interpret the numbers
- **Translate enum values**: Look up the "Field Mappings & Enums" section in `docs/DB.md` to convert raw values to human-readable meanings. This is especially important for numeric enums (e.g., `order.state`: `0` = `NEW`, `1` = `COMPLETED`). Never show raw numeric enum values without translation.
- **Use business definitions**: Check the "Business Definitions" section in `docs/DB.md` for terms like "Buyer", "CHP User", "Revenue" to ensure correct interpretation
- Suggest follow-up queries if relevant

### 10. Export results (when requested)

Only export when the user explicitly asks for CSV, file export, or chart data.

**CSV Export:**

| Database | Command |
| --- | --- |
| MySQL | Add `-B` (batch/tab-separated) and pipe through `tr '\t' ','` for CSV |
| PostgreSQL | Add `-A -F ','` for CSV output |
| BigQuery | Use `--format=csv` flag on `bq query` |

Example (MySQL):

```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --password="$MYSQL_PASS" "$MYSQL_DB" -B -e "QUERY" | tr '\t' ','
```

Example (BigQuery):

```bash
bq query --use_legacy_sql=false --format=csv --project_id="$BQ_PROJECT" "QUERY"
```

**Chart-ready JSON:**

When the user wants chart data, structure the output as:

```json
{
  "title": "Description of the data",
  "labels": ["Label1", "Label2", "..."],
  "datasets": [
    { "name": "Series Name", "values": [1, 2, 3] }
  ]
}
```

## Database-Specific Notes

### MySQL vs PostgreSQL

| Feature           | MySQL                              | PostgreSQL                   |
|-------------------|------------------------------------|------------------------------|
| Date truncation   | `DATE(col)`                        | `DATE_TRUNC('day', col)`     |
| Date subtraction  | `DATE_SUB(NOW(), INTERVAL 30 DAY)` | `NOW() - INTERVAL '30 days'` |
| String concat     | `CONCAT(a, b)`                     | `a \|\| b`                   |
| LIMIT with offset | `LIMIT 10, 20`                     | `LIMIT 20 OFFSET 10`         |

### MongoDB

- Use `$match` early in pipelines for index usage
- Remember `_id` is ObjectId by default
- Dates are ISODate objects
- For references, may need `$lookup` for joins
- Escape `$` as `\$` in bash commands

### Elasticsearch

- Use `.keyword` suffix for exact match / aggregations on text fields
- `size: 0` for aggregation-only queries
- Date math: `now-1d`, `now/d` (rounded to day)
- Nested objects need special `nested` query/agg
- Pipe output to `jq` for readable formatting

### Redis

- Redis is key-value; "queries" are command-based
- No joins; data must be denormalized or fetched in multiple calls
- Use SCAN instead of KEYS in production
- Sorted sets are great for time-series / leaderboards

### BigQuery

- Always use **Standard SQL** (`--use_legacy_sql=false`)
- Table names must be backtick-quoted and fully qualified: `` `project.dataset.table` ``
- Use `UNNEST()` for repeated (array) fields
- Use `TIMESTAMP` functions for date operations: `TIMESTAMP_SUB()`, `TIMESTAMP_TRUNC()`, `TIMESTAMP_DIFF()`
- For `DATE` columns, use `DATE_SUB()`, `DATE_TRUNC()`, `DATE_DIFF()`
- Partitioned tables: always filter on the partition column (usually `_PARTITIONTIME` or a date column) to reduce bytes scanned
- BigQuery charges by bytes scanned — use `--dry_run` before running expensive queries
- `LIMIT` does NOT reduce bytes scanned — only `WHERE` filters on partitioned/clustered columns do
- Escape backticks in bash with `\`` when inside double-quoted strings

## Safety Guardrails

### Write Operation Blocking

Before executing any query, scan for write/mutate keywords. Match these as **SQL statements**, not as column names (e.g., `delete_log` or `update_count` are fine as column names).

**SQL (MySQL/PostgreSQL):** `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `REPLACE`
**MongoDB:** `insertOne`, `insertMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`, `drop`, `replaceOne`
**Elasticsearch:** `_delete_by_query`, `_update_by_query`, `PUT` (index creation/mapping)
**Redis:** `DEL`, `FLUSHDB`, `FLUSHALL`, `SET`, `HSET`, `LPUSH`, `SADD`, `ZADD`
**BigQuery:** `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `MERGE`

**If a write operation is detected:**

1. **Stop** — do not execute the query
2. **Show** the query to the user
3. **Explain** the impact (what will be modified, how many rows/documents affected)
4. **Ask** for explicit confirmation before proceeding

### Automatic LIMIT Injection

Read table/collection row counts from the "Large Table Warnings" or "All Tables" section in `docs/DB.md`. Apply these rules:

| Table Size | Action |
| --- | --- |
| < 1M rows | LIMIT optional (add if no aggregation) |
| 1M–10M rows | Inject `LIMIT 1000`; warn user about table size |
| > 10M rows | Inject `LIMIT 100`; require date range filter if table has a date field |
| > 50M rows | **Refuse** query without date range filter; explain why |

**Exception:** Do NOT inject LIMIT on aggregation queries (`COUNT`, `SUM`, `AVG`, `GROUP BY`, MongoDB `$group`, ES `aggs`). Instead, add date-range filters to narrow the source data.

**BigQuery exception:** BigQuery tables are billed by bytes scanned, not row count. Instead of LIMIT injection (which doesn't reduce cost), always:

1. Run `--dry_run` first to estimate bytes scanned
2. If >1 GB estimated, warn the user with the estimated cost (~$5/TB)
3. Ensure queries filter on partitioned/clustered columns
4. For multi-dataset queries, only include datasets relevant to the requested time range

### Query Timeout

Prepend or append timeout settings to prevent runaway queries:

| Database | Timeout Setting |
| --- | --- |
| MySQL | Prepend `SET SESSION MAX_EXECUTION_TIME=30000;` before the query |
| PostgreSQL | Prepend `SET statement_timeout = '30s';` before the query |
| MongoDB | Append `.maxTimeMS(30000)` to `find()` or `aggregate()` calls |
| Elasticsearch | Add `"timeout": "30s"` to the query body |
| Redis | No server-side query timeout; commands are single-threaded and fast. Use `--pipe-timeout` on `redis-cli` for network timeouts |
| BigQuery | Add `--maximum_bytes_billed=1000000000` (1 GB) to the `bq query` command to cap cost. Adjust based on user needs. |

**If a timeout occurs:** Inform the user the query timed out, suggest narrower date range filters or additional WHERE conditions, and offer to retry with a more restrictive query.

## Rules

- **Read-only by default**: Only use read operations unless explicitly asked to modify data
- **Use limits**: Add LIMIT/size constraints for potentially large result sets
- **Handle errors gracefully**: If a query fails, explain why and suggest fixes
- **Respect enums**: Translate coded values to human-readable meanings in output
- **Multi-database**: If project uses multiple databases, ask which one to query if unclear

## Example Interactions

**User**: "How many orders did we get last month?"

1. Read `docs/DB.md` → MySQL database, orders table
2. Show query to user:
   > "I'll run this query to get last month's orders:"
   >
   > ```sql
   > SELECT COUNT(*) as total_orders, SUM(total)/100 as revenue
   > FROM orders
   > WHERE created_at >= DATE_FORMAT(NOW() - INTERVAL 1 MONTH, '%Y-%m-01')
   >   AND created_at < DATE_FORMAT(NOW(), '%Y-%m-01');
   > ```

3. Execute via Bash
4. Present: "Last month you had 1,234 orders totaling $56,789.00 in revenue."

**User**: "Show me the top 10 products by sales"

1. Read `docs/DB.md` → MongoDB, orders collection with embedded items
2. Show query to user:
   > "I'll run this aggregation to find top products:"
   >
   > ```javascript
   > db.orders.aggregate([
   >   { $unwind: "$items" },
   >   { $group: { _id: "$items.productId", totalSold: { $sum: "$items.quantity" } } },
   >   { $sort: { totalSold: -1 } },
   >   { $limit: 10 }
   > ])
   > ```

3. Execute via Bash
4. Present formatted results with product names (may need second query)

**User**: "What are today's active users?"

1. Read `docs/DB.md` → Redis, HyperLogLog at `stats:dau:{date}`
2. Show command to user:
   > "I'll check the HyperLogLog counter for today:"
   >
   > ```redis
   > PFCOUNT stats:dau:2024-01-15
   > ```

3. Execute via Bash
4. Present: "Today's unique active users: 12,345"
