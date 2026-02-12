---
name: analyze-db
description: Analyze, document, map, or scan the database schema. Use when the user wants to analyze the database, document the database, generate schema docs, map the database, create DB documentation, or inspect the database structure. Generates a docs/DB.md file with complete database schema documentation. Auto-detects language/framework. Supports MySQL, PostgreSQL, MongoDB, Elasticsearch, and Redis.
allowed-tools: Bash(php:*), Bash(python:*), Bash(ruby:*), Bash(rails:*), Bash(go:*), Bash(npm:*), Bash(npx:*), Bash(yarn:*), Bash(dotnet:*), Bash(mysql:*), Bash(psql:*), Bash(mongosh:*), Bash(redis-cli:*), Bash(curl:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(mkdir:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*), Read, Write, Glob, Grep
---

## Purpose

Analyze this project and generate a `docs/DB.md` file with **complete database schema documentation** for running queries.

**IMPORTANT: Document ALL tables/collections/indices.** Do not filter or skip any tables. Developers need full schema documentation, not just "important" tables.

## Environment Variables

This skill assumes database connection environment variables are already set. The following variables are used:

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

### PostgreSQL

```bash
psql -c "SQL_QUERY"
```

### MongoDB

```bash
mongosh "$MONGODB_URI" --eval "JS_CODE"
```

### Elasticsearch

```bash
curl -s "$ES_URL/index/_endpoint" -H "Content-Type: application/json" -d 'JSON_BODY'
```

### Redis

```bash
redis-cli -u "$REDIS_URL" COMMAND
```

## Steps

### 0. Check for existing docs/DB.md

Before starting, check if `docs/DB.md` already exists.

**If the file exists:**

- Read the existing file to understand what was previously documented
- **You MUST still execute ALL steps 1-9.** Do not assume the existing file is accurate. Code and schemas change.
- For each step, compare what the existing file claims vs what the fresh analysis finds
- Merge new findings with existing data:
  - Preserve manually added notes or corrections
  - Update row counts, enum distributions, and date ranges from fresh queries
  - Add any new tables/fields found in code
  - Remove tables/fields no longer present in code or database
  - Flag any discrepancies between existing documentation and current state
- Update the "Last verified" timestamp

**If the file does not exist:**

- Proceed with fresh analysis (steps 1-9)

### 1. Detect language and framework

Check for these indicators:

---

#### PHP

**Symfony (Doctrine ORM):**

- `composer.json` with `doctrine/orm` or `doctrine/doctrine-bundle`
- `src/Entity/` directory
- `config/packages/doctrine.yaml`
- `migrations/` directory

**Laravel (Eloquent):**

- `composer.json` with `laravel/framework`
- `app/Models/` directory
- `database/migrations/`
- `config/database.php`

**Doctrine ODM (MongoDB):**

- `composer.json` with `doctrine/mongodb-odm`
- `src/Document/` directory

---

#### Python

**Django:**

- `manage.py` in root
- `settings.py` with `DATABASES` config
- `models.py` files in app directories
- `*/migrations/` directories

**Flask/SQLAlchemy:**

- `requirements.txt` or `pyproject.toml` with `sqlalchemy` or `flask-sqlalchemy`
- `models.py` or `models/` directory
- `alembic/` or `migrations/` for Alembic

**FastAPI:**

- `requirements.txt` with `fastapi` and `sqlalchemy`
- Similar structure to Flask

**Django + MongoDB (Djongo/MongoEngine):**

- `settings.py` with `djongo` or `mongoengine`

**PyMongo/Motor:**

- `requirements.txt` with `pymongo` or `motor`

---

#### Ruby

**Ruby on Rails (ActiveRecord):**

- `Gemfile` with `rails`
- `app/models/` directory
- `db/migrate/` directory
- `db/schema.rb` or `db/structure.sql`
- `config/database.yml`

**Mongoid (MongoDB):**

- `Gemfile` with `mongoid`
- `config/mongoid.yml`

---

#### Go

**GORM:**

- `go.mod` with `gorm.io/gorm`
- Struct definitions with `gorm:` tags
- `models/` or `internal/models/` directory

**sqlx/database-sql:**

- `go.mod` with `github.com/jmoiron/sqlx`
- SQL files or embedded queries

**MongoDB (mongo-driver):**

- `go.mod` with `go.mongodb.org/mongo-driver`

**ent:**

- `go.mod` with `entgo.io/ent`
- `ent/schema/` directory

---

#### Node.js / TypeScript

**TypeORM:**

- `package.json` with `typeorm`
- `src/entity/` or `entities/` directory
- `ormconfig.json` or `data-source.ts`

**Prisma:**

- `prisma/schema.prisma` file
- `package.json` with `@prisma/client`

**Sequelize:**

- `package.json` with `sequelize`
- `models/` directory
- `migrations/` directory

**Mongoose (MongoDB):**

- `package.json` with `mongoose`
- Schema definitions with `new Schema()`

**Drizzle:**

- `package.json` with `drizzle-orm`
- `drizzle/` directory or schema files

**Knex.js:**

- `package.json` with `knex`
- `knexfile.js` or `knexfile.ts`
- `migrations/` directory

---

#### Java / Kotlin

**Spring Boot + JPA/Hibernate:**

- `pom.xml` or `build.gradle` with `spring-boot-starter-data-jpa`
- `@Entity` annotated classes
- `application.properties` or `application.yml` with `spring.datasource`
- `src/main/java/**/entity/` or `**/model/` directories

**Spring Data MongoDB:**

- `pom.xml` with `spring-boot-starter-data-mongodb`
- `@Document` annotated classes

---

#### .NET / C\#

**Entity Framework Core:**

- `*.csproj` with `Microsoft.EntityFrameworkCore`
- `DbContext` classes
- `Migrations/` directory
- `appsettings.json` with connection strings

**MongoDB.Driver:**

- `*.csproj` with `MongoDB.Driver`

---

#### Rust

**Diesel:**

- `Cargo.toml` with `diesel`
- `diesel.toml` config
- `migrations/` directory
- `schema.rs`

**SeaORM:**

- `Cargo.toml` with `sea-orm`
- `entity/` directory

**SQLx:**

- `Cargo.toml` with `sqlx`
- `.sqlx/` directory or `migrations/`

---

### 2. Detect database type(s)

Based on framework detection, identify which databases are used:

**SQL Databases (MySQL/PostgreSQL/SQLite):**

- Check connection strings in config files
- Look for database driver dependencies
- Check environment files (`.env`, `.env.example`)

**MongoDB:**

- ODM dependencies (Doctrine ODM, Mongoose, MongoEngine, Mongoid, etc.)
- MongoDB connection strings
- Document/collection definitions

**Elasticsearch:**

- Elasticsearch client dependencies
- Index mapping configurations
- `fos_elastica.yaml`, `elasticsearch.yml`, or similar

**Redis:**

- Redis client dependencies
- Cache/session configuration
- Key pattern definitions in code

### 3. Extract schema information

#### For SQL ORMs

| Framework | Entity Location | Migration Location | Schema Command |
| --------- | --------------- | ------------------ | -------------- |
| Symfony/Doctrine | `src/Entity/` | `migrations/` | `php bin/console doctrine:mapping:info` |
| Laravel/Eloquent | `app/Models/` | `database/migrations/` | `php artisan model:show` |
| Django | `*/models.py` | `*/migrations/` | `python manage.py inspectdb` |
| Rails/ActiveRecord | `app/models/` | `db/migrate/` | Read `db/schema.rb` |
| TypeORM | `src/entity/` | `migrations/` | Check entity decorators |
| Prisma | `prisma/schema.prisma` | Prisma migrations | Read schema.prisma directly |
| Spring JPA | `**/entity/` | Flyway/Liquibase | Check `@Entity` classes |
| EF Core | `Models/` or `Entities/` | `Migrations/` | Check DbContext |
| GORM | `models/` | Migration files | Check struct tags |
| Diesel | `src/models.rs` | `migrations/` | Read `schema.rs` |

Look for:

- Column definitions and types
- Primary keys and indexes
- Foreign key relationships
- Unique constraints

**IMPORTANT:** ORM entities/models may not cover all tables. Join tables, framework-generated tables (sessions, migrations, jobs, cache), and raw SQL tables may not have model classes. You MUST also enumerate all tables directly from the schema file (e.g., `db/schema.rb`, `schema.prisma`) or the live database in Step 7, then cross-reference to ensure no table is missing from the documentation.

#### For MongoDB

| Framework | Document Location | Schema Definition |
| --------- | ----------------- | ----------------- |
| Doctrine ODM | `src/Document/` | `@ODM\` annotations |
| Mongoose | `models/` | `new Schema({...})` |
| MongoEngine | `models.py` | `Document` class fields |
| Mongoid | `app/models/` | `field :name, type:` |
| Spring Data MongoDB | `**/document/` | `@Document` annotation |

Look for:

- Field definitions and types
- References and embedded documents
- Indexes

#### For Elasticsearch

- Index mapping definitions
- Field types and analyzers
- Nested object structures

#### For Redis

- Key naming patterns in code
- Data structure usage (String, Hash, Set, ZSet, List, HyperLogLog)
- TTL patterns

### 4. Extract business logic context

Find across all frameworks:

- Constants and enums (status codes, types)
- Repository/DAO methods (common query patterns)
- Validation rules
- Comments and docstrings explaining field meanings
- Soft delete patterns (`deleted_at`, `is_deleted`)
- Multi-tenancy patterns (`tenant_id`, `organization_id`)

### 5. Generate docs/DB.md (Initial Draft)

Create the directory if needed:

```bash
mkdir -p docs
```

Write an initial `docs/DB.md` with the appropriate template based on detected database type(s).

### 6. Check database connectivity

Before connecting to the database, verify the required environment variables are set and the CLI tool is available.

**How to check:** Run a simple connectivity test using the CLI tool. If it fails, output the appropriate setup instructions below and ask the user to configure it.

---

#### MySQL CLI Test

```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --password="$MYSQL_PASS" "$MYSQL_DB" -e "SELECT 1"
```

**Required environment variables:**

- `MYSQL_HOST` - Database host
- `MYSQL_PORT` - Database port
- `MYSQL_USER` - Database user
- `MYSQL_PASS` - Database password
- `MYSQL_DB` - Database name

---

#### PostgreSQL CLI Test

```bash
psql -c "SELECT 1"
```

**Required environment variables:**

- `PGHOST` - Database host
- `PGPORT` - Database port
- `PGUSER` - Database user
- `PGPASSWORD` - Database password
- `PGDATABASE` - Database name

---

#### MongoDB CLI Test

```bash
mongosh "$MONGODB_URI" --eval "db.runCommand({ping: 1})"
```

**Required environment variables:**

- `MONGODB_URI` - Full connection URI

---

#### Elasticsearch CLI Test

```bash
curl -s "$ES_URL/_cluster/health"
# Or with API key:
curl -s -H "Authorization: ApiKey $ES_API_KEY" "${ES_URL}/_cluster/health"
```

**Required environment variables:**

- `ES_URL` - Elasticsearch URL
- `ES_API_KEY` - Optional API key

---

#### Redis CLI Test

```bash
redis-cli -u "$REDIS_URL" PING
```

**Required environment variables:**

- `REDIS_URL` - Redis connection URL

---

**After outputting instructions:** Ask the user to confirm when they have set the environment variables. Wait for their confirmation before proceeding to step 7.

**If the user declines or cannot provide database credentials:** Skip steps 7 and 8. Proceed directly to step 9 using only the code-based analysis from steps 3-4. The verification status in docs/DB.md MUST reflect this (see verification timestamp formats below).

---

### 7. Connect to database and verify schema

Connect via CLI to gather live data and verify the schema analysis.

**CRITICAL: Enumerate ALL tables/collections/indices first.** Before doing anything else in this step, list every table (or collection/index) in the database. Compare this list against what you documented from code in Steps 3-4. Any table present in the database but missing from your documentation MUST be added. Do NOT skip join tables, migration tracking tables, session tables, queue tables, or any other table — every single table must appear in the final documentation.

**Performance safeguards for large tables:**

- Always use **estimated counts** from system tables, never `COUNT(*)` on large tables
- Use **LIMIT** on all queries
- For enum sampling, query a **small sample** or use indexed columns only
- Consider running against a **read replica** if available
- If a table has >10M rows, note it as "large table" and be extra cautious

#### For MySQL

**List ALL tables and row counts (uses estimates, instant). Every table returned here MUST appear in docs/DB.md:**

```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --password="$MYSQL_PASS" "$MYSQL_DB" -e "
SELECT table_name, table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
ORDER BY table_rows DESC;"
```

**Check indexes:**

```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --password="$MYSQL_PASS" "$MYSQL_DB" -e "SHOW INDEX FROM table_name;"
```

**Get date ranges for time-series tables:**

```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --password="$MYSQL_PASS" "$MYSQL_DB" -e "
SELECT MIN(created_at) as earliest, MAX(created_at) as latest FROM orders;"
```

#### For PostgreSQL

**List ALL tables and row counts (uses estimates, instant). Every table returned here MUST appear in docs/DB.md:**

```bash
psql -c "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"
```

**Check indexes:**

```bash
psql -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'table_name';"
```

**Get date ranges:**

```bash
psql -c "SELECT MIN(created_at) as earliest, MAX(created_at) as latest FROM orders;"
```

#### For MongoDB

**List ALL collections and document counts. Every collection returned here MUST appear in docs/DB.md:**

```bash
mongosh "$MONGODB_URI" --eval "db.getCollectionNames().forEach(c => print(c + ': ' + db[c].estimatedDocumentCount()))"
```

**List indexes:**

```bash
mongosh "$MONGODB_URI" --eval "db.collection.getIndexes()"
```

**Get date ranges:**

```bash
mongosh "$MONGODB_URI" --eval "db.orders.aggregate([
  { \$group: { _id: null, earliest: { \$min: '\$createdAt' }, latest: { \$max: '\$createdAt' } } }
])"
```

**Sample document structure:**

```bash
mongosh "$MONGODB_URI" --eval "db.collection.findOne()"
```

#### For Elasticsearch

**List ALL indices and document counts. Every index returned here MUST appear in docs/DB.md:**

```bash
curl -s "$ES_URL/_cat/indices?v&h=index,docs.count,store.size"
```

**Get mapping:**

```bash
curl -s "$ES_URL/index_name/_mapping" | jq
```

#### For Redis

**Get database size:**

```bash
redis-cli -u "$REDIS_URL" DBSIZE
```

**Sample key patterns:**

```bash
redis-cli -u "$REDIS_URL" SCAN 0 MATCH "user:*" COUNT 10
```

**Check TTLs:**

```bash
redis-cli -u "$REDIS_URL" TTL key_name
```

### 8. Sample enum/status field values

For each enum or status field identified, query the actual values and their distribution.

**Use safe sampling for large tables (>1M rows):**

#### MySQL

**For small tables (<1M rows) - full count is OK:**

```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --password="$MYSQL_PASS" "$MYSQL_DB" -e "
SELECT status, COUNT(*) as count FROM orders GROUP BY status ORDER BY count DESC;"
```

**For large tables (>1M rows) - use sampling:**

```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --password="$MYSQL_PASS" "$MYSQL_DB" -e "
SELECT status, COUNT(*) as count FROM orders
WHERE created_at >= NOW() - INTERVAL 30 DAY
GROUP BY status ORDER BY count DESC;"
```

**For very large tables - just get distinct values:**

```bash
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --password="$MYSQL_PASS" "$MYSQL_DB" -e "
SELECT DISTINCT status FROM orders LIMIT 20;"
```

#### PostgreSQL

**For small tables:**

```bash
psql -c "SELECT status, COUNT(*) as count FROM orders GROUP BY status ORDER BY count DESC;"
```

**For large tables - use sampling:**

```bash
psql -c "SELECT status, COUNT(*) as count FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY status ORDER BY count DESC;"
```

#### MongoDB

**For small collections:**

```bash
mongosh "$MONGODB_URI" --eval "db.orders.aggregate([
  { \$group: { _id: '\$status', count: { \$sum: 1 } } },
  { \$sort: { count: -1 } }
])"
```

**For large collections - use sampling:**

```bash
mongosh "$MONGODB_URI" --eval "db.orders.aggregate([
  { \$sample: { size: 10000 } },
  { \$group: { _id: '\$status', count: { \$sum: 1 } } },
  { \$sort: { count: -1 } }
])"
```

#### Elasticsearch

Elasticsearch aggregations are generally safe - they use approximate counts:

```bash
curl -s "$ES_URL/orders/_search" -H "Content-Type: application/json" -d '{
  "size": 0,
  "aggs": {
    "status_values": {
      "terms": { "field": "status.keyword", "size": 20 }
    }
  }
}'
```

### 9. Update docs/DB.md with verified data

Update the `docs/DB.md` file with the live data gathered.

**Completeness check:** Before writing, verify that every table/collection/index returned by the database in Step 7 has a row in the "All Tables" (or "All Collections" / "All Indices") section. If any are missing, add them now. There must be a 1:1 correspondence between database objects and documented rows.

**Add row/document counts** to table/collection listings:

| Table  | Purpose         | Rows  | Key Fields         |
| ------ | --------------- | ----- | ------------------ |
| orders | Customer orders | ~1.2M | status, created_at |

**Replace enum guesses with actual values and counts:**

| Table.Field   | Value | Meaning   | Count   |
| ------------- | ----- | --------- | ------- |
| orders.status | 1     | Completed | 850,000 |
| orders.status | 0     | Pending   | 120,000 |

**Document actual indexes:**

| Table  | Index              | Columns    | Notes                      |
| ------ | ------------------ | ---------- | -------------------------- |
| orders | idx_orders_created | created_at | Use for date range queries |

**Add date ranges:**

| Table.Field       | Range                 |
| ----------------- | --------------------- |
| orders.created_at | 2019-01-15 to present |

**Add verification timestamp** at the top of the file using the appropriate format:

If database connection was available (steps 7-8 completed):

```markdown
# Database Schema Documentation

