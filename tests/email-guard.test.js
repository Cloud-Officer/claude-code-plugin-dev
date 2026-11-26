'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { decide, isComposeTool, visibleText } = require('../hooks/email-guard.js')

const DRAFT = 'mcp__google-workspace__draft_gmail_message'
const GOOD = '<p>Hi Sam,</p><p>Here is where things stand:</p><ul><li>Release 2.4 shipped Monday</li><li>QA starts on 2.5 next week</li></ul><p>Thanks,<br>Yves</p>'
const run = (tool_input, tool_name = DRAFT, env = {}) => decide({ tool_name, tool_input }, env)
const reason = (...args) => run(...args)?.hookSpecificOutput?.permissionDecisionReason ?? ''

test('allows a clean HTML draft', () => {
  assert.strictEqual(run({ to: 'sam@example.com', subject: 'Release status for week 47', body: GOOD, body_format: 'html' }), null)
})

test('denies em dashes, en dashes and double hyphens in subject or body', () => {
  assert.match(reason({ subject: 'Weekly report — sprint 12', body: GOOD, body_format: 'html' }), /dash in subject/)
  assert.match(reason({ subject: 'Status', body: '<p>Shipped Mon–Wed</p>', body_format: 'html' }), /dash in body/)
  assert.match(reason({ subject: 'Status', body: '<p>Shipped -- finally</p>', body_format: 'html' }), /dash in body/)
})

test('ignores dashes inside markup, comments and addresses', () => {
  assert.strictEqual(run({ to: 'a--b@example.com', subject: 'Hi', body: '<!-- x --><p><a href="https://x.io/a--b">link</a></p>', body_format: 'html' }), null)
})

test('visibleText drops tags and comments in one pass, keeping stray angle brackets', () => {
  assert.strictEqual(visibleText('<p>a</p><ul><li>b</li></ul>'), 'a\nb\n')
  assert.strictEqual(visibleText('x<!<!---->-- y -->z'), 'x-- y -->z')
  assert.strictEqual(visibleText('<!-- open forever'), '')
  assert.strictEqual(visibleText('5 < 6 is true'), '5 < 6 is true')
  assert.match(reason({ subject: 'Hi', body: '<p>5 < 6 — yes</p>', body_format: 'html' }), /dash in body/)
})

test('denies Markdown bullets, headings, bold and links', () => {
  const body = 'Hi Sam,\n\n## Update\n- one\n- two\n**Done** see [here](https://x.io)'
  const text = reason({ subject: 'Update', body, body_format: 'html' })
  assert.match(text, /Markdown bullet/)
  assert.match(text, /Markdown heading/)
  assert.match(text, /Markdown bold/)
  assert.match(text, /Markdown link/)
  assert.match(reason({ subject: 'Update', body: '<p>• one</p>', body_format: 'html' }), /Markdown bullet/)
})

test('denies a plain-text body format, including Graph contentType Text', () => {
  assert.match(reason({ subject: 'Hi', body: 'Hello there.', body_format: 'plain' }), /body_format is "plain"/)
  assert.match(reason({ message: { subject: 'Hi', body: { contentType: 'Text', content: 'Hello there.' } } }, 'mcp__ms365__send-mail'), /contentType is "Text"/)
  assert.strictEqual(run({ message: { subject: 'Hi', body: { contentType: 'HTML', content: GOOD } } }, 'mcp__ms365__send-mail'), null)
})

test('only checks mail compose tools', () => {
  assert.ok(isComposeTool('mcp__google-workspace__send_gmail_message'))
  assert.ok(isComposeTool('mcp__claude_ai_Gmail__create_draft'))
  assert.ok(isComposeTool('mcp__ms365__send-mail'))
  assert.ok(!isComposeTool('mcp__google-workspace__search_gmail_messages'))
  assert.ok(!isComposeTool('mcp__claude_ai_Gmail__list_drafts'))
  assert.ok(!isComposeTool('mcp__slack__send_message'))
  assert.ok(!isComposeTool('Bash'))
  assert.strictEqual(run({ query: 'from:sam —' }, 'mcp__google-workspace__search_gmail_messages'), null)
})

test('CO_DEV_EMAIL_GUARD=off disables the guard', () => {
  assert.strictEqual(run({ subject: 'a — b', body: GOOD }, DRAFT, { CO_DEV_EMAIL_GUARD: 'off' }), null)
})

test('runs as a hook: deny JSON on stdout, exit 0, silent on bad input', () => {
  const script = path.join(__dirname, '..', 'hooks', 'email-guard.js')
  const deny = spawnSync('node', [script], { input: JSON.stringify({ tool_name: DRAFT, tool_input: { subject: 'a — b', body: GOOD, body_format: 'html' } }), env: { ...process.env, CO_DEV_EMAIL_GUARD: '' } })
  assert.strictEqual(deny.status, 0)
  assert.strictEqual(JSON.parse(deny.stdout).hookSpecificOutput.permissionDecision, 'deny')

  const junk = spawnSync('node', [script], { input: 'not json' })
  assert.strictEqual(junk.status, 0)
  assert.strictEqual(junk.stdout.length, 0)
})
