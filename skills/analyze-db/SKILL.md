---
name: analyze-db
description: Analyze, document, map, or scan the database schema. Use when the user wants to analyze the database, document the database, generate schema docs, map the database, create DB documentation, or inspect the database structure. Generates a docs/db.md file with complete database schema documentation. Auto-detects language/framework. Supports MySQL, PostgreSQL, SQLite, MongoDB, Elasticsearch, Redis, and BigQuery.
allowed-tools: Bash(php:*), Bash(python:*), Bash(ruby:*), Bash(npm:*), Bash(npx:*), Bash(mysql:*), Bash(psql:*), Bash(sqlite3:*), Bash(mongosh:*), Bash(redis-cli:*), Bash(bq:*), Bash(curl:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(mkdir:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*), Read, Write, Glob, Grep, mcp__postgres__query, mcp__postgres__list_tables, mcp__postgres__describe_table, mcp__postgres__list_schemas, mcp__mysql__mysql_query, mcp__mongodb__find, mcp__mongodb__aggregate, mcp__mongodb__count, mcp__mongodb__list-databases, mcp__mongodb__list-collections, mcp__mongodb__collection-schema, mcp__redis__*, mcp__bigquery__*
---

# Analyze Database Schema

Analyze the project and generate `docs/db.md` with **complete database schema documentation** ready for use by the `query-db` skill.

**Document EVERY table/collection/index without exception** — including join tables, migration trackers, session tables, queue tables, cache tables, framework-internal tables. Developers need full schema docs, not just "important" ones.

## MCP Tools with Fallbacks

Prefer MCP tools when available — they handle connection management. Fall back to CLI on errors.

| Database | MCP Tools | CLI Fallback |
| --- | --- | --- |
| PostgreSQL | `mcp__postgres__list_tables`, `describe_table`, `list_schemas`, `query` | `psql` |
| MySQL | `mcp__mysql__mysql_query` | `mysql` |
| MongoDB | `mcp__mongodb__list-databases`, `list-collections`, `collection-schema`, `find` | `mongosh` |
| Redis | `mcp__redis__*` | `redis-cli` |
| SQLite | (no MCP) | `sqlite3` |
| BigQuery | `mcp__bigquery__*` | `bq` |
| Elasticsearch | (no MCP) | `curl` |

## Connection Environment Variables

| Database | Variables |
| -------- | --------- |
| MySQL | `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASS`, `MYSQL_DB` |
| PostgreSQL | `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` |
| MongoDB | `MONGODB_URI` |
| Elasticsearch | `ES_URL`, `ES_API_KEY` (optional) |
| Redis | `REDIS_URL` |
| BigQuery | `BQ_PROJECT`, `BQ_DATASETS` (comma-separated list, e.g. `archive_2023,archive_2024,archive_2025`) |

## CLI Command Reference

| Database | Connect / Query | List schema |
| -------- | --------------- | ----------- |
| MySQL | `MYSQL_PWD="$MYSQL_PASS" mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DB" -e "<SQL>"` | `SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_rows DESC;` (estimates, instant) |
| PostgreSQL | `psql -c "<SQL>"` | `SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;` |
| SQLite | `sqlite3 <db> "<SQL>"` | `SELECT name FROM sqlite_master WHERE type='table';` |
| MongoDB | `mongosh "$MONGODB_URI" --eval "<JS>"` | `db.getCollectionNames().forEach(c => print(c + ': ' + db[c].estimatedDocumentCount()))` |
| Elasticsearch | `curl -s "$ES_URL/<endpoint>"` (add `-H "Authorization: ApiKey $ES_API_KEY"` if set) | `curl -s "$ES_URL/_cat/indices?v&h=index,docs.count,store.size"` |
| Redis | `redis-cli -u "$REDIS_URL" <CMD>` | `DBSIZE`, `SCAN 0 MATCH <pattern> COUNT 100` |
| BigQuery | `bq query --use_legacy_sql=false --format=prettyjson --project_id="$BQ_PROJECT" "<SQL>"` | `bq ls --project_id="$BQ_PROJECT" "$DATASET"`; `bq show --schema --format=prettyjson --project_id="$BQ_PROJECT" "$DATASET.<table>"` |

## Steps

### Step 0 — Check for existing `docs/db.md`

If the file exists, read it but **still execute every step**. Code and schemas drift. After fresh analysis, merge findings:

- Preserve manual notes/corrections.
- Update row counts, enum distributions, date ranges from fresh queries.
- Add new tables/fields found in code; remove tables/fields no longer present.
- Flag discrepancies; update the "Last verified" timestamp.

### Step 1 — Detect language and framework

Match these signals (run each only as needed):

| Language | Framework | Detection signals |
| -------- | --------- | ----------------- |
| PHP | Symfony / Doctrine ORM | `composer.json` has `doctrine/orm` or `doctrine/doctrine-bundle`; `src/Entity/`; `config/packages/doctrine.yaml`; `migrations/` |
| PHP | Laravel / Eloquent | `composer.json` has `laravel/framework`; `app/Models/`; `database/migrations/`; `config/database.php` |
| PHP | Doctrine ODM (MongoDB) | `composer.json` has `doctrine/mongodb-odm`; `src/Document/` |
| Python | Django | `manage.py`; `settings.py` with `DATABASES`; `models.py` in apps; `*/migrations/` |
| Python | Flask / FastAPI + SQLAlchemy | `requirements.txt`/`pyproject.toml` has `sqlalchemy` or `flask-sqlalchemy`; `models.py` or `models/`; `alembic/` |
| Python | Django + MongoDB | `settings.py` has `djongo` or `mongoengine` |
| Python | PyMongo / Motor | `requirements.txt` has `pymongo` or `motor` |
| Ruby | Rails / ActiveRecord | `Gemfile` has `rails`; `app/models/`; `db/migrate/`; `db/schema.rb` or `db/structure.sql`; `config/database.yml` |
| Ruby | Mongoid | `Gemfile` has `mongoid`; `config/mongoid.yml` |
| Go | GORM | `go.mod` has `gorm.io/gorm`; structs with `gorm:` tags; `models/` or `internal/models/` |
| Go | sqlx | `go.mod` has `github.com/jmoiron/sqlx` |
| Go | mongo-driver | `go.mod` has `go.mongodb.org/mongo-driver` |
| Go | ent | `go.mod` has `entgo.io/ent`; `ent/schema/` |
| Node / TS | TypeORM | `package.json` has `typeorm`; `src/entity/` or `entities/`; `ormconfig.json` or `data-source.ts` |
| Node / TS | Prisma | `prisma/schema.prisma`; `package.json` has `@prisma/client` |
| Node / TS | Sequelize | `package.json` has `sequelize`; `models/`; `migrations/` |
| Node / TS | Mongoose | `package.json` has `mongoose`; `new Schema(...)` patterns |
| Node / TS | Drizzle | `package.json` has `drizzle-orm`; `drizzle/` |
| Node / TS | Knex | `package.json` has `knex`; `knexfile.js`/`knexfile.ts`; `migrations/` |
| Java / Kotlin | Spring Boot + JPA/Hibernate | `pom.xml`/`build.gradle` has `spring-boot-starter-data-jpa`; `@Entity` classes; `application.properties`/`application.yml` with `spring.datasource`; `**/entity/` or `**/model/` |
| Java / Kotlin | Spring Data MongoDB | `spring-boot-starter-data-mongodb`; `@Document` classes |
| .NET / C# | EF Core | `*.csproj` has `Microsoft.EntityFrameworkCore`; `DbContext` classes; `Migrations/`; `appsettings.json` with connection strings |
| .NET / C# | MongoDB.Driver | `*.csproj` has `MongoDB.Driver` |
| Rust | Diesel | `Cargo.toml` has `diesel`; `diesel.toml`; `migrations/`; `schema.rs` |
| Rust | SeaORM | `Cargo.toml` has `sea-orm`; `entity/` |
| Rust | SQLx | `Cargo.toml` has `sqlx`; `.sqlx/` or `migrations/` |

### Step 2 — Detect database type(s)

Identify each DB used by inspecting:

- **SQL (MySQL/PostgreSQL/SQLite)** — connection strings in config/`.env`/`.env.example`; SQL driver dependencies.
- **MongoDB** — ODM dependencies (Mongoose, Doctrine ODM, MongoEngine, Mongoid), connection strings, document/collection definitions.
- **Elasticsearch** — Elasticsearch client deps; index mappings; `fos_elastica.yaml`/`elasticsearch.yml`.
- **Redis** — Redis client deps; cache/session config; key-pattern definitions.
- **BigQuery** — `BQ_PROJECT`/`BQ_DATASETS` set; `google-cloud-bigquery` (Python) or `@google-cloud/bigquery` (Node) deps.

### Step 3 — Extract schema from code

| Framework | Entity location | Migration location | Schema source |
| --------- | --------------- | ------------------ | ------------- |
| Symfony / Doctrine | `src/Entity/` | `migrations/` | `php bin/console doctrine:mapping:info` |
| Laravel / Eloquent | `app/Models/` | `database/migrations/` | `php artisan model:show` |
| Django | `*/models.py` | `*/migrations/` | `python manage.py inspectdb` |
| Rails / ActiveRecord | `app/models/` | `db/migrate/` | `db/schema.rb` |
| TypeORM | `src/entity/` | `migrations/` | entity decorators |
| Prisma | `prisma/schema.prisma` | (Prisma migrations) | `schema.prisma` |
| Spring JPA | `**/entity/` | Flyway / Liquibase | `@Entity` classes |
| EF Core | `Models/` or `Entities/` | `Migrations/` | `DbContext` |
| GORM | `models/` | migration files | struct tags |
| Diesel | `src/models.rs` | `migrations/` | `schema.rs` |

For SQL: extract column types, primary keys, indexes, foreign keys, unique constraints.

For **MongoDB ODMs** — Doctrine ODM (`@ODM\` annotations in `src/Document/`); Mongoose (`new Schema({...})` in `models/`); MongoEngine (`Document` subclass in `models.py`); Mongoid (`field :name, type:` in `app/models/`); Spring Data MongoDB (`@Document` in `**/document/`). Extract field types, references, embedded documents, indexes.

For **Elasticsearch**: index mappings, field types/analyzers, nested object structures.

For **Redis**: key naming patterns in code, data structures used (String/Hash/Set/ZSet/List/HyperLogLog), TTL patterns.

**IMPORTANT — code is not exhaustive.** ORM entities don't cover join tables, framework tables (sessions, migrations, jobs, cache), or raw-SQL tables. Always reconcile against the live database in Step 7.

### Step 4 — Extract business-logic context

Look for:

- Constants and enums (status codes, types).
- Repository/DAO methods (common query patterns).
- Validation rules.
- Comments/docstrings explaining field meanings.
- Soft-delete patterns (`deleted_at`, `is_deleted`).
- Multi-tenancy patterns (`tenant_id`, `organization_id`).
- **BI dashboards, report generators, analytics endpoints** — capture common business questions and the tables/joins/filters used. These become the "Common Business Questions" section.
- **Domain terms** — the words the business uses that do not map 1:1 to a table or column name (e.g. "Buyer", "Active user", "Revenue"), found in those same constants, enums, validation rules, dashboards and comments. Record each term with its definition and the tables/columns/filters that express it. These become the "Business Definitions" section.

### Step 5 — Generate initial `docs/db.md` draft

```bash
mkdir -p docs
```

Write the initial draft using the per-DB template (see "Document Templates" below).

### Step 6 — Verify connectivity

Test connectivity using the simplest CLI ping per DB:

| Database | Test command |
| -------- | ------------ |
| MySQL | `MYSQL_PWD="$MYSQL_PASS" mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DB" -e "SELECT 1"` |
| PostgreSQL | `psql -c "SELECT 1"` |
| MongoDB | `mongosh "$MONGODB_URI" --eval "db.runCommand({ping: 1})"` |
| Elasticsearch | `curl -s "$ES_URL/_cluster/health"` |
| Redis | `redis-cli -u "$REDIS_URL" PING` |
| BigQuery | `bq query --use_legacy_sql=false --project_id="$BQ_PROJECT" "SELECT 1"` (if it fails, ask the user to run `gcloud auth application-default login` and `gcloud auth application-default set-quota-project $BQ_PROJECT`) |

If a test fails, output the missing env var(s) and ask the user to set them. Wait for confirmation.

If the user declines or can't provide credentials, **skip Steps 7-8** and proceed to Step 9 using code-based analysis only. The `Last verified` line in `db.md` MUST reflect this (see Step 9 timestamp formats).

### Step 7 — Connect and verify the schema

**CRITICAL — enumerate ALL objects first.** List every table / collection / index in the live database before anything else. Compare against what you documented from code in Steps 3-4. Add anything missing.

**Quote database-derived names.** Never interpolate a database-derived name into a command unquoted; any name not matching `^[A-Za-z0-9_]+$` must go through the engine's identifier-quoting form or be reported and skipped.

**Performance safeguards for large tables:**

- Use estimated counts from system tables (`information_schema.tables.table_rows`, `pg_stat_user_tables.n_live_tup`, `estimatedDocumentCount()`); never `COUNT(*)` on large tables.
- Always `LIMIT` ad-hoc sampling queries.
- For enum sampling, query a small sample or use indexed columns only.
- Prefer a read replica when available.
- Tables >10M rows = "VERY LARGE — always filter by date/indexed column".

Use the schema commands from the "CLI Command Reference" table above, then for each table/collection capture:

- **Indexes** — MySQL: ``SHOW INDEX FROM `<table>`;``. PostgreSQL: `psql -v tbl="<table>" -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = :'tbl';"`. MongoDB: `db.getCollection("<coll>").getIndexes()`. Elasticsearch: `curl -s "$ES_URL/<index>/_mapping" | jq` with `<index>` URL-encoded.
- **Date ranges** — `SELECT MIN(created_at), MAX(created_at) FROM <table>;` (or MongoDB `$min`/`$max` aggregation).
- **Sample document** — MongoDB `db.<coll>.findOne()`; Redis `HGETALL`/`TTL`.
- **BigQuery** — iterate datasets: `for ds in $(echo "$BQ_DATASETS" | tr ',' ' '); do echo "=== $ds ==="; bq ls --project_id="$BQ_PROJECT" "$ds"; done`. For each table: `bq show --schema --format=prettyjson --project_id="$BQ_PROJECT" "$DATASET.<table>"` and `bq show --project_id="$BQ_PROJECT" "$DATASET.<table>"` (row count, partitioning).

### Step 8 — Sample enum / status field values

Use safe sampling depending on table size:

| DB | Small table (<1M) | Large table (>1M) | Very large |
| -- | ----------------- | ----------------- | ---------- |
| MySQL/PostgreSQL | `SELECT status, COUNT(*) FROM TABLE GROUP BY status ORDER BY count DESC;` | Add `WHERE created_at >= NOW() - INTERVAL 30 DAY` (PG: `INTERVAL '30 days'`) | `SELECT DISTINCT status FROM TABLE LIMIT 20;` |
| MongoDB | `db.COLL.aggregate([{$group: {_id: "$status", count: {$sum: 1}}}, {$sort: {count: -1}}])` | Prepend `{$sample: {size: 10000}}` to the pipeline | (sampled) |
| Elasticsearch | `terms` aggregation with `size: 0` (always safe — uses approximate counts) | same | same |
| BigQuery | `SELECT status, COUNT(*) FROM \`$BQ_PROJECT.$DATASET.TABLE\` GROUP BY status ORDER BY count DESC LIMIT 20;` | Use `APPROX_COUNT_DISTINCT(ID)` and always include partition filter | `--dry_run` first to estimate cost |

### Step 9 — Update `docs/db.md` with verified data

**Completeness check before writing:** every table/collection/index returned by Step 7 has a row in the "All Tables / Collections / Indices" section. There must be a 1:1 correspondence — no skipping framework or join tables.

**Add Large Table Warnings.** For tables >1M rows: list with safeguards. For >10M rows: mark "VERY LARGE — always filter by date/indexed column" and list specific indexed columns.

**Common Business Questions** — from Step 4's BI/dashboard scan, document recurring analytics questions with the correct tables/joins/filters. Helps `query-db` users avoid common mistakes.

**Business Definitions** — from Step 4's domain-term scan, document each real term with its definition and the tables/columns/filters that express it. Only terms you actually found; never invent a definition. `query-db` reads this section to interpret business vocabulary, so an empty or missing section makes it guess.

**Add row/document counts** to listings, **replace enum guesses with actual values + counts**, **document actual indexes**, **add date ranges**.

**"Last verified" line at top of `docs/db.md`:**

- Live DB verified: `> **Last verified**: YYYY-MM-DD — verified against live database`
- Code-only (Steps 7-8 skipped): `> **Last verified**: YYYY-MM-DD — derived from code analysis only (not verified against live database)`

## Document Templates

`docs/db.md` always starts with H1 `# Database Schema Documentation` and the "Last verified" line. The body sections depend on the DB type. Below are the required sections per DB. Fill them with discovered content; do not paste placeholder rows.

### SQL (MySQL / PostgreSQL / SQLite)

Required sections, in order:

1. **Database Type** — MySQL / PostgreSQL / SQLite.
2. **CLI Command** — used by `query-db` skill (e.g. `MYSQL_PWD="$MYSQL_PASS" mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DB"` or `psql`).
3. **Framework** — detected framework name.
4. **Database Overview** — one paragraph on what data this system holds.
5. **All Tables** — single table listing **every** table: `Table | Purpose | Key Fields for Filtering/Grouping | Rows`.
6. **Field Mappings & Enums** — `Table.Field | Value | Meaning | Count`.
7. **Business Definitions** — `Term | Definition | How it is expressed in the schema` (e.g. "Buyer", "Active user", "Revenue"): the domain vocabulary a query author must get right, with the tables, columns and filters that actually express each term.
8. **Relationships** — `parent.fk → child.pk` arrows.
9. **Date/Time Fields** — `Table.Field | Purpose | Notes` (TZ, granularity).
10. **Money/Numeric Fields** — `Table.Field | Unit | Notes` (e.g. cents, divide by 100).
11. **Soft Deletes** — list tables using `deleted_at`/`is_deleted`; remind to add `WHERE deleted_at IS NULL`.
12. **Multi-Tenancy** — note tenant isolation columns if applicable (`organization_id`, `tenant_id`).
13. **Framework / Infrastructure Tables** — migration tracking, sessions, queues, cache (still listed in All Tables; this section explains them).
14. **Large Table Warnings** — `Table | Rows | Required Safeguards`.
15. **Query Anti-Patterns** — `# | Anti-Pattern | Why It's Bad | Do Instead`. Standard rows: `SELECT *` without WHERE on large tables; unbounded `COUNT(*)`; unfiltered JOIN between large tables; `GROUP BY` on non-indexed columns; ignoring denormalized analytics tables.
16. **Common Business Questions** — `# | Question | Tables Involved | Key Filters` (from Step 4 BI scan).
17. **Common Query Patterns** — fenced SQL examples (e.g. Daily Order Summary with date filter + `deleted_at IS NULL`).

### MongoDB

Required sections:

1. **Database Type** — MongoDB.
2. **CLI Command** — `mongosh "$MONGODB_URI"`.
3. **Framework** — Mongoose / Doctrine ODM / MongoEngine / Mongoid / Spring Data MongoDB.
4. **Database Overview**.
5. **All Collections** — `Collection | Purpose | Key Fields for Filtering/Grouping | Document Count`.
6. **Field Mappings & Enums** — `Collection.Field | Value | Meaning`.
7. **Business Definitions** — `Term | Definition | How it is expressed in the schema` (e.g. "Buyer", "Active user", "Revenue"): the domain vocabulary a query author must get right, with the collections, fields and `$match` filters that actually express each term.
8. **References (Relationships)** — `coll.fkField → otherColl._id`.
9. **Embedded Documents** — `Collection | Embedded Field | Structure`.
10. **Date Fields** — `Collection.Field | Purpose`.
11. **Indexes** — important indexes for query optimization.
12. **Query Anti-Patterns** — standard rows: unbounded `find({})`; `$lookup` between large collections without `$match` first; large `allowDiskUse` aggregations without `$match`.
13. **Common Aggregation Patterns** — fenced JS examples (e.g. Daily Revenue with `$match` first).

### Elasticsearch

Required sections:

1. **Database Type** — Elasticsearch.
2. **CLI Command** — `curl -s "$ES_URL"`.
3. **Framework** — FOSElastica / elasticsearch-py / elastic4s.
4. **Index Overview**.
5. **All Indices** — `Index | Purpose | Key Fields | Doc Count`.
6. **Field Mappings** — `Index.Field | Type | Notes` (e.g. `scaled_float` factor 100, `text + keyword`).
7. **Date Fields** — `Index.Field | Format` (epoch_millis, ISO).
8. **Nested Objects** — `Index | Nested Field | Structure`.
9. **Query Anti-Patterns** — standard rows: `size > 10000`; deep `from + size` pagination (>10000 limit); `match_all` without `size: 0` on large indices.
10. **Common Query Patterns** — fenced JSON examples (aggregations always with `size: 0`).

### Redis

Required sections:

1. **Database Type** — Redis.
2. **CLI Command** — `redis-cli -u "$REDIS_URL"`.
3. **Framework** — ioredis / redis-py / Predis.
4. **Data Overview**.
5. **Key Patterns** — `Pattern | Type | Purpose` (e.g. `user:{id}` Hash, `cache:product:{id}` String/JSON, `stats:pageviews` HyperLogLog).
6. **Data Structures** — per-pattern detail (Hash fields, Sorted Set scores/members).
7. **TTL Patterns** — `Pattern | TTL | Notes`.
8. **Query Anti-Patterns** — standard rows: `KEYS *` in production (use `SCAN`); `FLUSHDB`/`FLUSHALL` without confirmation.
9. **Common Query Patterns** — `HGETALL`/`ZREVRANGE`/`PFCOUNT` examples in fenced blocks.

### BigQuery

Required sections:

1. **Database Type** — BigQuery.
2. **CLI Command** — `bq query --use_legacy_sql=false --format=prettyjson --project_id="$BQ_PROJECT"`.
3. **Datasets** — `Dataset | Period | Description`.
4. **All Tables (per dataset)** — `Table | Purpose | Key Fields | Rows`. Note any datasets with differing schemas.
5. **Field Mappings & Enums** — `Dataset.Table.Field | Value | Meaning` (use `*.table.field` if uniform across datasets).
6. **Business Definitions** — `Term | Definition | How it is expressed in the schema` (e.g. "Buyer", "Active user", "Revenue"): the domain vocabulary a query author must get right, with the dataset-qualified tables, columns and filters that actually express each term.
7. **Relationships** — FK arrows.
8. **Date/Time Fields** — TIMESTAMP type notes.
9. **Money/Numeric Fields** — units.
10. **Partitioning & Clustering** — `Dataset.Table | Partition Column | Clustering Columns | Notes` — always filter on partition to reduce bytes scanned.
11. **Cross-Dataset Query Pattern** — fenced SQL with `UNION ALL` across yearly archives.
12. **Query Anti-Patterns** — missing partition filter; `SELECT *` on wide tables; `UNION ALL` across all datasets without date filter; `LIMIT` to reduce cost (it doesn't); skipping `--dry_run` for large queries.
13. **Cost Estimation** — note `--dry_run` workflow and `--maximum_bytes_billed=1000000000` cap. BigQuery pricing ~$5/TB scanned.
14. **Common Query Patterns** — fenced SQL: Daily Summary (single year) and Cross-Year Comparison.

### Multi-database projects

If multiple DBs are used, the file has one H1 + a "Databases Used" list, then one H2 section per database following the appropriate template above. Example:

```markdown
# Database Schema Documentation

## Databases Used

1. PostgreSQL (primary data)
2. Redis (caching, sessions)
3. Elasticsearch (search)

## PostgreSQL
[full SQL template sections]

## Redis
[full Redis template sections]

## Elasticsearch
[full Elasticsearch template sections]
```

## Rules

- Keep descriptions concise and focused on querying needs.
- Use actual values from the codebase, not placeholders.
- Note gotchas (soft deletes, tenant isolation, TTLs, partitioning).
- Document the CLI command in every file (used by `query-db`).
- Identify the framework for future reference.
- **Document every table/collection/index without exception.** Join tables, migration trackers, session tables, queue tables, cache tables — all of them. Group framework/infrastructure tables in their own section if you like, but list them.
