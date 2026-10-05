const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const { execFileSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'code-review-deep', 'SKILL.md'), 'utf8')
const PLACEHOLDER = '<file path>:<normalized title>'

function reviewKeyCommand () {
  const blocks = [...skill.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1])
  const block = blocks.find((b) => b.includes('shasum') && b.includes(PLACEHOLDER))
  assert.ok(block, 'SKILL.md has no bash block that hashes the review-key placeholder')
  return block
}

function runWith (keyInput) {
  return execFileSync('bash', ['-c', reviewKeyCommand().replace(PLACEHOLDER, keyInput)], { encoding: 'utf8' })
}

const expected = (keyInput) => crypto.createHash('sha256').update(keyInput).digest('hex').slice(0, 12)

describe('code-review-deep review-key hash command', () => {
  it('feeds the key through a quoted heredoc', () => {
    assert.match(reviewKeyCommand(), /<<'([A-Z_]+)'[\s\S]*\n\1\n/)
  })

  it('hashes a plain key to the first 12 hex of its sha256 with no trailing newline', () => {
    const key = 'app/models/user.rb:sql injection in search scope'
    assert.equal(runWith(key), expected(key))
  })

  it('hashes quotes, backticks and substitutions literally without running them', () => {
    const canary = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'review-key-')), 'pwned')
    const key = `lib/a'b".rb:title $(touch ${canary}) \`touch ${canary}\` $HOME 'quoted' "dq"`
    assert.equal(runWith(key), expected(key))
    assert.equal(fs.existsSync(canary), false)
  })
})