> **Last verified**: YYYY-MM-DD — verified against live database
```

If NO database connection was available (steps 7-8 skipped):

```markdown
# Database Schema Documentation

> **Last verified**: YYYY-MM-DD — derived from code analysis only (not verified against live database)
```

---

## Template for SQL Databases (MySQL/PostgreSQL)

```markdown
# Database Schema Documentation

> **Last verified**: YYYY-MM-DD — verified against live database / derived from code analysis only (not verified against live database)

## Database Type

MySQL / PostgreSQL (select one)

## CLI Command

<!-- Used by query-db skill -->
- MySQL: `mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --password="$MYSQL_PASS" "$MYSQL_DB"`
- PostgreSQL: `psql`

## Framework

[Detected framework, e.g., "Symfony/Doctrine", "Django", "Rails/ActiveRecord"]

## Database Overview

Brief description of what data this system holds.

## All Tables

<!-- List EVERY table in the database, no exceptions. -->

| Table | Purpose | Key Fields for Filtering/Grouping |
|-------|---------|-----------------------------------|
| (one row per table — list ALL of them) | | |

## Field Mappings & Enums

| Table.Field | Value | Meaning |
|-------------|-------|---------|
| order.status | 0 | Pending |
| ... | ... | ... |

## Relationships

- `order.user_id → user.id`
- `order_item.order_id → order.id`

