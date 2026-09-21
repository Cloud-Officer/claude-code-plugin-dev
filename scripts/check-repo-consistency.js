const fs = require('node:fs')
const path = require('node:path')
const { ROOT } = require('./workflow-helpers.js')

const PLUGIN = path.join(ROOT, '.claude-plugin', 'plugin.json')
const MARKETPLACE = path.join(ROOT, '.claude-plugin', 'marketplace.json')
const MCP = path.join(ROOT, '.mcp.json')
const SKILLS = path.join(ROOT, 'skills')
const SEARCH_ONLY_KEYWORDS = new Set(['meta-tags', 'ux-writing', 'tone-of-voice', 'modernization', 'language-migration', 'framework-migration'])

const errors = []

function fail(message) {
  errors.push(message)
}

function rel(file) {
  return path.relative(ROOT, file)
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    fail(rel(file) + ': does not parse — ' + error.message)
    return null
  }
}

function unquote(value) {
  const v = value.trim()

  if (v.startsWith('"') && v.endsWith('"')) return JSON.parse(v)
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'")

  return v
}

function frontmatter(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')

  if (lines[0] !== '---') {
    fail(rel(file) + ': no YAML frontmatter')
    return null
  }

  const out = {}

  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return out

    const field = /^([A-Za-z][\w-]*):[ \t](.*)$/.exec(lines[i])

    if (!field) {
      fail(rel(file) + ':' + (i + 1) + ': frontmatter line is not a single-line "key: value"')
      return null
    }

    out[field[1]] = unquote(field[2])
  }

  fail(rel(file) + ': frontmatter is never closed')
  return null
}

function skillDirs() {
  return fs.readdirSync(SKILLS, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()
}

function filesUnder(dir) {
  const out = []

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) out.push(...filesUnder(full))
    else out.push(full)
  }

  return out
}

function normalize(text) {
  return ' ' + String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' '
}

const plugin = readJson(PLUGIN)
const marketplace = readJson(MARKETPLACE)
const mcp = readJson(MCP)

if (plugin && marketplace) {
  const listed = (marketplace.plugins || []).find(entry => entry && entry.name === plugin.name)

  if (!listed) fail('marketplace.json lists no plugin named ' + JSON.stringify(plugin.name))
  else {
    for (const field of ['version', 'description']) {
      if (listed[field] !== plugin[field]) {
        fail('manifests disagree on ' + field + ':\n  plugin.json      ' + JSON.stringify(plugin[field]) + '\n  marketplace.json ' + JSON.stringify(listed[field]))
      }
    }
  }
}

if (mcp && (!mcp.mcpServers || typeof mcp.mcpServers !== 'object')) fail('.mcp.json has no mcpServers object')

const skills = skillDirs()

for (const skill of skills) {
  const file = path.join(SKILLS, skill, 'SKILL.md')

  if (!fs.existsSync(file)) {
    fail('skills/' + skill + ': no SKILL.md')
    continue
  }

  const meta = frontmatter(file)

  if (!meta) continue
  if (meta.name !== skill) fail(rel(file) + ': frontmatter name ' + JSON.stringify(meta.name) + ' does not match directory ' + JSON.stringify(skill))
  if (!meta.description) fail(rel(file) + ': frontmatter description is missing or empty')
  if (!meta['allowed-tools']) fail(rel(file) + ': frontmatter allowed-tools is missing or empty')
}

const sources = [path.join(ROOT, 'README.md'), ...filesUnder(path.join(ROOT, 'docs')), ...skills.flatMap(skill => filesUnder(path.join(SKILLS, skill)))]

for (const file of sources) {
  const text = fs.readFileSync(file, 'utf8')

  for (const [, target] of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}(\/[A-Za-z0-9._/-]+)/g)) {
    if (!fs.existsSync(path.join(ROOT, target))) fail(rel(file) + ': ${CLAUDE_PLUGIN_ROOT}' + target + ' does not exist')
  }
}

if (plugin) {
  const described = { ...plugin }

  delete described.keywords

  const corpus = normalize([JSON.stringify(described), JSON.stringify(marketplace), JSON.stringify(mcp), ...skills, ...sources.map(file => fs.readFileSync(file, 'utf8'))].join('\n'))

  const keywords = plugin.keywords || []
  const duplicates = [...new Set(keywords.filter((k, i) => keywords.indexOf(k) !== i))]

  if (duplicates.length) fail('plugin.json keywords repeat ' + duplicates.map(k => JSON.stringify(k)).join(', '))

  for (const keyword of plugin.keywords || []) {
    if (SEARCH_ONLY_KEYWORDS.has(keyword)) continue
    if (!corpus.includes(normalize(keyword))) fail('plugin.json keyword ' + JSON.stringify(keyword) + ' matches no skill, manifest or documentation text')
  }

  for (const keyword of SEARCH_ONLY_KEYWORDS) {
    if (!(plugin.keywords || []).includes(keyword)) fail('SEARCH_ONLY_KEYWORDS lists ' + JSON.stringify(keyword) + ', which plugin.json no longer carries')
  }
}

for (const error of errors) console.error('FAIL ' + error)

if (errors.length) process.exit(1)

console.log('ok   3 manifests parse and agree')
console.log('ok   ' + skills.length + ' skills declare name, description and allowed-tools')
console.log('ok   every ${CLAUDE_PLUGIN_ROOT} path resolves')
console.log('ok   ' + (plugin.keywords || []).length + ' keywords are unique and map to live skills or documentation')
