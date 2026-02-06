---
name: query-db
description: Query the database, run a query, look up data, search the database, or check data. Use when the user wants to query the database, run a SQL query, look up data, find data, search for records, check the database, or ask questions about data. Executes queries via CLI commands using natural language. Reads schema context from docs/DB.md. Supports MySQL, PostgreSQL, MongoDB, Elasticsearch, and Redis.
allowed-tools: Read, Bash(mysql:*), Bash(psql:*), Bash(mongosh:*), Bash(redis-cli:*), Bash(curl:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(mkdir:*), Bash(sed:*), Bash(sort:*), Bash(stat:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*)
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

### 7. Show the query to the user

**Always display the query before executing it.** This reassures the user and allows them to:

- Verify the query logic is correct
- Catch potential issues before execution
- Learn the query syntax for future reference

Format: Show the query in a code block with the appropriate language tag (sql, javascript, json, or redis).

Example output:

> "I'll run this query to get last month's order count:"
>
> ```sql
> SELECT COUNT(*) as total_orders FROM orders WHERE created_at >= '2024-01-01';
> ```

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
- Translate enum values to human-readable meanings using `docs/DB.md`
- Suggest follow-up queries if relevant

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
