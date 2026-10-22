'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')
const { declarationSource, loadHelpers, workflowScripts } = require('../scripts/workflow-helpers.js')

const SHARED = { normSev: 2, keepFinding: 2, chunk: 2, joinVerdicts: 2, safeAgent: 5, readArgs: 5 }

function copiesOf(name) {
  const copies = []

  for (const file of workflowScripts()) {
    let source

    try {
      source = declarationSource(fs.readFileSync(file, 'utf8'), name)
    } catch {
      continue
    }

    copies.push({ skill: path.basename(file, '.workflow.js'), file, source })
  }

  return copies
}

describe('inline helper parity', () => {
  for (const [name, expected] of Object.entries(SHARED)) {
    it(name + ' is byte-identical in every workflow that defines it', () => {
      const copies = copiesOf(name)

      assert.ok(copies.length >= expected, name + ' found in ' + copies.map(c => c.skill).join(', '))
      for (const copy of copies.slice(1)) assert.equal(copy.source, copies[0].source, copy.skill + ' drifted from ' + copies[0].skill)
    })
  }
})

describe('shared review helpers', () => {
  for (const { skill, file } of copiesOf('joinVerdicts')) {
    const { normSev, chunk, joinVerdicts } = loadHelpers(file, ['normSev', 'chunk', 'joinVerdicts'])
    const verdict = (finding_id, evidence) => ({ finding_id, decision: 'CONFIRM', confidence_score: 75, evidence })

    it(skill + ' normSev maps any spelling onto the five buckets', () => {
      assert.equal(normSev('Critical'), 'critical')
      assert.equal(normSev('CRITICAL — data loss'), 'critical')
      assert.equal(normSev('High'), 'high')
      assert.equal(normSev('Med'), 'medium')
      assert.equal(normSev('medium'), 'medium')
      assert.equal(normSev('Low'), 'low')
      assert.equal(normSev('anything else'), 'info')
      assert.equal(normSev(undefined), 'info')
    })

    it(skill + ' chunk splits into runs of n and keeps the short tail', () => {
      assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
      assert.deepEqual(chunk([1, 2], 5), [[1, 2]])
      assert.deepEqual(chunk([], 3), [])
    })

    it(skill + ' joinVerdicts matches each unique finding to its own verdict', () => {
      const { byId, ambiguous } = joinVerdicts([{ id: 'A' }, { id: 'B' }], [verdict('B', 'b'), verdict('A', 'a')])

      assert.equal(ambiguous.size, 0)
      assert.equal(byId.get('A').evidence, 'a')
      assert.equal(byId.get('B').evidence, 'b')
    })

    it(skill + ' joinVerdicts refuses to attribute a verdict to a duplicated finding id', () => {
      const { byId, ambiguous } = joinVerdicts([{ id: 'A' }, { id: 'A' }, { id: 'B' }], [verdict('A', 'a'), verdict('B', 'b')])

      assert.deepEqual([...ambiguous], ['A'])
      assert.equal(byId.has('A'), false)
      assert.equal(byId.get('B').evidence, 'b')
    })

    it(skill + ' joinVerdicts refuses a finding that drew more than one verdict', () => {
      const { byId, ambiguous } = joinVerdicts([{ id: 'A' }, { id: 'B' }], [verdict('A', 'a'), verdict('A', 'elsewhere'), verdict('B', 'b')])

      assert.deepEqual([...ambiguous], ['A'])
      assert.equal(byId.has('A'), false)
      assert.equal(byId.get('B').evidence, 'b')
    })

    it(skill + ' joinVerdicts tolerates missing and empty inputs', () => {
      for (const c of [
        { name: 'both empty', issues: [], verdicts: [], matched: 0 },
        { name: 'both undefined', issues: undefined, verdicts: undefined, matched: 0 },
        { name: 'no verdict returned', issues: [{ id: 'A' }], verdicts: [], matched: 0 },
        { name: 'verdict for a finding that is gone', issues: [], verdicts: [verdict('A', 'a')], matched: 1 },
      ]) {
        const { byId, ambiguous } = joinVerdicts(c.issues, c.verdicts)

        assert.equal(ambiguous.size, 0, c.name)
        assert.equal(byId.size, c.matched, c.name)
      }
    })
  }
})
