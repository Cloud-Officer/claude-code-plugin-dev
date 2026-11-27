'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const hook = require('../hooks/workspace-context.js')

const SCRIPT = path.join(__dirname, '..', 'hooks', 'workspace-context.js')
const DAY = 24 * 60 * 60 * 1000

function workspace(repos) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-hook-'))
  const remotes = {}
  for (const [dir, remote] of Object.entries(repos)) {
    const full = path.join(tmp, dir)
    fs.mkdirSync(path.join(full, '.git'), { recursive: true })
    remotes[full] = remote
  }
  return { tmp, remotes }
}

function makeDeps({ remotes, org = {}, env = {}, now = 1_000_000_000_000, cacheDir } = {}) {
  const calls = { gh: [] }
  return {
    calls,
    env,
    now,
    home: '/nonexistent-home',
    cacheDir: cacheDir || fs.mkdtempSync(path.join(os.tmpdir(), 'ws-cache-')),
    catalog: () => '# Cloud Officer open-source tools\n\n- `soup`: SOUP list.',
    git: (cwd, args) => {
      const root = Object.keys(remotes).find(r => cwd === r || cwd.startsWith(r + path.sep))
      if (!root) throw new Error('not a repo')
      if (args[0] === 'rev-parse') return root
      return remotes[root]
    },
    gh: apiPath => {
      calls.gh.push(apiPath)
      const owner = decodeURIComponent(apiPath.split('/')[1])
      const value = org[owner]
      if (value instanceof Error) throw value
      if (value === undefined) {
        const error = new Error('gh: Not Found (HTTP 404)')
        error.stderr = 'gh: Not Found (HTTP 404)'
        throw error
      }
      return value
    },
  }
}

test('lists only same-org siblings and the org context from the .github repo', () => {
  const { tmp, remotes } = workspace({
    'pnp-web': 'git@github.com:Acme/pnp-web.git',
    'pnp-api': 'https://github.com/Acme/pnp-api.git',
    'pnp-ios': 'git@github.com:Acme/pnp-ios.git',
    draw: 'git@github.com:someone/draw.git',
  })
  const deps = makeDeps({ remotes, org: { Acme: 'Backend: pnp-api. Clients: pnp-web, pnp-ios.' } })
  const out = hook.buildContext(path.join(tmp, 'pnp-web', 'src'), deps)

  assert.match(out, /Current repository: `Acme\/pnp-web`/)
  assert.match(out, /- `Acme` in `[^`]+\/`: `pnp-api`, `pnp-ios`\n/)
  assert.doesNotMatch(out, /draw/)
  assert.match(out, /read its `README\.md` and `docs\/architecture\.md` first/)
  assert.match(out, /## Organization context: Acme/)
  assert.match(out, /Backend: pnp-api/)
  assert.match(out, /## Cloud Officer open-source tools/)
  assert.deepStrictEqual(deps.calls.gh, ['repos/Acme/.github/contents/claude/context.md'])
})

test('a top folder with no repo uses the most common org among its children', () => {
  const { tmp, remotes } = workspace({
    a: 'git@github.com:Acme/a.git',
    b: 'git@github.com:Acme/b.git',
    c: 'git@github.com:Other/c.git',
  })
  const deps = makeDeps({ remotes })
  const out = hook.buildContext(tmp, deps)

  assert.match(out, /Started outside a git repository/)
  assert.match(out, /- `Acme` in `[^`]+\/`: `a`, `b`\n/)
  assert.doesNotMatch(out, /`Other`/)
  assert.deepStrictEqual(deps.calls.gh, ['repos/Acme/.github/contents/claude/context.md'])
})

test('caches the org file for a day and a missing file for six hours', () => {
  const { remotes } = workspace({ app: 'git@github.com:Acme/app.git' })
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-cache-'))
  const now = 1_000_000_000_000

  const first = makeDeps({ remotes, org: { Acme: 'v1' }, now, cacheDir })
  assert.strictEqual(hook.orgContext('Acme', first), 'v1')
  assert.strictEqual(hook.orgContext('Nope', first), null)

  const later = makeDeps({ remotes, org: { Acme: 'v2', Nope: 'now exists' }, now: now + 5 * 60 * 60 * 1000, cacheDir })
  assert.strictEqual(hook.orgContext('Acme', later), 'v1')
  assert.strictEqual(hook.orgContext('Nope', later), null)
  assert.strictEqual(later.calls.gh.length, 0)

  const nextDay = makeDeps({ remotes, org: { Acme: 'v2', Nope: 'now exists' }, now: now + DAY + 1, cacheDir })
  assert.strictEqual(hook.orgContext('Acme', nextDay), 'v2')
  assert.strictEqual(hook.orgContext('Nope', nextDay), 'now exists')
})

