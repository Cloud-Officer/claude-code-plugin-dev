#!/usr/bin/env node
'use strict'

const fs = require('node:fs')

const MARKER = '# co-dev direnv reload'

const SNIPPET = [
  MARKER,
  'if command -v direnv >/dev/null 2>&1; then',
  '  __co_dev_direnv() { eval "$(direnv export "$([ -n "${ZSH_VERSION:-}" ] && echo zsh || echo bash)" 2>/dev/null)"; }',
  '  cd() { builtin cd "$@" || return; __co_dev_direnv; }',
  '  pushd() { builtin pushd "$@" || return; __co_dev_direnv; }',
  '  popd() { builtin popd "$@" || return; __co_dev_direnv; }',
  '  __co_dev_direnv',
  'fi',
  '',
].join('\n')

function decide(input, env = process.env, fsApi = fs) {
  if (input?.hook_event_name !== 'SessionStart') return false
  if (/^(off|0|false|no)$/i.test(String(env.CO_DEV_DIRENV_RELOAD || ''))) return false
  const file = env.CLAUDE_ENV_FILE
  if (!file) return false

  try {
    const existing = fsApi.existsSync(file) ? fsApi.readFileSync(file, 'utf8') : ''
    if (existing.includes(MARKER)) return false
    fsApi.appendFileSync(file, (existing && !existing.endsWith('\n') ? '\n' : '') + SNIPPET)
  } catch {
    return false
  }
  return true
}

if (require.main === module) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => { raw += chunk })
  process.stdin.on('end', () => {
    try {
      decide(JSON.parse(raw))
    } catch {
      process.exit(0)
    }
    process.exit(0)
  })
}

module.exports = { decide, SNIPPET, MARKER }
