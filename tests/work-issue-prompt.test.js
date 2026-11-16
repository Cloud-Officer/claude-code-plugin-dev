'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const { ROOT, loadHelpers, workflowScript } = require('../scripts/workflow-helpers.js')

const { buildImplementPrompt } = loadHelpers(
  workflowScript('work-issue'),
  ['REF_PATTERN', 'TRACKER_REF', 'branchName', 'buildImplementPrompt'],
  { defaultBranch: 'master' },
)

const squash = text => text.replace(/\s+/g, ' ').trim()

function workflowAuthorsBlock(skill) {
  const doc = fs.readFileSync(path.join(ROOT, 'skills', skill, 'SKILL.md'), 'utf8')
  const start = doc.indexOf('## For workflow authors')
  assert.ok(start >= 0, skill + ' has no "For workflow authors" section')
  const block = /```text\n([\s\S]*?)\n```/.exec(doc.slice(start))
  assert.ok(block, skill + ' has no text block under "For workflow authors"')
  return block[1]
}

for (const issue of [{ tracker: 'github', ref: '42' }, { tracker: 'jira', ref: 'PROJ-7' }]) {
  test('implement prompt carries the code-standards comment block verbatim (' + issue.tracker + ')', () => {
    const prompt = squash(buildImplementPrompt(issue))
    assert.ok(prompt.includes(squash(workflowAuthorsBlock('code-standards'))))
    assert.ok(prompt.includes('Never comment on code that is NOT there'))
  })

  for (const skill of ['write-tests', 'run-linters']) {
    test('implement prompt carries the ' + skill + ' block verbatim (' + issue.tracker + ')', () => {
      assert.ok(squash(buildImplementPrompt(issue)).includes(squash(workflowAuthorsBlock(skill))))
    })
  }

  test('implement prompt does not defer test rules to a skill the agent cannot load (' + issue.tracker + ')', () => {
    assert.doesNotMatch(buildImplementPrompt(issue), /rather than from a restatement here/)
  })

  test('implement prompt keeps the added-comment sweep (' + issue.tracker + ')', () => {
    assert.ok(buildImplementPrompt(issue).includes("git diff -U0 HEAD | grep -E '^\\+[[:space:]]*(#|//|/\\*|\\*)'"))
  })
}