## Date/Time Fields

| Table.Field | Purpose | Notes |
|-------------|---------|-------|
| order.created_at | Order creation | Use for daily/monthly reports |

## Money/Numeric Fields

| Table.Field | Unit | Notes |
|-------------|------|-------|
| order.total | cents | Divide by 100 for display |

## Soft Deletes

Tables using soft delete pattern:

- `users.deleted_at`
- `orders.deleted_at`

**Important**: Add `WHERE deleted_at IS NULL` to exclude soft-deleted records.

## Multi-Tenancy

If applicable, note tenant isolation:

- Filter by `organization_id` or `tenant_id`

## Framework / Infrastructure Tables

Tables managed by the framework (not domain models). Still included for completeness:

- Migration tracking: `...`
- Sessions: `...`
- Job queues: `...`
- Cache: `...`

## Common Query Patterns

### Daily Order Summary

~~~sql
SELECT DATE(created_at) as day, COUNT(*) as orders, SUM(total)/100 as revenue
FROM orders
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  AND deleted_at IS NULL
GROUP BY DATE(created_at);
~~~
```

---

## Template for MongoDB

```markdown
# Database Schema Documentation

> **Last verified**: YYYY-MM-DD — verified against live database / derived from code analysis only (not verified against live database)

## Database Type

