'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const { ROOT, loadHelpers, workflowScript } = require('../scripts/workflow-helpers.js')

const workflowPath = workflowScript('migrate-code')
const source = fs.readFileSync(workflowPath, 'utf8')
const squash = text => text.replace(/\s+/g, ' ').trim()

function workflowAuthorsBlock() {
  const standards = fs.readFileSync(path.join(ROOT, 'skills', 'code-standards', 'SKILL.md'), 'utf8')
  const block = /## For workflow authors[\s\S]*?```text\n([\s\S]*?)\n```/.exec(standards)
  assert.ok(block, 'code-standards has no text block under "For workflow authors"')
  return block[1]
}

test('COMMENT_DISCIPLINE carries the code-standards comment block verbatim', () => {
  const { COMMENT_DISCIPLINE } = loadHelpers(workflowPath, ['COMMENT_DISCIPLINE'])

  assert.ok(squash(COMMENT_DISCIPLINE).includes(squash(workflowAuthorsBlock())))
  assert.match(COMMENT_DISCIPLINE, /`TODO\(migrate\):` markers are exempt/)
})

test('foundation and translate prompts both embed COMMENT_DISCIPLINE', () => {
  const uses = source.match(/^\s+COMMENT_DISCIPLINE,$/gm) || []

  assert.equal(uses.length, 2)
})

test('no paraphrased comment policy remains in the workflow', () => {
  assert.doesNotMatch(source, /stated verbatim as: default to no comment/)
  assert.doesNotMatch(source, /Comment discipline: default to NO comment/)
})
