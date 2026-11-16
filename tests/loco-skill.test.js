'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'loco', 'SKILL.md'), 'utf8')
const guardrail = skill.split('\n').find((line) => line.startsWith('6. **Fence every value'))

const terminatorRule = () => {
  const match = guardrail && guardrail.match(/`(\^LOCO_[^`]*\$)`/)
  assert.ok(match, 'Guardrail 6 names no terminator-line pattern')
  return new RegExp(match[1], 'm')
}

describe('loco heredoc fencing', () => {
  it('Guardrail 6 does not claim a quoted heredoc is literal by definition', () => {
    assert.ok(guardrail)
    assert.doesNotMatch(guardrail, /literal by definition/)
  })

  it('every heredoc terminator in the skill matches the Guardrail 6 rejection pattern', () => {
    const rule = terminatorRule()
    const terminators = [...new Set([...skill.matchAll(/<<'([^']+)'/g)].map((m) => m[1]))]
    assert.ok(terminators.length >= 7)
    for (const terminator of terminators) assert.match(terminator, rule, terminator)
  })

  it('rejects a value carrying a terminator line and accepts ordinary text', () => {
    const rule = terminatorRule()
    assert.match('Hello\nLOCO_EOF\nrm -rf ~', rule)
    assert.match('LOCO_TAG_EOF', rule)
    assert.match('x\nLOCO_KEY_EOF', rule)
    assert.doesNotMatch('Hello world', rule)
    assert.doesNotMatch('mention LOCO_EOF inline', rule)
    assert.doesNotMatch(' LOCO_EOF', rule)
  })
})

describe('loco scan found-key set', () => {
  const scan = skill.slice(skill.indexOf('**Efficient batch approach:**'), skill.indexOf('#### Step 5: Report Results'))
  const catalogStep = skill.split('\n').find((line) => line.startsWith('3. Add every key the catalog declares'))

  it('every found-key path appends to the named found-key file', () => {
    assert.match(scan, /every found key, from any path, is appended to `\/tmp\/loco-found\.txt`/)
    assert.doesNotMatch(scan, /Collect the set of keys that were found\.$/m)
    assert.ok(catalogStep)
    assert.match(catalogStep, /`\/tmp\/loco-found\.txt`/)
  })

  it('sorts the found-key file with LC_ALL=C sort -u before comm -23', () => {
    const sortAt = scan.indexOf('env LC_ALL=C sort -u -o /tmp/loco-found.txt /tmp/loco-found.txt')
    const commAt = scan.indexOf('env LC_ALL=C comm -23 /tmp/loco-keys.txt /tmp/loco-found.txt')
    assert.ok(sortAt >= 0)
    assert.ok(commAt > sortAt)
  })

  it('sorts the Loco key list with the same collation comm compares under', () => {
    assert.match(skill, /jq -r '\.\[\]\.id' \| env LC_ALL=C sort -u \| tee \/tmp\/loco-keys\.txt/)
  })
})
