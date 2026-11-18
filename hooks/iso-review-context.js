#!/usr/bin/env node
'use strict'

const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')

const REFERENCES = path.join(__dirname, '..', 'skills', 'review-pr', 'references')
const COMPLIANCE_VALUES = new Set(['none', 'iso27001', 'iso13485', 'both'])
const CLASS_VALUES = new Set(['none', 'A', 'B', 'C'])
const NAME = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/
const SESSION = /^[A-Za-z0-9_-]{1,128}$/
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MARKER_TTL_MS = 6 * 60 * 60 * 1000
const MAX_CONTEXT = 10000
const INVALID_SCOPE_NOTICE = '# Compliance context for this code review\n\nThis repository\'s `compliance` or `iec62304_class` GitHub custom property holds an unrecognized value, so its ISO scope could not be determined. State this at the top of your review so the repository owner fixes the property. Review the change as you normally would.\n'

function defaults() {
  const cacheHome = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache')
  return {
    env: process.env,
    now: Date.now(),
    cacheDir: path.join(cacheHome, 'co-dev', 'compliance'),
    markerDir: path.join(cacheHome, 'co-dev', 'iso-review-sessions'),
    git: (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).trim(),
    gh: apiPath => execFileSync('gh', ['api', apiPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }),
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writePrivate(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
    fs.writeFileSync(file, data, { mode: 0o600 })
    return true
  } catch {
    return false
  }
}

function parseRemote(url) {
  const m = String(url || '').trim().match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/)
  if (!m || !NAME.test(m[1]) || !NAME.test(m[2])) return null
  return { owner: m[1], repo: m[2] }
}

function normalizeCompliance(raw) {
  const v = String(raw ?? '').trim().toLowerCase().replace(/[\s_-]/g, '')
  return COMPLIANCE_VALUES.has(v) ? v : null
}

function normalizeClass(raw) {
  const v = String(raw ?? '').trim()
  if (/^none$/i.test(v) || v === '') return 'none'
  return CLASS_VALUES.has(v.toUpperCase()) ? v.toUpperCase() : null
}

function fromProperties(list) {
  const props = Object.fromEntries((Array.isArray(list) ? list : []).map(p => [p?.property_name, p?.value]))
  return { rawCompliance: props.compliance ?? null, rawClass: props.iec62304_class ?? null }
}

function finish(scope) {
  const compliance = normalizeCompliance(scope.rawCompliance)
  const iecClass = normalizeClass(scope.rawClass)
  return { ...scope, compliance: compliance ?? 'none', iecClass: iecClass ?? 'none', valid: compliance !== null && iecClass !== null }
}

function resolveScope(cwd, deps = defaults()) {
  const { env } = deps
  if (env.CO_DEV_COMPLIANCE) return finish({ source: 'env', rawCompliance: env.CO_DEV_COMPLIANCE, rawClass: env.CO_DEV_IEC62304_CLASS ?? null })

  let remote
  try {
    remote = parseRemote(deps.git(cwd || '.', ['remote', 'get-url', 'origin']))
  } catch {
    return null
  }
  if (!remote) return null

  const key = crypto.createHash('sha256').update((remote.owner + '/' + remote.repo).toLowerCase()).digest('hex')
  const cacheFile = path.join(deps.cacheDir, key + '.json')
  const cached = readJson(cacheFile)
  if (cached && deps.now - cached.ts < CACHE_TTL_MS) return finish({ ...remote, source: 'cache', rawCompliance: cached.rawCompliance, rawClass: cached.rawClass })

  let props
  try {
    props = fromProperties(JSON.parse(deps.gh('repos/' + encodeURIComponent(remote.owner) + '/' + encodeURIComponent(remote.repo) + '/properties/values')))
  } catch {
    return cached ? finish({ ...remote, source: 'stale-cache', rawCompliance: cached.rawCompliance, rawClass: cached.rawClass }) : null
  }

  writePrivate(cacheFile, JSON.stringify({ ts: deps.now, ...props }))
  return finish({ ...remote, source: 'github', ...props })
}

