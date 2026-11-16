'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'sprint-quick-wins', 'SKILL.md'), 'utf8')

const section = (heading) => {
  const start = skill.indexOf(`## ${heading}`)
  assert.ok(start >= 0, `missing section ${heading}`)
  const end = skill.indexOf('\n## ', start + 1)
  return skill.slice(start, end < 0 ? undefined : end)
}

describe('sprint-quick-wins results table', () => {
  it('Step 7 prints a numbered table with a fixed sort key', () => {
    const step7 = section('Step 7')
    assert.match(step7, /one numbered table, ordered by repo then issue ref \(bytewise\)/)
    assert.doesNotMatch(step7, /Print one table:/)
  })

  it('Step 8 picks only numbers shown in the Step 7 table', () => {
    assert.match(section('Step 8'), /\*\*Pick by number\*\*[^\n]*Step 7 table[^\n]*accept only numbers shown/)
  })
})
