'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const hook = require('../hooks/iso-review-context.js')

const SCRIPT = path.join(__dirname, '..', 'hooks', 'iso-review-context.js')
const DAY = 24 * 60 * 60 * 1000

function makeDeps({ props, remote = 'git@github.com:Acme/med-app.git', env = {}, now = 1_000_000_000_000 } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-hook-'))
  const calls = { gh: 0 }
  return {
    calls,
    env,
    now,
    cacheDir: path.join(tmp, 'cache'),
    markerDir: path.join(tmp, 'markers'),
    git: () => {
      if (remote === null) throw new Error('no remote')
      return remote
    },
    gh: apiPath => {
      calls.gh++
      calls.path = apiPath
      if (props instanceof Error) throw props
      return JSON.stringify(props)
    },
  }
}

const propsOf = (compliance, cls) => [
  { property_name: 'compliance', value: compliance },
  ...(cls === undefined ? [] : [{ property_name: 'iec62304_class', value: cls }]),
]

const ctxOf = out => out?.hookSpecificOutput?.additionalContext

test('parses GitHub remotes and rejects unsafe names', () => {
  assert.deepStrictEqual(hook.parseRemote('git@github.com:Cloud-Officer/claude-code-plugin-dev.git'), { owner: 'Cloud-Officer', repo: 'claude-code-plugin-dev' })
  assert.deepStrictEqual(hook.parseRemote('https://github.com/a/b'), { owner: 'a', repo: 'b' })
  assert.strictEqual(hook.parseRemote('https://gitlab.com/a/b.git'), null)
  assert.strictEqual(hook.parseRemote('git@github.com:a;rm/b.git'), null)
})

test('normalizes property values and flags unknown ones', () => {
  assert.strictEqual(hook.normalizeCompliance('ISO-27001'), 'iso27001')
  assert.strictEqual(hook.normalizeCompliance('Both'), 'both')
  assert.strictEqual(hook.normalizeCompliance('iso9001'), null)
  assert.strictEqual(hook.normalizeClass('b'), 'B')
  assert.strictEqual(hook.normalizeClass(null), 'none')
  assert.strictEqual(hook.normalizeClass('D'), null)

  const scope = hook.resolveScope('.', makeDeps({ props: propsOf('iso9001', 'D') }))
  assert.strictEqual(scope.valid, false)
  assert.strictEqual(scope.compliance, 'none')
})

test('resolves every compliance and class combination from GitHub properties', () => {
  for (const compliance of ['none', 'iso27001', 'iso13485', 'both']) {
    for (const cls of ['none', 'A', 'B', 'C']) {
      const deps = makeDeps({ props: propsOf(compliance, cls) })
      const scope = hook.resolveScope('.', deps)
      assert.strictEqual(deps.calls.path, 'repos/Acme/med-app/properties/values')
      assert.deepStrictEqual([scope.compliance, scope.iecClass, scope.valid, scope.source], [compliance, cls, true, 'github'])

      const context = hook.buildContext(scope)
      if (compliance === 'none') {
        assert.strictEqual(context, null)
        continue
      }
      assert.ok(context.length < hook.MAX_CONTEXT, `${compliance}/${cls} context is ${context.length} chars`)
      assert.strictEqual(context.includes('A.8.24'), compliance !== 'iso13485')
      assert.strictEqual(context.includes('IEC 62304 software safety class'), compliance !== 'iso27001')
      if (compliance !== 'iso27001') assert.ok(context.includes(cls === 'none' ? 'apply class A rows' : 'safety class: ' + cls))
    }
  }
})

test('caches properties for 24 hours and never caches a failure', () => {
  const deps = makeDeps({ props: propsOf('both', 'B') })
  hook.resolveScope('.', deps)
  assert.strictEqual(hook.resolveScope('.', deps).source, 'cache')
  assert.strictEqual(deps.calls.gh, 1)

  assert.strictEqual(hook.resolveScope('.', { ...deps, now: deps.now + DAY + 1 }).source, 'github')
  assert.strictEqual(deps.calls.gh, 2)

  const failing = makeDeps({ props: new Error('403') })
  assert.strictEqual(hook.resolveScope('.', failing), null)
  assert.strictEqual(fs.existsSync(failing.cacheDir), false)
})

test('environment override wins and skips GitHub', () => {
  const deps = makeDeps({ props: propsOf('none'), env: { CO_DEV_COMPLIANCE: 'iso13485', CO_DEV_IEC62304_CLASS: 'C' } })
  const scope = hook.resolveScope('.', deps)
  assert.deepStrictEqual([scope.compliance, scope.iecClass, scope.source], ['iso13485', 'C', 'env'])
  assert.strictEqual(deps.calls.gh, 0)
})

