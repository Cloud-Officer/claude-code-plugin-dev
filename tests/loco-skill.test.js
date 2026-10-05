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
