const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { describe, it } = require('node:test')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'review-aws-cost', 'SKILL.md'), 'utf8')
const windowBlock = skill.match(/```bash\n(MONTHS=[\s\S]*?)```/)[1]

const runWindows = months => spawnSync('bash', ['-c', windowBlock], { encoding: 'utf8', env: { ...process.env, MONTHS: months } })

describe('review-aws-cost window computation', () => {
  it('computes both windows for a valid month count', () => {
    const result = runWindows('3')

    assert.equal(result.status, 0)
    assert.match(result.stdout, /^current: \d{4}-\d{2}-01 -> \d{4}-\d{2}-01\nprior: {3}\d{4}-\d{2}-01 -> \d{4}-\d{2}-01\n$/)
  })

  for (const months of ['0', '100', 'abc', '3m -f x', '3; touch pwned', '-3', '03', ' 3']) {
    it(`rejects --months ${JSON.stringify(months)} before any date command runs`, () => {
      const result = runWindows(months)

      assert.notEqual(result.status, 0)
      assert.equal(result.stdout, '')
      assert.match(result.stderr, /--months/)
    })
  }
})
