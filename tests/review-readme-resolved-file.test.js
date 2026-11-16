'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'review-readme', 'SKILL.md'), 'utf8')

const bashBlocks = [...skill.matchAll(/^```bash\n([\s\S]*?)^```/gm)].map((m) => m[1])

describe('review-readme reads the README path Step 1 resolved', () => {
  it('defines readme_file from the case-insensitive probe', () => {
    assert.match(skill, /ls -1 README\.md readme\.md Readme\.md/)
    assert.match(skill, /`readme_file`:/)
  })

  it('greps the H2 sections of {readme_file}', () => {
    assert.ok(bashBlocks.some((block) => block.includes('grep "^## " {readme_file}')))
  })

  it('runs no shell command against a hardcoded README.md outside the probe', () => {
    const offenders = bashBlocks
      .flatMap((block) => block.split('\n'))
      .filter((line) => /README\.md/.test(line) && !/^\s*ls -1 README\.md readme\.md Readme\.md\b/.test(line) && !/^\s*#/.test(line))
    assert.deepEqual(offenders, [])
  })
})
