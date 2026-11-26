#!/usr/bin/env node
'use strict'

const COMPOSE = /(send|draft|reply|forward|compose)/i
const NOT_COMPOSE = /(^|[_-])(list|get|search|read|delete|trash|label|filter|modify|batch)([_-]|$)/i
const SKIP_KEY = /(^|_)(to|cc|bcc|from|sender|recipients?|address(es)?|id|ids|email|emails|attachments?|references|in_reply_to|url|path|raw)$/i
const BODY_KEY = /(body|content|html|text|message|note)/i
const FORMAT_KEY = /^(body_?format|body_?type|content_?type|mime_?type|format)$/i
const PLAIN_FORMAT = /^(plain|text|text\/plain)$/i
const DASH = /[‒–—―]/
const DOUBLE_HYPHEN = /(\s|\w)--(\s|\w)/
const TAG_START = /[A-Za-z/!?]/
const LINE_BREAK_TAG =/^<(br|\/p|\/li|\/div|\/h[1-6]|\/tr|\/blockquote)\b/i

const MARKDOWN = [
  ['a Markdown bullet ("- ", "* ", "• ")', /^\s*[-*+•·▪◦]\s+\S/],
  ['a typed numbered line ("1. ")', /^\s*\d+[.)]\s+\S/],
  ['a Markdown heading ("# ")', /^\s*#{1,6}\s/],
  ['Markdown bold ("**text**")', /\*\*[^*\n]+\*\*|__[^_\n]+__/],
  ['a Markdown link ("[text](url)")', /\[[^\]\n]+\]\((https?:|mailto:)[^)\s]+\)/],
  ['Markdown code ("`text`")', /`[^`\n]+`/],
  ['a Markdown table row ("| a | b |")', /^\s*\|.*\|\s*$/],
]

function isComposeTool(name) {
  if (!/^mcp__/.test(name) || !/(mail|outlook)/i.test(name)) return false

  const op = name.split('__').pop()
  return COMPOSE.test(op) && !NOT_COMPOSE.test(op)
}

function fields(value, key = '', out = []) {
  if (typeof value === 'string') out.push({ key, value })
  else if (Array.isArray(value)) value.forEach(v => fields(v, key, out))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) if (!SKIP_KEY.test(k)) fields(v, k, out)
  }

  return out
}

function visibleText(text) {
  let out = ''
  let i = 0

  while (i < text.length) {
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4)
      i = end === -1 ? text.length : end + 3
    } else if (text[i] === '<' && TAG_START.test(text[i + 1] ?? '') && text.indexOf('>', i + 1) !== -1) {
      const end = text.indexOf('>', i + 1)
      if (LINE_BREAK_TAG.test(text.slice(i, end + 1))) out += '\n'
      i = end + 1
    } else {
      out += text[i++]
    }
  }

  return out.replace(/&nbsp;/g, ' ')
}

function snippet(text, at) {
  const start = Math.max(0, at - 20)
  return JSON.stringify(text.slice(start, at + 20).replace(/\s+/g, ' ').trim())
}

function problems(input) {
  const found = []
  const all = fields(input)
  const bodies = all.filter(f => BODY_KEY.test(f.key) && !FORMAT_KEY.test(f.key) && f.value.trim())

  for (const { key, value } of all) {
    if (FORMAT_KEY.test(key)) continue

    const text = visibleText(value)
    const dash = DASH.exec(text) || DOUBLE_HYPHEN.exec(text)
    if (dash) found.push('an em or en dash in ' + (key || 'the input') + ' near ' + snippet(text, dash.index))
  }

  for (const { key, value } of bodies) {
    const lines = visibleText(value).split('\n')

    for (const [label, pattern] of MARKDOWN) {
      const line = lines.find(l => pattern.test(l))
      if (line !== undefined) found.push(label + ' in ' + key + ': ' + JSON.stringify(line.trim().slice(0, 60)))
    }
  }

  const plain = all.find(f => FORMAT_KEY.test(f.key) && PLAIN_FORMAT.test(f.value.trim()))
  if (plain && bodies.length) found.push(plain.key + ' is "' + plain.value + '"; set it to HTML so lists and paragraphs render natively in every mail client')

  return found
}

function decide(input, env = process.env) {
  if (String(env.CO_DEV_EMAIL_GUARD ?? '').toLowerCase() === 'off') return null

  const name = String(input?.tool_name ?? '')
  if (!isComposeTool(name)) return null

  const found = problems(input.tool_input ?? {})
  if (!found.length) return null

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Email blocked by the house email style: ' + found.join('; ') + '. Rewrite and call the tool again: no em or en dashes and no "--" (use a comma, colon, period or parentheses, and "to" for ranges); an HTML body (body_format "html", or contentType "HTML") with <p> paragraphs and real <ul>/<ol><li> lists; no Markdown syntax. The co-dev:email-writing skill has the full rules.',
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

module.exports = { decide, isComposeTool, problems, visibleText }
