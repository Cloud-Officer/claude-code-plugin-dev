// *.workflow.js uses top-level `return` and cannot be require()d, so a named pure function is sliced out of its source bytes instead.
const fs = require('node:fs')

function sliceFunction(source, name) {
  const marker = '\nfunction ' + name + '('
  const start = source.indexOf(marker)
  if (start === -1) throw new Error('no top-level function named ' + name + ' in the workflow source')
  let depth = 0
  let opened = false
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '{') {
      depth += 1
      opened = true
    } else if (ch === '}') {
      depth -= 1
      if (opened && depth === 0) return source.slice(start + 1, i + 1)
    }
  }
  throw new Error('unbalanced braces while slicing ' + name)
}

function extractWorkflowFunctions(filePath, names) {
  const source = fs.readFileSync(filePath, 'utf8')
  const bodies = names.map(name => sliceFunction(source, name)).join('\n\n')
  return new Function(bodies + '\nreturn { ' + names.join(', ') + ' }')()
}

module.exports = { extractWorkflowFunctions, sliceFunction }
