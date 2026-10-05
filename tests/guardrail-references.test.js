const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skillsDir = path.join(__dirname, '..', 'skills')
const skillFiles = fs.readdirSync(skillsDir)
  .map((name) => path.join(skillsDir, name, 'SKILL.md'))
  .filter((file) => fs.existsSync(file))

const guardrailTitles = (text) => {
  const section = text.split(/^## Safety Guardrails\s*$/m)[1]
  if (!section) return []
  const body = section.split(/^## /m)[0]
  return [...body.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm)].map((m) => m[1])
}

describe('Safety Guardrail cross-references', () => {
  for (const file of skillFiles) {
    const rel = path.relative(path.join(__dirname, '..'), file)
    const text = fs.readFileSync(file, 'utf8')

    it(`${rel} never points at a guardrail by number`, () => {
      assert.deepEqual(text.match(/Guardrail \d+/g) ?? [], [])
    })

    it(`${rel} cites only guardrail titles that exist`, () => {
      const titles = guardrailTitles(text)
      const cited = [...text.matchAll(/\*\*([^*]+)\*\* guardrail/g)].map((m) => m[1])
      for (const title of cited) assert.ok(titles.includes(title), `unknown guardrail "${title}"`)
    })
  }

  it('loco points write confirmation and failure handling at the right guardrails', () => {
    const text = fs.readFileSync(path.join(skillsDir, 'loco', 'SKILL.md'), 'utf8')
    assert.match(text, /working tree; the \*\*Confirm every local file write\*\* guardrail applies/)
    assert.match(text, /confirmed with the user first \(the \*\*Confirm every local file write\*\* guardrail\)/)
    assert.match(text, /report the fetch failure \(the \*\*Stop on any failure\*\* guardrail\)/)
  })
})
