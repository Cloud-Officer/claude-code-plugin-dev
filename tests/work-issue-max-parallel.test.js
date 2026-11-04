'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const scriptPath = path.join(__dirname, '..', 'skills', 'work-issue', 'work-issue.workflow.js')
const body = fs.readFileSync(scriptPath, 'utf8').replace(/^export const meta[\s\S]*?^}\n/m, '')

const run = async (args) => {
  let live = 0
  let peak = 0
  const agent = async () => {
    live += 1
    peak = Math.max(peak, live)
    await new Promise((resolve) => setTimeout(resolve, 5))
    live -= 1
    return { success: true, summary: 'done', branch: 'ignored' }
  }
  const workflow = new Function('args', 'log', 'phase', 'agent', `return (async () => {${body}})()`)
  const result = await workflow(args, () => {}, () => {}, agent)
  return { result, peak }
}

const issues = (count) => Array.from({ length: count }, (_, i) => ({ ref: `DEV-${i + 1}`, tracker: 'jira' }))

describe('work-issue workflow caps parallel agents', () => {
  it('never runs more agents than maxParallel', async () => {
    const { result, peak } = await run({ defaultBranch: 'master', maxParallel: 3, issues: issues(10) })
    assert.equal(peak, 3)
    assert.equal(result.results.length, 10)
    assert.deepEqual(result.results.map((r) => r.branch), issues(10).map((i) => i.ref))
  })

  it('defaults to 4 when maxParallel is missing or invalid', async () => {
    assert.equal((await run({ defaultBranch: 'master', issues: issues(9) })).peak, 4)
    assert.equal((await run({ defaultBranch: 'master', maxParallel: 0, issues: issues(9) })).peak, 4)
    assert.equal((await run({ defaultBranch: 'master', maxParallel: 'x', issues: issues(9) })).peak, 4)
  })

  it('runs fewer agents than the cap when there are fewer issues', async () => {
    assert.equal((await run({ defaultBranch: 'master', maxParallel: 8, issues: issues(2) })).peak, 2)
  })
})
