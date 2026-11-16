'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'analyze-db', 'SKILL.md'), 'utf8')
const orderRule = skill.split('\n').find((l) => l.startsWith('**Row order'))

const listSections = [
  ['SQL', 'Relationships'],
  ['SQL', 'Soft Deletes'],
  ['MongoDB', 'References (Relationships)'],
  ['MongoDB', 'Indexes'],
  ['Redis', 'Data Structures'],
  ['BigQuery', 'Relationships'],
]

const templateSection = (engine, name) => {
  const template = skill.split(`\n### ${engine}`)[1].split('\n### ')[0]
  return template.split('\n').find((l) => l.includes(`**${name}**`))
}

describe('analyze-db output ordering', () => {
  it('states one ordering rule', () => {
    assert.ok(orderRule, 'analyze-db has no row-order rule')
  })

  it('extends the ordering rule to every list, not just tables', () => {
    assert.match(orderRule, /every table and every list in every template below/)
  })

  it('gives list items a bytewise sort key', () => {
    assert.match(orderRule, /sort list items by their first token/)
    assert.match(orderRule, /LC_ALL=C/)
  })

  it('keeps the Databases Used list in template order', () => {
    assert.match(orderRule, /Databases Used/)
  })

  for (const [engine, name] of listSections) {
    it(`${engine} ${name} is a list, so only the list clause orders it`, () => {
      const line = templateSection(engine, name)
      assert.ok(line, `${engine} template has no ${name} section`)
      assert.doesNotMatch(line, /`[^`]+ \| [^`]+`/, `${engine} ${name} is a table, not a list`)
    })
  }
})
