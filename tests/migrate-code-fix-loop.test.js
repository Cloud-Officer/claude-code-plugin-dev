const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const { loadHelpers, workflowScript } = require('../scripts/workflow-helpers.js')

function harness(runnerResults, fixerResult = { fixed: true }) {
  const logs = []
  const runs = []
  const safeAgent = (prompt, opts) => {
    if (opts.label.startsWith('build:')) {
      runs.push(opts.label)
      return Promise.resolve(runnerResults[runs.length - 1] ?? null)
    }
    return Promise.resolve(fixerResult)
  }
  const parallel = thunks => Promise.all(thunks.map(t => t()))
  const { runFixLoop } = loadHelpers(workflowScript('migrate-code'), ['runFixLoop'], { safeAgent, parallel, log: m => logs.push(m), maxFixesPerRound: 12, FIX_SCHEMA: {} })
  const run = (maxRounds = 2) => runFixLoop({
    cmd: 'make',
    phaseName: 'Compile',
    maxRounds,
    itemNoun: 'error group(s)',
    idleState: { ran: false, clean: false },
    idleLog: 'idle',
    silentState: { ran: false, clean: false, summary: 'silent' },
    runnerSchema: {},
    runnerLabel: 'build:round-',
    runnerPrompt: 'build',
    isDone: s => s.clean,
    doneLog: round => 'Build clean after ' + round + ' round(s).',
    itemsOf: s => s.error_groups,
    fixerLabel: g => 'fix:' + g.signature,
    fixerPrompt: g => g.signature,
    noProgressLog: 'no progress',
  })

  return { run, logs, runs }
}

const failing = { ran: true, clean: false, error_groups: [{ signature: 'E1' }] }
const clean = { ran: true, clean: true }

describe('migrate-code runFixLoop', () => {
  it('re-runs the build after the last fix round so the state is current', async () => {
    const h = harness([failing, failing, clean])
    const result = await h.run(2)

    assert.equal(h.runs.length, 3)
    assert.equal(result.state, clean)
    assert.equal(result.rounds_exhausted, false)
  })

  it('reports an exhausted budget when the final re-check is still failing', async () => {
    const stillFailing = { ran: true, clean: false, error_groups: [{ signature: 'E2' }] }
    const h = harness([failing, failing, stillFailing])
    const result = await h.run(2)

    assert.equal(result.state, stillFailing)
    assert.equal(result.rounds_exhausted, true)
    assert.ok(h.logs.includes('Compile stopped after 2 round(s) without a clean result.'), h.logs.join('\n'))
  })

  it('does not re-run or flag exhaustion when the build comes back clean', async () => {
    const h = harness([failing, clean])
    const result = await h.run(4)

    assert.equal(h.runs.length, 2)
    assert.equal(result.rounds_exhausted, false)
  })

  it('does not re-run after a round in which no fixer made progress', async () => {
    const h = harness([failing, failing, failing], { fixed: false })
    const result = await h.run(3)

    assert.equal(h.runs.length, 1)
    assert.equal(result.rounds_exhausted, false)
    assert.ok(h.logs.includes('no progress'))
  })

  it('logs a failure the runner reported without listing any item', async () => {
    const h = harness([{ ran: true, clean: false, error_groups: [] }])
    const result = await h.run(3)

    assert.equal(h.runs.length, 1)
    assert.equal(result.rounds_exhausted, false)
    assert.ok(h.logs.some(m => /reported a failure but listed no error group\(s\)/.test(m)), h.logs.join('\n'))
  })

  it('returns the idle state without running when there is no command', async () => {
    const logs = []
    const { runFixLoop } = loadHelpers(workflowScript('migrate-code'), ['runFixLoop'], { safeAgent: () => assert.fail('dispatched'), log: m => logs.push(m), maxFixesPerRound: 12 })
    const result = await runFixLoop({ cmd: '', idleState: { ran: false }, idleLog: 'idle' })

    assert.deepEqual(result.state, { ran: false })
    assert.equal(result.rounds_exhausted, false)
    assert.deepEqual(logs, ['idle'])
  })
})