test('typed /code-review and Skill invocation inject context and arm the marker', () => {
  const deps = makeDeps({ props: propsOf('iso27001') })

  const typed = hook.decide({ hook_event_name: 'UserPromptExpansion', command_name: 'code-review', session_id: 's1', cwd: '.' }, deps)
  assert.strictEqual(typed.hookSpecificOutput.hookEventName, 'UserPromptExpansion')
  assert.match(ctxOf(typed), /ISO\/IEC 27001:2022/)
  assert.ok(fs.existsSync(path.join(deps.markerDir, 's1.json')))

  const viaSkill = hook.decide({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'code-review', args: 'low' }, session_id: 's2', cwd: '.' }, deps)
  assert.strictEqual(viaSkill.hookSpecificOutput.hookEventName, 'PreToolUse')
  assert.strictEqual(viaSkill.hookSpecificOutput.permissionDecision, undefined)
  assert.ok(ctxOf(viaSkill))
})

test('other commands, skills and tools get nothing', () => {
  const deps = makeDeps({ props: propsOf('both') })
  assert.strictEqual(hook.decide({ hook_event_name: 'UserPromptExpansion', command_name: 'simplify', session_id: 's', cwd: '.' }, deps), null)
  assert.strictEqual(hook.decide({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'co-dev:code-review-deep' }, session_id: 's', cwd: '.' }, deps), null)
  assert.strictEqual(hook.decide({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'code-review' }, session_id: 's', cwd: '.' }, deps), null)
  assert.strictEqual(deps.calls.gh, 0)
})

test('out-of-scope, unset or unreadable scope injects nothing and arms no marker', () => {
  for (const deps of [makeDeps({ props: propsOf('none') }), makeDeps({ props: [] }), makeDeps({ props: new Error('403') }), makeDeps({ remote: null }), makeDeps({ remote: 'https://gitlab.com/a/b.git' })]) {
    const out = hook.decide({ hook_event_name: 'UserPromptExpansion', command_name: 'code-review', session_id: 's', cwd: '.' }, deps)
    assert.strictEqual(out, null)
    assert.strictEqual(fs.existsSync(path.join(deps.markerDir, 's.json')), false)
  }
})

test('SubagentStart injects only for the session with a live review marker', () => {
  const deps = makeDeps({ props: propsOf('both', 'C') })
  const sub = sid => hook.decide({ hook_event_name: 'SubagentStart', agent_type: 'general-purpose', session_id: sid, cwd: '.' }, deps)

  assert.strictEqual(sub('s1'), null)
  hook.decide({ hook_event_name: 'UserPromptExpansion', command_name: 'code-review', session_id: 's1', cwd: '.' }, deps)
  assert.match(ctxOf(sub('s1')), /IEC 62304 software safety class: C/)
  assert.strictEqual(sub('other-session'), null)

  assert.strictEqual(hook.decide({ hook_event_name: 'SubagentStart', session_id: 's1' }, { ...deps, now: deps.now + 7 * 60 * 60 * 1000 }), null)

  assert.strictEqual(hook.decide({ hook_event_name: 'Stop', session_id: 's1' }, deps), null)
  assert.strictEqual(sub('s1'), null)
})

test('rejects session ids that could escape the marker directory', () => {
  const deps = makeDeps({ props: propsOf('both') })
  hook.decide({ hook_event_name: 'UserPromptExpansion', command_name: 'code-review', session_id: '../../evil', cwd: '.' }, deps)
  assert.strictEqual(fs.existsSync(deps.markerDir), false)
  assert.strictEqual(hook.decide({ hook_event_name: 'SubagentStart', session_id: '../../evil' }, deps), null)
})

test('runs as a hook: silent exit 0 on bad input and on unrelated events', () => {
  for (const input of ['not json', JSON.stringify({ hook_event_name: 'SubagentStart', session_id: 'no-marker-' + process.pid })]) {
    const r = spawnSync('node', [SCRIPT], { input })
    assert.strictEqual(r.status, 0)
    assert.strictEqual(r.stdout.length, 0)
  }
})

test('--print reports the env-provided scope and context size', () => {
  const r = spawnSync('node', [SCRIPT, '--print', os.tmpdir()], { env: { ...process.env, CO_DEV_COMPLIANCE: 'both', CO_DEV_IEC62304_CLASS: 'B' } })
  assert.strictEqual(r.status, 0)
  const out = JSON.parse(r.stdout)
  assert.deepStrictEqual([out.scope.compliance, out.scope.iecClass, out.scope.source], ['both', 'B', 'env'])
  assert.ok(out.contextChars > 0 && out.contextChars < hook.MAX_CONTEXT)
})

test('hooks.json wires every event to the context hook', () => {
  const { hooks } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'hooks', 'hooks.json'), 'utf8'))
  const wired = (event, matcher) => (hooks[event] || []).some(h => (matcher === undefined || h.matcher === matcher) && h.hooks.some(c => c.command.includes('iso-review-context.js')))
  assert.ok(wired('UserPromptExpansion', 'code-review'))
  assert.ok(wired('PreToolUse', 'Skill'))
  assert.ok(wired('SubagentStart'))
  assert.ok(wired('Stop'))
  assert.ok(wired('SessionEnd'))
})
