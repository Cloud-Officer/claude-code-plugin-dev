'use strict'

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const SKILLS = path.join(ROOT, 'skills')
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'instanceof', 'do', 'else', 'yield', 'await'])

function workflowScripts() {
  const out = []

  for (const entry of fs.readdirSync(SKILLS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    for (const file of fs.readdirSync(path.join(SKILLS, entry.name))) {
      if (file.endsWith('.workflow.js')) out.push(path.join(SKILLS, entry.name, file))
    }
  }

  return out.sort()
}

function workflowScript(skill) {
  return path.join(SKILLS, skill, skill + '.workflow.js')
}

// The harness runs a workflow body inside an async function: top-level `return` is legal there, `export` is not.
function harnessSource(src) {
  return '(async function () {' + src.replace(/^export[ \t]+/gm, '') + '\n})'
}

function endOfString(src, i) {
  const quote = src[i]

  for (let j = i + 1; j < src.length; j++) {
    const c = src[j]

    if (c === '\\') { j++; continue }
    if (c === quote) return j
    if (quote === '`' && c === '$' && src[j + 1] === '{') j = endOfDeclaration(src, j + 1, 'block')
  }

  throw new Error('unterminated string literal at offset ' + i)
}

function endOfRegex(src, i) {
  let inClass = false

  for (let j = i + 1; j < src.length; j++) {
    const c = src[j]

    if (c === '\\') { j++; continue }
    if (c === '\n') break
    if (c === '[') inClass = true
    else if (c === ']') inClass = false
    else if (c === '/' && !inClass) return j
  }

  throw new Error('unterminated regex literal at offset ' + i)
}

function regexAllowed(prevChar, prevWord) {
  if (!prevChar) return true
  if (/[)\]]/.test(prevChar)) return false
  if (/[\w$]/.test(prevChar)) return REGEX_KEYWORDS.has(prevWord)

  return true
}

function endOfDeclaration(src, start, mode) {
  let depth = 0
  let prevChar = ''
  let prevWord = ''

  for (let i = start; i < src.length; i++) {
    const c = src[i]

    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i)

      if (nl < 0) break
      i = nl - 1
      continue
    }

    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)

      if (end < 0) throw new Error('unterminated comment at offset ' + i)
      i = end + 1
      continue
    }

    if (c === '"' || c === "'" || c === '`') {
      i = endOfString(src, i)
      prevChar = c
      prevWord = ''
      continue
    }

    if (c === '/' && regexAllowed(prevChar, prevWord)) {
      i = endOfRegex(src, i)
      prevChar = '/'
      prevWord = ''
      continue
    }

    if (c === '{' || (mode === 'statement' && (c === '(' || c === '['))) depth++
    else if (c === '}' || (mode === 'statement' && (c === ')' || c === ']'))) {
      depth--
      if (mode === 'block' && depth === 0) return i
      if (depth < 0) throw new Error('unbalanced brackets at offset ' + i)
    }
    else if (c === '\n' && mode === 'statement' && depth === 0 && i > start) return i - 1

    if (!/\s/.test(c)) {
      prevChar = c
      prevWord = /[\w$]/.test(c) ? prevWord + c : ''
    }
  }

  throw new Error('unterminated declaration at offset ' + start)
}

function declarationSource(src, name) {
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error('not an identifier: ' + JSON.stringify(name))

  const fn = new RegExp('^(?:async )?function ' + name + '\\s*\\(', 'm').exec(src)

  if (fn) return src.slice(fn.index, endOfDeclaration(src, src.indexOf('{', fn.index), 'block') + 1)

  const binding = new RegExp('^(?:const|let|var) ' + name + '\\s*=', 'm').exec(src)

  if (!binding) throw new Error('no top-level declaration of ' + name)

  return src.slice(binding.index, endOfDeclaration(src, binding.index, 'statement') + 1)
}

// A workflow script's top-level `return` makes it unimportable as a module.
function loadHelpers(file, names, sandbox = {}) {
  const src = fs.readFileSync(file, 'utf8')
  const stubs = { log() {}, ...sandbox }
  const body = names.map(name => declarationSource(src, name)).join('\n\n') + '\nreturn { ' + names.join(', ') + ' }'

  return new Function(...Object.keys(stubs), body)(...Object.values(stubs))
}

module.exports = { ROOT, declarationSource, harnessSource, loadHelpers, workflowScript, workflowScripts }
