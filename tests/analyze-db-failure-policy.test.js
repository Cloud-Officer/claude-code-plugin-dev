'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'analyze-db', 'SKILL.md'), 'utf8')
const policy = skill.split('\n').find((l) => l.startsWith('- **Failure policy**'))

describe('analyze-db failure policy', () => {
  it('states the rule', () => {
    assert.ok(policy, 'analyze-db has no failure policy rule')
  })

  it('does not stop a step on every empty result', () => {
    assert.doesNotMatch(policy, /fails or returns nothing stops/)
  })

  it('stops only when the step needs a value to proceed', () => {
    assert.match(policy, /returns nothing where the step needs a value to proceed/)
    assert.match(policy, /connection check/)
    assert.match(policy, /schema listing/)
  })

  it('records empty sampling and SCAN batches as valid results', () => {
    assert.match(policy, /empty result from a per-object sampling or `SCAN` batch is a valid result/)
    assert.match(policy, /0 rows/)
    assert.match(policy, /no keys/)
  })
})