MongoDB

## CLI Command

<!-- Used by query-db skill -->
`mongosh "$MONGODB_URI"`

## Framework

[Detected framework, e.g., "Mongoose", "Doctrine ODM", "MongoEngine"]

## Database Overview

Brief description of what data this system holds.

## All Collections

<!-- List EVERY collection in the database, no exceptions. -->

| Collection | Purpose | Key Fields for Filtering/Grouping |
|------------|---------|-----------------------------------|
| (one row per collection — list ALL of them) | | |

## Field Mappings & Enums

| Collection.Field | Value | Meaning |
|------------------|-------|---------|
| orders.status | "pending" | Awaiting processing |
| ... | ... | ... |

## References (Relationships)

- `orders.customerId → customers._id`
- `orderItems.orderId → orders._id`

## Embedded Documents

| Collection | Embedded Field | Structure |
|------------|----------------|-----------|
| orders | items | Array of {productId, quantity, price} |

## Date Fields

| Collection.Field | Purpose |
|------------------|---------|
| orders.createdAt | Order creation timestamp |

## Indexes

List important indexes for query optimization.

## Common Aggregation Patterns

### Daily Revenue

~~~javascript
db.orders.aggregate([
  { $match: { createdAt: { $gte: ISODate("2024-01-01") } } },
  { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              total: { $sum: "$total" }, count: { $sum: 1 } } },
  { $sort: { _id: -1 } }
])
~~~
```

---

## Template for Elasticsearch

```markdown
# Database Schema Documentation

