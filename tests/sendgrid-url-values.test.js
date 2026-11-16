'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'sendgrid', 'SKILL.md'), 'utf8')
const conventions = skill.split('## Request Conventions\n')[1].split('\n## ')[0]
const rule = conventions.split('\n\n').find((p) => p.startsWith('**Path and query values.**'))

const codeSpans = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1])
const rejected = () => {
  const clause = rule.split(/reject any value containing/)[1].split(':')[0]
  const spans = codeSpans(clause)
  if (/a backtick/.test(clause)) spans.push('`')
  return spans
}

const buildUrl = (value) => {
  if (rejected().some((c) => value.includes(c))) return null
  return `https://api.sendgrid.com/v3/suppression/bounces/${encodeURIComponent(value)}`
}

describe('sendgrid path and query values', () => {
  it('Request Conventions states the encoding and rejection rule', () => {
    assert.ok(rule, 'Request Conventions has no **Path and query values.** paragraph')
    assert.match(rule, /percent-encoded/)
    assert.ok(rule.includes('jane%40example.com'))
    for (const c of ['$', '"']) assert.ok(rejected().includes(c), `rule does not reject ${c}`)
    assert.ok(rejected().includes('`'), 'rule does not reject a backtick')
  })

  it('covers values taken from API responses as well as user input', () => {
    assert.match(rule, /API response/)
  })

  it('rejects values that would expand inside a double-quoted curl URL', () => {
    for (const bad of ['$(id)@example.com', '`id`@example.com', 'a"b@example.com', '${HOME}@x.com']) {
      assert.equal(buildUrl(bad), null, bad)
    }
  })

  it('encodes values that would otherwise redirect the request to another endpoint', () => {
    for (const value of ['../../teammates/admin', 'jane@example.com?x=1', 'jane@example.com#frag', 'a b&c=d']) {
      const url = buildUrl(value)
      assert.ok(url, value)
      const segment = url.slice('https://api.sendgrid.com/v3/suppression/bounces/'.length)
      assert.doesNotMatch(segment, /[/?#& @=]/, value)
    }
    assert.equal(buildUrl('jane@example.com'), 'https://api.sendgrid.com/v3/suppression/bounces/jane%40example.com')
  })
})
