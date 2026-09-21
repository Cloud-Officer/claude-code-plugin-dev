const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { ROOT, harnessSource, workflowScripts } = require('./workflow-helpers.js')

const scripts = workflowScripts()
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-syntax-'))
let failed = 0

for (const file of scripts) {
  const wrapped = path.join(dir, path.basename(file))

  fs.writeFileSync(wrapped, harnessSource(fs.readFileSync(file, 'utf8')))

  try {
    execFileSync(process.execPath, ['--check', wrapped], { stdio: 'pipe' })
    console.log('ok   ' + path.relative(ROOT, file))
  } catch (error) {
    failed++
    console.error('FAIL ' + path.relative(ROOT, file) + '\n' + String(error.stderr || error.message))
  }
}

fs.rmSync(dir, { recursive: true, force: true })

if (!scripts.length) {
  console.error('FAIL no *.workflow.js found under skills/')
  process.exit(1)
}

console.log(scripts.length - failed + '/' + scripts.length + ' workflow scripts parse')
process.exit(failed ? 1 : 0)