> **Last verified**: YYYY-MM-DD — verified against live database / derived from code analysis only (not verified against live database)

## Database Type

Elasticsearch

## CLI Command

<!-- Used by query-db skill -->
`curl -s "$ES_URL"`

## Framework

[Detected framework, e.g., "FOSElastica", "elasticsearch-py", "elastic4s"]

## Index Overview

Brief description of what data is indexed.

## All Indices

| Index | Purpose | Key Fields |
|-------|---------|------------|
| products | Product catalog | name, category, price, stock |
| ... | ... | ... |

## Field Mappings

| Index.Field | Type | Notes |
|-------------|------|-------|
| products.price | scaled_float | Factor 100 (cents) |
| products.name | text + keyword | Use .keyword for aggregations |

## Date Fields

| Index.Field | Format |
|-------------|--------|
| orders.timestamp | epoch_millis |

## Nested Objects

| Index | Nested Field | Structure |
|-------|--------------|-----------|
| orders | items | Array of order line items |

## Common Query Patterns

### Category Aggregation

~~~json
{
  "size": 0,
  "aggs": {
    "by_category": {
      "terms": { "field": "category.keyword" },
      "aggs": {
        "avg_price": { "avg": { "field": "price" } }
      }
    }
  }
}
~~~
```

---

## Template for Redis

```markdown
# Database Schema Documentation