test('falls back to the stale cache when GitHub is unreachable', () => {
  const { remotes } = workspace({ app: 'git@github.com:Acme/app.git' })
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-cache-'))
  const now = 1_000_000_000_000
  hook.orgContext('Acme', makeDeps({ remotes, org: { Acme: 'cached' }, now, cacheDir }))

  const offline = makeDeps({ remotes, org: { Acme: new Error('network down') }, now: now + 2 * DAY, cacheDir })
  assert.strictEqual(hook.orgContext('Acme', offline), 'cached')
})

test('keeps the whole context under the 10,000 character cap', () => {
  const repos = {}
  for (let i = 0; i < 40; i++) repos['repo-' + i] = 'git@github.com:Acme/repo-' + i + '.git'
  const { tmp, remotes } = workspace(repos)
  const deps = makeDeps({ remotes, org: { Acme: 'x'.repeat(50000) } })
  const out = hook.buildContext(path.join(tmp, 'repo-0'), deps)

  assert.ok(out.length < 10000, 'got ' + out.length)
  assert.match(out, /\[truncated: read the full file at the URL above\]/)
})

test('CO_PRIVATE_DIR adds the repos cloned there', () => {
  const { tmp, remotes } = workspace({
    'client/app': 'git@github.com:Client/app.git',
    'co/compliance': 'git@github.com:Cloud-Officer/compliance.git',
  })
  const deps = makeDeps({ remotes, env: { CO_PRIVATE_DIR: path.join(tmp, 'co') } })
  const out = hook.buildContext(path.join(tmp, 'client', 'app'), deps)

  assert.match(out, /## Cloud Officer repositories cloned locally \(CO_PRIVATE_DIR\)/)
  assert.match(out, /- `Cloud-Officer` in `[^`]+\/co\/`: `compliance`\n/)
  assert.doesNotMatch(hook.buildContext(path.join(tmp, 'client', 'app'), makeDeps({ remotes })), /CO_PRIVATE_DIR/)
})

test('names the GitHub repository when the folder is named differently', () => {
  const { tmp, remotes } = workspace({
    app: 'git@github.com:Acme/app.git',
    'php-extensions': 'git@github.com:Acme/apt-packages.git',
  })
  const out = hook.buildContext(path.join(tmp, 'app'), makeDeps({ remotes }))

  assert.match(out, /`php-extensions` \(`apt-packages`\)/)
})

test('rejects remotes whose owner or name is not a plain GitHub name', () => {
  assert.deepStrictEqual(hook.parseRemote('git@github.com:Acme/app.git'), { owner: 'Acme', repo: 'app' })
  assert.strictEqual(hook.parseRemote('git@github.com:Ac me/app.git'), null)
  assert.strictEqual(hook.parseRemote('https://gitlab.com/Acme/app.git'), null)
})

test('only answers SessionStart and honours the off switch', () => {
  const { tmp, remotes } = workspace({ app: 'git@github.com:Acme/app.git' })
  const cwd = path.join(tmp, 'app')
  assert.strictEqual(hook.decide({ hook_event_name: 'PreToolUse', cwd }, makeDeps({ remotes })), null)
  assert.strictEqual(hook.decide({ hook_event_name: 'SessionStart', cwd }, makeDeps({ remotes, env: { CO_DEV_WORKSPACE_CONTEXT: 'off' } })), null)

  const out = hook.decide({ hook_event_name: 'SessionStart', cwd }, makeDeps({ remotes }))
  assert.strictEqual(out.hookSpecificOutput.hookEventName, 'SessionStart')
  assert.match(out.hookSpecificOutput.additionalContext, /Acme\/app/)
})

test('the script exits 0 with no output on bad input', () => {
  const run = spawnSync(process.execPath, [SCRIPT], { input: 'not json', encoding: 'utf8' })
  assert.strictEqual(run.status, 0)
  assert.strictEqual(run.stdout, '')
})
