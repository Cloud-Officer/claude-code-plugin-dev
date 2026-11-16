'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'triage-monitoring', 'SKILL.md'), 'utf8')
const fingerprintLine = skill.split('\n').find((l) => l.startsWith('- **Fingerprint**:'))

const allowedClass = () => {
  const match = fingerprintLine.match(/outside `\[([^\]`]+)\]` with `-`/)
  assert.ok(match, 'Fingerprint rule does not declare the allowed character class')
  return match[1]
}

const sanitise = (key) => {
  const disallowed = new RegExp(`[^${allowedClass()}]`, 'g')
  return key.replace(disallowed, '-').replace(/-+/g, '-')
}

describe('triage-monitoring fingerprint marker', () => {
  it('requires collapsing runs of - after replacing disallowed characters', () => {
    assert.match(fingerprintLine, /collapse each run of `-` into one/)
  })

  it('a hostile message cannot close the hidden HTML comment', () => {
    for (const key of ['in:nr-error:X:boom --> **pwned** <!--', 'a:b:c--!>d', 'a:b:x---->y', 'a:b:"><script>']) {
      const fp = sanitise(key)
      assert.ok(!fp.includes('--'), fp)
      assert.ok(!fp.includes('>'), fp)
      assert.ok(!`<!-- triage-monitoring:fp=${fp} -->`.slice(4, -4).includes('-->'), fp)
    }
  })

  it('keeps class names, paths and separators intact', () => {
    assert.equal(sanitise('in:nr-error:Doctrine\\DBAL\\Exception:connection refused'), 'in:nr-error:Doctrine\\DBAL\\Exception:connection-refused')
    assert.equal(sanitise('ugm:crash:ios:EXC_BAD_ACCESS:src/PlayerView.swift'), 'ugm:crash:ios:EXC_BAD_ACCESS:src/PlayerView.swift')
  })

  it('every documented example is already a sanitised fingerprint', () => {
    const examples = [...fingerprintLine.split('For example:')[1].matchAll(/`([^`]+)`/g)].map((m) => m[1])
    assert.ok(examples.length >= 4)
    for (const ex of examples) assert.equal(sanitise(ex), ex)
  })
})
