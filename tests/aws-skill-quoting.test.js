'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'aws', 'SKILL.md'), 'utf8')
const rule = skill.split('\n').find((line) => line.startsWith('Every value substituted into an `aws` command'))

const valuePattern = () => {
  const match = rule && rule.match(/`(\^[^`]*\$)`/)
  assert.ok(match, 'aws skill states no value pattern for the CLI fallback')
  return new RegExp(match[1])
}

describe('aws CLI fallback value rule', () => {
  it('sits beside the fallback table and requires single quoting', () => {
    assert.ok(rule)
    assert.match(rule, /single-quoted/)
    const tableEnd = skill.indexOf('| Regional availability')
    const commonExamples = skill.indexOf('**Common CLI examples:**')
    const ruleAt = skill.indexOf(rule)
    assert.ok(ruleAt > tableEnd && ruleAt < commonExamples)
  })

  it('accepts ordinary AWS identifiers', () => {
    const pattern = valuePattern()
    for (const ok of ['i-0abc123', 'my-bucket', 's3://bucket/key.txt', 'arn:aws:iam::123456789012:role/Admin', 'us-east-1', 'Name=tag:Env', 'user@example.com', 'a']) assert.match(ok, pattern, ok)
  })

  it('rejects shell metacharacters, whitespace and a leading hyphen', () => {
    const pattern = valuePattern()
    for (const bad of ['$(id)', '`id`', '--profile=evil', '-x', 'a b', "a'b", 'a;rm', 'a|b', 'a&b', 'a\nb', '']) assert.doesNotMatch(bad, pattern, JSON.stringify(bad))
  })
})
