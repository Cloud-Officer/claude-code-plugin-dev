'use strict'

const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'write-tests', 'SKILL.md'), 'utf8')
const xcodeRow = skill.split('\n').find((l) => l.startsWith('| Swift (Xcode) |'))
const fallback = xcodeRow.match(/fallback: `(xcodebuild test [^`]+)`/)[1]
const quoteRule = skill.split('\n\n').find((l) => l.includes('xcodebuild') && l.includes("'\\''"))

const singleQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`

describe('write-tests xcodebuild fallback quoting', () => {
  it('passes scheme, destination and test id single-quoted', () => {
    for (const flag of ['-scheme', '-destination', '-only-testing:']) {
      assert.match(fallback, new RegExp(`${flag}\\s?'<[a-z ]+>'`), `${flag} is not single-quoted in: ${fallback}`)
    }
    assert.doesNotMatch(fallback, /"/)
  })

  it("states that embedded single quotes are written '\\''", () => {
    assert.ok(quoteRule, 'no rule tells the agent how to escape a single quote in an xcodebuild value')
    assert.match(quoteRule, /scheme/)
    assert.match(quoteRule, /destination/)
    assert.match(quoteRule, /test (id|identifier)/)
  })

  for (const hostile of ['App"; touch /tmp/pwned; echo "', 'App`id`', 'App$(id)', "App'; id; echo '", 'Plain Scheme']) {
    it(`keeps ${JSON.stringify(hostile)} one literal argument`, () => {
      const out = spawnSync('sh', ['-c', `printf '%s' ${singleQuote(hostile)}`], { encoding: 'utf8' })
      assert.equal(out.stdout, hostile)
    })
  }
})
