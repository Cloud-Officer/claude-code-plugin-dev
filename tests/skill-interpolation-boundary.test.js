const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const boundaryLine = (skill, label) => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'skills', skill, 'SKILL.md'), 'utf8')
  const section = text.split('## Interpolation Boundary')[1].split('\n## ')[0]
  const line = section.split('\n').find((l) => l.startsWith('- ') && l.includes(label))
  assert.ok(line, `no Interpolation Boundary pattern mentions "${label}"`)
  return line
}

describe('review-aws-cost Interpolation Boundary', () => {
  const RETENTION_DAYS = /^(1|3|5|7|14|30|60|90|120|150|180|365|400|545|731|1096|1827|2192|2557|2922|3288|3653)$/

  it('declares the CloudWatch retention-days pattern for the Step 6 retention answer', () => {
    assert.ok(boundaryLine('review-aws-cost', 'retention days').endsWith(`\`${RETENTION_DAYS.source}\``))
  })

  it('the retention-days pattern admits only CloudWatch retention values', () => {
    for (const ok of ['1', '7', '30', '365', '3653']) assert.ok(RETENTION_DAYS.test(ok), ok)
    for (const bad of ['0', '2', '31', '3654', '30 ', '30; aws s3 rb s3://x', '$(id)', '']) assert.ok(!RETENTION_DAYS.test(bad), bad)
  })
})
