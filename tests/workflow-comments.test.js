'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')
const { workflowScripts } = require('../scripts/workflow-helpers.js')

describe('workflow script comments', () => {
  for (const file of workflowScripts()) {
    it(path.basename(file) + ' has no comment longer than one line', () => {
      const lines = fs.readFileSync(file, 'utf8').split('\n')
      const isComment = line => /^\s*(\/\/|\/\*|\*)/.test(line)
      const blocks = lines.map((line, i) => i + 1).filter(n => isComment(lines[n - 1]) && isComment(lines[n - 2] ?? ''))

      assert.deepEqual(blocks, [], 'multi-line comment continues at line(s) ' + blocks.join(', '))
    })
  }
})
