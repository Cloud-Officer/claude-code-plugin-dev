'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skillsDir = path.join(__dirname, '..', 'skills')
const readSkill = (name) => fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8')

const invocationModeSection = (text) => {
  const section = text.split(/^## Invocation Mode\s*$/m)[1]
  return section ? section.split(/^## /m)[0] : ''
}

describe('review-readme invocation mode', () => {
  const text = readSkill('review-readme')
  const section = invocationModeSection(text)

  it('defines an Invocation Mode section', () => {
    assert.notEqual(section, '')
  })

  it('names the closed set of mode tokens', () => {
    for (const token of ['mode=interactive', 'mode=apply', 'mode=review-only']) {
      assert.ok(section.includes(`\`${token}\``), `missing ${token}`)
    }
  })

  it('falls back to interactive for any other argument', () => {
    assert.match(section, /any other (argument|value)[^\n]*`mode=interactive`/i)
  })

  it('lets review-only win when both apply and review-only are present', () => {
    assert.match(section, /both `mode=apply` and `mode=review-only`[^\n]*`mode=review-only`/)
  })

  it('no longer keys behaviour off descriptive instructions', () => {
    assert.doesNotMatch(text, /apply-fixes-non-interactively instruction/)
    assert.doesNotMatch(text, /with a review-only instruction/)
    assert.doesNotMatch(text, /arguments say to apply fixes non-interactively/)
  })

  it('gates the approval prompt and both rules on the mode tokens', () => {
    assert.match(text, /\*\*Ask the user before making changes \(skip only in `mode=apply`/)
    assert.match(text, /\*\*Ask before modifying, unless the mode is `mode=apply`\*\*/)
    assert.match(text, /\*\*Review-only invocation\*\* - In `mode=review-only`/)
  })
})

describe('code-review-deep deep documentation pass', () => {
  it('invokes the doc skills with the mode=review-only token', () => {
    const text = readSkill('code-review-deep')
    assert.match(text, /with exactly the argument `mode=review-only`, [^\n]*:\n\n1\. `review-readme`/)
  })
})
