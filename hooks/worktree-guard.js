#!/usr/bin/env node
'use strict'

const path = require('node:path')

const ALLOWED_PARENTS = ['.claude/worktrees', '.worktrees']
const GIT_OPTS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env'])
const ADD_OPTS_WITH_VALUE = new Set(['-b', '-B', '--reason'])

function tokenize(command) {
  const segments = [[]]
  let token = null
  let quote = null

  const push = () => {
    if (token !== null) segments[segments.length - 1].push(token)
    token = null
  }

  for (let i = 0; i < command.length; i++) {
    const c = command[i]

    if (quote) {
      if (c === quote) quote = null
      else if (c === '\\' && quote === '"' && i + 1 < command.length) token += command[++i]
      else token += c
      continue
    }

    if (c === '"' || c === "'") {
      quote = c
      token = token ?? ''
    } else if (c === '\\' && i + 1 < command.length) {
      token = (token ?? '') + command[++i]
    } else if (c === ';' || c === '&' || c === '|' || c === '\n' || c === '(' || c === ')') {
      push()
      segments.push([])
    } else if (c === ' ' || c === '\t') {
      push()
    } else {
      token = (token ?? '') + c
    }
  }

  push()
  return segments.filter(s => s.length)
}

function worktreeAddTargets(command) {
  const targets = []

  for (const tokens of tokenize(command)) {
    const gitAt = tokens.findIndex(t => t === 'git' || t.endsWith('/git'))
    if (gitAt === -1) continue

    let i = gitAt + 1
    let gitDir = null

    while (i < tokens.length && tokens[i].startsWith('-')) {
      const opt = tokens[i]
      if (opt === '-C') gitDir = tokens[i + 1] ?? null
      i += GIT_OPTS_WITH_VALUE.has(opt) ? 2 : 1
    }

    if (tokens[i] !== 'worktree' || tokens[i + 1] !== 'add') continue

    for (let j = i + 2; j < tokens.length; j++) {
      const t = tokens[j]

      if (t === '--') {
        if (tokens[j + 1] !== undefined) targets.push({ target: tokens[j + 1], gitDir })
        break
      }

      if (ADD_OPTS_WITH_VALUE.has(t)) {
        j++
      } else if (!t.startsWith('-')) {
        targets.push({ target: t, gitDir })
        break
      }
    }
  }

  return targets
}

function isAllowed(target, gitDir, cwd) {
  const base = gitDir ? path.resolve(cwd || '/', gitDir) : (cwd || '/')
  const resolved = target.startsWith('/') || target.startsWith('~') ? path.normalize(target) : path.resolve(base, target)
  const parent = path.dirname(resolved).split(path.sep).join('/')

  return ALLOWED_PARENTS.some(p => parent === p || parent.endsWith('/' + p))
}

function decide(input) {
  if (input?.tool_name !== 'Bash') return null

  const command = String(input.tool_input?.command ?? '')
  if (!/\bworktree\b/.test(command)) return null

  const bad = worktreeAddTargets(command).filter(({ target, gitDir }) => !isAllowed(target, gitDir, input.cwd))
  if (!bad.length) return null

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'git worktree add outside the repository is blocked (' + bad.map(b => b.target).join(', ') + '): it leaves folders next to the repo that nothing cleans up. Create the worktree inside the repo instead, at "$(git rev-parse --show-toplevel)/.claude/worktrees/<branch>" (or ".worktrees/<branch>" if the repo already uses that), or use the co-dev:work-issue skill, which manages worktrees for you.',
    },
  }
}

if (require.main === module) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => { raw += chunk })
  process.stdin.on('end', () => {
    let input
    try {
      input = JSON.parse(raw)
    } catch {
      process.exit(0)
    }

    const out = decide(input)
    if (out) process.stdout.write(JSON.stringify(out))
    process.exit(0)
  })
}

module.exports = { decide, worktreeAddTargets, isAllowed, tokenize }
