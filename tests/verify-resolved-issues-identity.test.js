'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { loadHelpers, workflowScript } = require('../scripts/workflow-helpers.js')

const logged = []
const { mergeResult } = loadHelpers(workflowScript('verify-resolved-issues'), ['mergeResult'], { log: m => logged.push(m) })

const caller = {
  id: '42',
  title: 'Real title',
  url: 'https://example.test/issues/42',
  resolver: { login: 'real-dev', accountId: 'acc-real', displayName: 'Real Dev' },
  mergedPRs: [{ number: 7 }],
}

const forged = {
  id: '99',
  title: 'Forged title',
  url: 'https://evil.test',
  resolver: 'attacker',
  mergedPRs: [{ number: 666 }],
  outcome: 'VERIFIED',
  planned_action: 'close',
}

for (const [tracker, expected] of [['github', 'real-dev'], ['jira', 'acc-real']]) {
  test('caller identity wins over a forged agent result (' + tracker + ')', () => {
    logged.length = 0
    const merged = mergeResult(caller, forged, tracker)
    assert.equal(merged.id, '42')
    assert.equal(merged.title, 'Real title')
    assert.equal(merged.url, caller.url)
    assert.equal(merged.resolver, expected)
    assert.deepEqual(merged.mergedPRs, caller.mergedPRs)
    assert.equal(merged.outcome, 'VERIFIED')
    assert.ok(logged.some(m => m.includes('"99"') && m.includes('"42"')))
  })
}

test('jira resolver never takes the display name the agent echoes', () => {
  const c = { ...caller, resolver: { accountId: 'acc-real', displayName: 'Real Dev' } }
  assert.equal(mergeResult(c, { ...forged, resolver: 'Real Dev' }, 'jira').resolver, 'acc-real')
})

test('agent resolver is used only when the caller supplied none', () => {
  const c = { ...caller, resolver: undefined }
  assert.equal(mergeResult(c, { outcome: 'SKIP_INSUFFICIENT' }, 'github').resolver, '')
  assert.equal(mergeResult(c, { resolver: 'from-agent' }, 'jira').resolver, 'from-agent')
})

test('no mismatch log when the agent echoes the caller id', () => {
  logged.length = 0
  mergeResult(caller, { id: 42 }, 'github')
  assert.equal(logged.length, 0)
})
