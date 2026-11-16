'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skillsDir = path.join(__dirname, '..', 'skills')
const skillFiles = fs.readdirSync(skillsDir)
  .map((name) => path.join(skillsDir, name, 'SKILL.md'))
  .filter((file) => fs.existsSync(file))

const unquotedCatPlaceholders = (text) => [...text.matchAll(/\bcat[ \t]+(?!<<)(?!--[ \t]+"<[^>\n]+>")[^`\n<]*<[^>\n]+>/g)].map((m) => m[0])

describe('cat fallbacks quote placeholder paths', () => {
  it('flags an unquoted placeholder path', () => {
    assert.equal(unquotedCatPlaceholders('| `cat <file>` |').length, 1)
    assert.equal(unquotedCatPlaceholders('| `cat "<file>"` |').length, 1)
  })

  it('allows a double-quoted placeholder after --', () => {
    assert.deepEqual(unquotedCatPlaceholders('| `cat -- "<file>"` |'), [])
    assert.deepEqual(unquotedCatPlaceholders("cat <<'EOF'\n<title>\nEOF"), [])
  })

  for (const file of skillFiles) {
    const rel = path.relative(path.join(__dirname, '..'), file)
    it(`${rel} quotes every cat placeholder path`, () => {
      assert.deepEqual(unquotedCatPlaceholders(fs.readFileSync(file, 'utf8')), [])
    })
  }
})