> **Last verified**: YYYY-MM-DD — verified against live database / derived from code analysis only (not verified against live database)

## Database Type

Redis

## CLI Command

<!-- Used by query-db skill -->
`redis-cli -u "$REDIS_URL"`

## Framework

[Detected framework, e.g., "ioredis", "redis-py", "Predis"]

## Data Overview

Brief description of what data is stored.

## Key Patterns

| Pattern | Type | Purpose |
|---------|------|---------|
| `user:{id}` | Hash | User profile data |
| `user:{id}:sessions` | Set | Active session IDs |
| `orders:daily:{date}` | Sorted Set | Orders by timestamp |
| `cache:product:{id}` | String (JSON) | Product cache |
| `stats:pageviews` | HyperLogLog | Unique visitor count |

## Data Structures

### user:{id} (Hash)

| Field | Description |
|-------|-------------|
| email | User email |
| name | Display name |
| created_at | Unix timestamp |

### orders:daily:{date} (Sorted Set)

- Score: Unix timestamp
- Member: Order ID

## TTL Patterns

| Pattern | TTL | Notes |
|---------|-----|-------|
| `cache:*` | 3600 | 1 hour cache |
| `session:*` | 86400 | 24 hour sessions |

## Common Query Patterns

### Get user with recent orders

~~~redis
HGETALL user:123
ZREVRANGE orders:user:123 0 9 WITHSCORES
~~~

### Daily active users

~~~redis
PFCOUNT stats:dau:2024-01-15
~~~
```

---

## Template for Multi-Database Projects

If the project uses multiple databases, create sections for each:

```markdown
# Database Schema Documentation

## Databases Used

1. PostgreSQL (primary data)
2. Redis (caching, sessions)
3. Elasticsearch (search)

---

## PostgreSQL

[Include full SQL template sections here]

---

## Redis

[Include full Redis template sections here]

---

## Elasticsearch

[Include full Elasticsearch template sections here]
```

---

## Rules

- Keep descriptions concise and focused on querying needs
- Include actual values from the codebase, not placeholders
- Note any gotchas (soft deletes, tenant isolation, TTLs, etc.)
- If multiple databases are used, include sections for each
- Document the CLI command to use for queries
- Identify the framework used for future reference
- **Document ALL tables/collections/indices without exception.** Every database object must have a row in the documentation. Do not skip join tables, migration tables, session tables, queue tables, cache tables, or any other table — they all go in the "All Tables" section. Group framework/infrastructure tables in their own section if desired, but they must still be listed.
