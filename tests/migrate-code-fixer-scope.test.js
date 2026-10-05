const assert = require('node:assert/strict')
const path = require('node:path')
const { test } = require('node:test')
const { extractWorkflowFunctions } = require('../scripts/extract-workflow-functions.js')

const workflowPath = path.join(__dirname, '..', 'skills', 'migrate-code', 'migrate-code.workflow.js')
const { buildFixerPrompt, testFixerPrompt } = extractWorkflowFunctions(workflowPath, ['fence', 'safeRepoPath', 'buildFixerPrompt', 'testFixerPrompt'])

const SCOPE_RULE = 'edit only files inside the repo root; if the cause lies in a file outside it, touch nothing there and return fixed=false with the path in notes'

const buildCases = [
  { name: 'all paths in repo', group: { signature: 'TS2304', files: ['src/a.ts'] } },
  { name: 'one path escapes the repo', group: { signature: 'TS2304', files: ['src/a.ts', '../shared/lib.ts'] } },
  { name: 'every path escapes the repo', group: { signature: 'TS2304', files: ['/etc/x'] } },
  { name: 'no files reported', group: { signature: 'TS2304' } },
]

const testCases = [
  { name: 'file in repo', failure: { test: 't1', file: 'src/a.test.ts', why: 'boom' } },
  { name: 'file escapes the repo', failure: { test: 't1', file: '../shared/lib.test.ts', why: 'boom' } },
  { name: 'absolute file path', failure: { test: 't1', file: '/etc/x' } },
  { name: 'no file reported', failure: { test: 't1' } },
]

test('build fixer prompt always confines writes to the repo root', () => {
  for (const c of buildCases) {
    const prompt = buildFixerPrompt(c.group, 'CTX')
    assert.ok(prompt.includes(SCOPE_RULE), c.name)
    assert.ok(!/discover from the build output/.test(prompt), c.name)
  }
})

test('test fixer prompt always confines writes to the repo root', () => {
  for (const c of testCases) {
    const prompt = testFixerPrompt(c.failure, 'CTX')
    assert.ok(prompt.includes(SCOPE_RULE), c.name)
    assert.ok(!/discover from the test output/.test(prompt), c.name)
  }
})

test('build fixer prompt lists only in-repo files and flags the drop', () => {
  const prompt = buildFixerPrompt({ signature: 'TS2304', files: ['src/a.ts', '../shared/lib.ts'] }, 'CTX')
  assert.ok(prompt.includes('<untrusted id="affected_files">src/a.ts</untrusted>'))
  assert.ok(!prompt.includes('shared/lib.ts'))
  assert.ok(prompt.includes('paths outside the repo root were dropped'))
})

test('test fixer prompt omits an out-of-repo file and flags the drop', () => {
  const prompt = testFixerPrompt({ test: 't1', file: '../shared/lib.test.ts' }, 'CTX')
  assert.ok(!prompt.includes('lib.test.ts'))
  assert.ok(prompt.includes('outside the repo root and was dropped'))
})
