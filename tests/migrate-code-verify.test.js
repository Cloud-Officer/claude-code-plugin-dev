'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const { ROOT, loadHelpers, workflowScript } = require('../scripts/workflow-helpers.js')

const workflowPath = workflowScript('migrate-code')
const { tallyVerdict, verifyCoverage } = loadHelpers(workflowPath, ['tallyVerdict', 'verifyCoverage'])

const votes = (...verdicts) => verdicts.map(verdict => ({ verdict }))

test('tallyVerdict scores every verdict combination', () => {
  const cases = [
    { name: 'all faithful', votes: votes('faithful', 'faithful'), expected: 'faithful' },
    { name: 'one mismatch of two reaches the majority', votes: votes('mismatch', 'faithful'), expected: 'mismatch' },
    { name: 'tie-breaker confirms the mismatch', votes: votes('mismatch', 'faithful', 'mismatch'), expected: 'mismatch' },
    { name: 'tie-breaker sides with faithful, one dissent remains', votes: votes('mismatch', 'faithful', 'faithful'), expected: 'uncertain' },
    { name: 'both verifiers inconclusive', votes: votes('uncertain', 'uncertain'), expected: 'uncertain' },
    { name: 'inconclusive plus mismatch', votes: votes('uncertain', 'mismatch'), expected: 'mismatch' },
    { name: 'faithful plus inconclusive is not faithful', votes: votes('faithful', 'uncertain'), expected: 'uncertain' },
    { name: 'a single vote is dropped', votes: votes('faithful'), expected: null },
    { name: 'no votes are dropped', votes: votes(), expected: null },
  ]

  for (const c of cases) {
    assert.equal(tallyVerdict(c.votes), c.expected, c.name)
  }
})

test('tallyVerdict never reports faithful when a vote was not faithful', () => {
  for (const other of ['mismatch', 'uncertain', 'unrecognized']) {
    assert.notEqual(tallyVerdict(votes('faithful', other)), 'faithful', other)
  }
})

test('verifyCoverage partitions the candidate list exactly once', () => {
  const cases = [
    { candidates: 100, targets: 40, results: 40 },
    { candidates: 100, targets: 40, results: 31 },
    { candidates: 24, targets: 24, results: 0 },
    { candidates: 10, targets: 10, results: 10 },
    { candidates: 0, targets: 0, results: 0 },
  ]

  for (const c of cases) {
    const counts = verifyCoverage(c.candidates, c.targets, c.results)
    assert.equal(
      counts.verify_files + counts.unverified_files + c.results,
      c.candidates,
      JSON.stringify(c),
    )
    assert.ok(counts.verify_files >= 0 && counts.unverified_files >= 0, JSON.stringify(c))
  }
})

test('verifyCoverage does not count cap-dropped files as unverified', () => {
  assert.deepEqual(verifyCoverage(100, 40, 40), { verify_files: 60, unverified_files: 0 })
})

const skillPath = path.join(ROOT, 'skills', 'migrate-code', 'SKILL.md')

const returnedCountKeys = () => {
  const source = fs.readFileSync(workflowPath, 'utf8')
  const block = source.slice(source.lastIndexOf('\n  counts: {')).match(/counts: \{([\s\S]*?)\n {2}\}/)[1]
  return [...block.matchAll(/^\s{4}(\w+):/gm)].map(m => m[1])
}

test('SKILL documents every count the workflow returns', () => {
  const skill = fs.readFileSync(skillPath, 'utf8')
  const documented = skill.match(/counts:\s*\{([^}]*)\}/)[1].split(',').map(k => k.trim())
  assert.deepEqual(documented, returnedCountKeys())
})

test('SKILL report lists every verify item that is not faithful', () => {
  const skill = fs.readFileSync(skillPath, 'utf8')
  const bullet = skill.split('\n').find(line => line.startsWith('- **Behavioral mismatches**'))
  assert.match(bullet, /not `faithful`/)
  assert.match(bullet, /`uncertain`/)
})

test('rulebook prompt hands TODO(migrate) markers to a human, not to the read-only verify phase', () => {
  const source = fs.readFileSync(workflowPath, 'utf8')
  assert.doesNotMatch(source, /verify phase removes/)
  assert.match(source, /resolved by a human before the migration is called complete \(Step 5\)/)
})

test('schemas pin every control-flow string to its closed set', () => {
  const { FOUNDATION_SCHEMA, STRESS_SCHEMA, TRANSLATE_SCHEMA, VERIFY_SCHEMA } = loadHelpers(workflowScript('migrate-code'), ['FOUNDATION_SCHEMA', 'STRESS_SCHEMA', 'TRANSLATE_SCHEMA', 'VERIFY_SCHEMA'])
  const levels = ['high', 'medium', 'low']

  assert.deepEqual(FOUNDATION_SCHEMA.properties.dependency_order.items.properties.est_complexity.enum, ['XS', 'S', 'M', 'L', 'XL'])
  assert.deepEqual(FOUNDATION_SCHEMA.properties.gap_inventory.items.properties.risk.enum, levels)
  assert.deepEqual(STRESS_SCHEMA.properties.systemic_issues.items.properties.severity.enum, levels)
  assert.deepEqual(TRANSLATE_SCHEMA.properties.status.enum, ['ported', 'skipped-exists', 'blocked'])
  assert.deepEqual(TRANSLATE_SCHEMA.properties.review_verdict.enum, ['pass', 'changes-applied', 'needs-human'])
  assert.deepEqual(VERIFY_SCHEMA.properties.verdict.enum, ['faithful', 'mismatch', 'uncertain'])
  assert.deepEqual(VERIFY_SCHEMA.properties.mismatches.items.properties.severity.enum, levels)
})
