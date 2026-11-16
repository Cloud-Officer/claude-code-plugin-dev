'use strict'

const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const { execFileSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'review-aws-cost', 'SKILL.md'), 'utf8')
const PLACEHOLDER = '<cost_basis_ref>'

function reviewKeyCommand () {
  const blocks = [...skill.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1])
  const block = blocks.find((b) => b.includes('shasum') && b.includes(PLACEHOLDER))
  assert.ok(block, 'SKILL.md has no bash block that hashes the cost_basis_ref placeholder')
  return block
}

function runWith (ref) {
  return execFileSync('bash', ['-c', reviewKeyCommand().replace(PLACEHOLDER, ref)], { encoding: 'utf8' })
}

const expected = (ref) => crypto.createHash('sha256').update(ref).digest('hex').slice(0, 12)

describe('review-aws-cost review-key hash command', () => {
  it('feeds cost_basis_ref through a quoted heredoc, never inside quotes', () => {
    const block = reviewKeyCommand()
    assert.match(block, /<<'([A-Z_]+)'[\s\S]*\n\1\n/)
    assert.ok(!block.includes(`'${PLACEHOLDER}'`))
  })

  it('no command in SKILL.md places cost_basis_ref inside quotes', () => {
    assert.ok(!skill.includes(`'${PLACEHOLDER}'`))
    assert.ok(!skill.includes(`"${PLACEHOLDER}"`))
  })

  it('hashes a plain ref to the first 12 hex of its sha256 with no trailing newline', () => {
    const ref = 'AmazonEC2|EBS:VolumeUsage.gp2|vol-0abc,vol-0def'
    assert.equal(runWith(ref), expected(ref))
  })

  it('hashes quotes, backticks and substitutions literally without running them', () => {
    const canary = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cost-review-key-')), 'pwned')
    const ref = `AmazonS3|O'Brien's bucket'; touch ${canary}; '|$(touch ${canary}) \`touch ${canary}\` $HOME "dq"`
    assert.equal(runWith(ref), expected(ref))
    assert.equal(fs.existsSync(canary), false)
  })

  it('declares how cost_basis_ref reaches the shell in the Interpolation Boundary', () => {
    const section = skill.split('## Interpolation Boundary')[1].split('\n## ')[0]
    assert.match(section, /cost_basis_ref[^\n]*quoted heredoc/)
  })

  it('allows the shasum binary the hash command runs', () => {
    assert.match(skill.split('\n---\n')[0], /Bash\(shasum:\*\)/)
  })
})
