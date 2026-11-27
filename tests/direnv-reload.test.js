'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const hook = require('../hooks/direnv-reload.js')

const SCRIPT = path.join(__dirname, '..', 'hooks', 'direnv-reload.js')

function envFile(content) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'direnv-hook-')), 'env.sh')
  if (content !== undefined) fs.writeFileSync(file, content)
  return file
}

test('writes the reload snippet to CLAUDE_ENV_FILE once', () => {
  const file = envFile('export FOO=1')
  assert.strictEqual(hook.decide({ hook_event_name: 'SessionStart' }, { CLAUDE_ENV_FILE: file }), true)
  assert.strictEqual(hook.decide({ hook_event_name: 'SessionStart' }, { CLAUDE_ENV_FILE: file }), false)

  const text = fs.readFileSync(file, 'utf8')
  assert.ok(text.startsWith('export FOO=1\n' + hook.MARKER))
  assert.strictEqual(text.split(hook.MARKER).length, 2)
})

test('does nothing without CLAUDE_ENV_FILE, on other events, or when switched off', () => {
  const file = envFile()
  assert.strictEqual(hook.decide({ hook_event_name: 'SessionStart' }, {}), false)
  assert.strictEqual(hook.decide({ hook_event_name: 'Stop' }, { CLAUDE_ENV_FILE: file }), false)
  assert.strictEqual(hook.decide({ hook_event_name: 'SessionStart' }, { CLAUDE_ENV_FILE: file, CO_DEV_DIRENV_RELOAD: 'off' }), false)
  assert.strictEqual(fs.existsSync(file), false)
})

for (const shell of ['bash', 'zsh']) {
  test('the snippet reloads direnv on cd inside one ' + shell + ' command', { skip: spawnSync(shell, ['-c', 'true']).status !== 0 }, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'direnv-sh-'))
    const bin = path.join(tmp, 'bin')
    fs.mkdirSync(bin)
    fs.writeFileSync(path.join(bin, 'direnv'), '#!/bin/sh\nprintf "export LOADED_FROM=%s\\n" "$(basename "$PWD")"\n', { mode: 0o755 })
    fs.mkdirSync(path.join(tmp, 'a'))
    fs.mkdirSync(path.join(tmp, 'b'))
    const file = envFile()
    hook.decide({ hook_event_name: 'SessionStart' }, { CLAUDE_ENV_FILE: file })

    const script = '. "' + file + '"; cd "' + path.join(tmp, 'a') + '" && echo "$LOADED_FROM"; pushd "' + path.join(tmp, 'b') + '" >/dev/null && echo "$LOADED_FROM"; popd >/dev/null && echo "$LOADED_FROM"'
    const run = spawnSync(shell, ['-c', script], { encoding: 'utf8', cwd: tmp, env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH } })
    assert.strictEqual(run.status, 0, run.stderr)
    assert.deepStrictEqual(run.stdout.trim().split('\n'), ['a', 'b', 'a'])
  })
}

test('the script exits 0 on bad input', () => {
  const run = spawnSync(process.execPath, [SCRIPT], { input: 'not json', encoding: 'utf8' })
  assert.strictEqual(run.status, 0)
})
