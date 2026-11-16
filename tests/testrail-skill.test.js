'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'testrail', 'SKILL.md'), 'utf8')
const userValuesRule = () => {
  const block = skill.split('**User values.**')[1]
  assert.ok(block, 'Request Conventions has no **User values.** rule')
  return block.split('\n**')[0]
}

describe('testrail user-value encoding', () => {
  it('URL-encodes every user value with jq @uri', () => {
    const rule = userValuesRule()
    assert.match(rule, /jq -rn --arg v '[^']*' '\$v\|@uri'/)
    assert.match(rule, /&filter=\$v"/)
  })

  it('single-quotes user values in commands, never double-quotes them', () => {
    assert.match(userValuesRule(), /single-quoted, never double-quoted/)
  })

  it('does not reduce email encoding to escaping only @', () => {
    assert.doesNotMatch(skill, /%40/)
    const row = skill.split('\n').find((line) => line.includes('`get_user_by_email&email=<e>`'))
    assert.match(row, /User values/)
  })

  it('never double-quotes an attachment or output path', () => {
    assert.doesNotMatch(skill, /-F "attachment=@/)
    assert.doesNotMatch(skill, /-o <[^`]*>/)
    assert.ok([...skill.matchAll(/-F 'attachment=@[^']+'/g)].length >= 3)
    assert.ok([...skill.matchAll(/-o '<[^']+>[^']*'/g)].length >= 2)
  })
})
