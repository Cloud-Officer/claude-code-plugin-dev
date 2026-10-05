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

function workflowAuthorsBlock() {
  const standards = fs.readFileSync(path.join(ROOT, 'skills', 'code-standards', 'SKILL.md'), 'utf8')
  const section = standards.slice(standards.indexOf('## For workflow authors'))
  const block = /```text\n([\s\S]*?)\n```/.exec(section)
  assert.ok(block, 'code-standards has no text block under "For workflow authors"')
  return block[1]
}

for (const issue of [{ tracker: 'github', ref: '42' }, { tracker: 'jira', ref: 'PROJ-7' }]) {
  test('implement prompt carries the code-standards comment block verbatim (' + issue.tracker + ')', () => {
    const prompt = squash(buildImplementPrompt(issue))
    assert.ok(prompt.includes(squash(workflowAuthorsBlock())))
    assert.ok(prompt.includes('Never comment on code that is NOT there'))
  })

  test('implement prompt keeps the added-comment sweep (' + issue.tracker + ')', () => {
    assert.ok(buildImplementPrompt(issue).includes("git diff -U0 | grep -E '^\\+[[:space:]]*(#|//|/\\*|\\*)'"))
  })
}
