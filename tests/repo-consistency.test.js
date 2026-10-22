'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { after, describe, it } = require('node:test')

const ROOT = path.join(__dirname, '..')
const COPIED = ['.claude-plugin', '.mcp.json', 'README.md', 'docs', 'scripts', 'skills']
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-consistency-'))

after(() => fs.rmSync(tmp, { recursive: true, force: true }))

function fixture(name, edit = () => {}) {
  const dir = path.join(tmp, name)

  for (const entry of COPIED) fs.cpSync(path.join(ROOT, entry), path.join(dir, entry), { recursive: true })

  const manifests = path.join(dir, '.claude-plugin')
  const plugin = JSON.parse(fs.readFileSync(path.join(manifests, 'plugin.json'), 'utf8'))
  const marketplace = JSON.parse(fs.readFileSync(path.join(manifests, 'marketplace.json'), 'utf8'))

  edit(plugin, marketplace.plugins.find(entry => entry.name === plugin.name))
  fs.writeFileSync(path.join(manifests, 'plugin.json'), JSON.stringify(plugin, null, 2))
  fs.writeFileSync(path.join(manifests, 'marketplace.json'), JSON.stringify(marketplace, null, 2))

  return spawnSync(process.execPath, [path.join(dir, 'scripts', 'check-repo-consistency.js')], { encoding: 'utf8' })
}

describe('check-repo-consistency.js plugin version', () => {
  it('passes when neither manifest pins a version', () => {
    const result = fixture('clean')

    assert.equal(result.status, 0, result.stderr)
  })

  it('fails when plugin.json pins a version, even one marketplace.json matches', () => {
    const result = fixture('both', (plugin, entry) => {
      plugin.version = '1.0.0'
      entry.version = '1.0.0'
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /plugin\.json pins version "1\.0\.0"/)
    assert.match(result.stderr, /marketplace\.json pins plugin version "1\.0\.0"/)
  })

  it('fails when only the marketplace entry pins a version', () => {
    const result = fixture('entry', (plugin, entry) => {
      entry.version = '2.0.0'
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /marketplace\.json pins plugin version "2\.0\.0"/)
    assert.doesNotMatch(result.stderr, /plugin\.json pins version/)
  })
})
