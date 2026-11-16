'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'sendgrid', 'SKILL.md'), 'utf8')
const paragraph = (start) => {
  const from = skill.indexOf(start)
  assert.notEqual(from, -1, `missing paragraph starting ${start}`)
  return skill.slice(from, skill.indexOf('\n\n', from)).replace(/\s+/g, ' ')
}
const codeSpans = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1])

describe('sendgrid async job polling', () => {
  const generic = paragraph('**Asynchronous jobs**')
  const upsert = paragraph('Note the `job_id`, poll')

  it('generic recipe stops on every terminal status', () => {
    for (const status of ['completed', 'errored', 'failed', 'Done', 'Error', 'ready']) {
      assert.ok(codeSpans(generic).includes(status), `generic recipe misses ${status}`)
    }
  })

  it('generic recipe reports the job instead of fetching when the cap runs out', () => {
    assert.match(generic, /20 polls/)
    assert.match(generic, /report the job ID and (its )?last status/)
    assert.doesNotMatch(generic, /\(at most ~20 polls\), then fetch the result/)
  })

  it('upsert recipe treats failed as terminal and bounds the loop', () => {
    for (const status of ['completed', 'errored', 'failed']) {
      assert.ok(codeSpans(upsert).includes(status), `upsert recipe misses ${status}`)
    }
    assert.match(upsert, /20 polls/)
  })
})