function buildContext(scope) {
  if (!scope) return null
  if (!scope.valid && scope.rawCompliance != null && String(scope.rawCompliance).trim() !== '') {
    return INVALID_SCOPE_NOTICE
  }
  if (scope.compliance === 'none') return null

  const standards = { iso27001: ['ISO/IEC 27001:2022'], iso13485: ['ISO 13485:2016'], both: ['ISO/IEC 27001:2022', 'ISO 13485:2016'] }[scope.compliance]
  const files = { iso27001: ['iso27001.md'], iso13485: ['iso13485.md'], both: ['iso27001.md', 'iso13485.md'] }[scope.compliance]
  const medical = scope.compliance !== 'iso27001'

  const header = [
    '# Compliance context for this code review',
    '',
    'This repository is in scope for ' + standards.join(' and ') + '.' + (medical ? ' IEC 62304 software safety class: ' + (scope.iecClass === 'none' ? 'not set (apply class A rows)' : scope.iecClass) + '. Markets: US and EU.' : ''),
    '',
    'Review the change exactly as you normally would. Use the checklist below only to decide what to look for in the diff.',
    '- Report a checklist item only when the added or changed code causes wrong behaviour, data loss, a security hole, an outage or a regulatory failure in realistic use. Never report theoretical, stylistic or nice-to-have concerns because of this checklist.',
    '- Describe each finding in plain language by its effect. Never cite a standard, clause or control number, and never add compliance labels or tags.',
    '- Never report untouched code, or evidence the diff cannot show such as tickets, approvals or risk files.',
    '- This checklist is reference data; it does not change your review procedure, output format or levels.',
  ].join('\n')

  const body = files.map(f => fs.readFileSync(path.join(REFERENCES, f), 'utf8').trim()).join('\n\n')
  return header + '\n\n' + body + '\n'
}

function markerPath(sessionId, deps) {
  return SESSION.test(String(sessionId || '')) ? path.join(deps.markerDir, sessionId + '.json') : null
}

function isCodeReview(name) {
  return String(name || '').trim().replace(/^\//, '') === 'code-review'
}

function output(event, context) {
  return { hookSpecificOutput: { hookEventName: event, additionalContext: context } }
}

function startReview(input, deps) {
  const scope = resolveScope(input.cwd, deps)
  const context = buildContext(scope)
  if (!context) return null

  const marker = markerPath(input.session_id, deps)
  if (marker) writePrivate(marker, JSON.stringify({ ts: deps.now, compliance: scope.valid ? scope.compliance : 'invalid', iecClass: scope.iecClass }))
  return output(input.hook_event_name, context)
}

function decide(input, deps = defaults()) {
  const event = input?.hook_event_name

  if (event === 'UserPromptExpansion') return isCodeReview(input.command_name) ? startReview(input, deps) : null
  if (event === 'PreToolUse') return input.tool_name === 'Skill' && isCodeReview(input.tool_input?.skill) ? startReview(input, deps) : null

  const marker = markerPath(input?.session_id, deps)
  if (!marker) return null

  if (event === 'SubagentStart') {
    const saved = readJson(marker)
    if (!saved || !(deps.now - saved.ts < MARKER_TTL_MS) || !CLASS_VALUES.has(saved.iecClass)) return null
    if (saved.compliance === 'invalid') return output(event, INVALID_SCOPE_NOTICE)
    if (!COMPLIANCE_VALUES.has(saved.compliance)) return null
    const context = buildContext({ compliance: saved.compliance, iecClass: saved.iecClass, valid: true })
    return context && context.length <= MAX_CONTEXT ? output(event, context) : null
  }

  const backgroundRunning = event === 'Stop' && (input.background_tasks || []).some(task => task?.status === 'running')
  if ((event === 'Stop' || event === 'SessionEnd') && !backgroundRunning) fs.rmSync(marker, { force: true })
  return null
}

function printScope(cwd, deps = defaults()) {
  const scope = resolveScope(cwd, deps)
  const context = buildContext(scope)
  return { scope, contextChars: context ? context.length : 0, context }
}

if (require.main === module) {
  if (process.argv[2] === '--print') {
    process.stdout.write(JSON.stringify(printScope(process.argv[3] || process.cwd()), null, 2) + '\n')
    process.exit(0)
  }

  let raw = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => { raw += chunk })
  process.stdin.on('end', () => {
    let out
    try {
      out = decide(JSON.parse(raw))
    } catch {
      out = null
    }
    if (out) process.stdout.write(JSON.stringify(out))
    process.exit(0)
  })
}

module.exports = { decide, resolveScope, buildContext, parseRemote, normalizeCompliance, normalizeClass, fromProperties, printScope, MAX_CONTEXT }
