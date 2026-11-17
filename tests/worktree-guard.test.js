'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { decide } = require('../hooks/worktree-guard.js')

const CWD = '/Users/dev/ugm/pnp-api'
const run = command => decide({ tool_name: 'Bash', cwd: CWD, tool_input: { command } })
const denied = command => run(command)?.hookSpecificOutput?.permissionDecision === 'deny'

test('denies sibling and absolute worktrees outside the repo', () => {
  assert.ok(denied('git worktree add ../pnp-api-DEV-6735 -b DEV-6735 origin/master'))
  assert.ok(denied('git fetch && git worktree add -q -b DEV-6476-cron ../../pnp-api-DEV-6476-cron origin/master && echo ok'))
  assert.ok(denied('git worktree add /Users/dev/ugm/pnp-api-DEV-6670 -b DEV-6670 origin/master 2>&1 | tail -2'))
  assert.ok(denied('git -C /Users/dev/ugm/pnp-api worktree add "../pnp-api-X" -b X'))
  assert.ok(denied('git worktree add "$WT" -b X origin/master'))
})

test('allows worktrees under .claude/worktrees or .worktrees', () => {
  assert.ok(!denied('git worktree add .claude/worktrees/DEV-1 -b DEV-1 origin/master'))
  assert.ok(!denied('git worktree add ".worktrees/$BRANCH" -b "$BRANCH" "origin/$DEFAULT_BRANCH"'))
  assert.ok(!denied('git worktree add -b DEV-2 /Users/dev/ugm/pnp-api/.claude/worktrees/DEV-2 origin/master'))
  assert.ok(!denied('git -C /Users/dev/ugm/pnp-api worktree add .claude/worktrees/DEV-3 -b DEV-3'))
})

test('ignores other commands and tools', () => {
  assert.strictEqual(run('git worktree list --porcelain'), null)
  assert.strictEqual(run('git worktree remove ../pnp-api-DEV-1'), null)
  assert.strictEqual(run('echo "git worktree add ../x"'), null)
  assert.strictEqual(decide({ tool_name: 'Read', tool_input: { file_path: '/x' } }), null)
})

test('runs as a hook: deny JSON on stdout, exit 0, silent on bad input', () => {
  const script = path.join(__dirname, '..', 'hooks', 'worktree-guard.js')
  const deny = spawnSync('node', [script], { input: JSON.stringify({ tool_name: 'Bash', cwd: CWD, tool_input: { command: 'git worktree add ../x' } }) })
  assert.strictEqual(deny.status, 0)
  assert.strictEqual(JSON.parse(deny.stdout).hookSpecificOutput.permissionDecision, 'deny')

  const junk = spawnSync('node', [script], { input: 'not json' })
  assert.strictEqual(junk.status, 0)
  assert.strictEqual(junk.stdout.length, 0)
})
