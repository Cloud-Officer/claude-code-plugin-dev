#!/usr/bin/env node
'use strict'

const { spawn } = require('node:child_process')
const path = require('node:path')
const readline = require('node:readline')

const ENGINES = {
  postgres: { scheme: 'postgres', vars: ['PGUSER', 'PGPASSWORD', 'PGHOST', 'PGPORT', 'PGDATABASE'] },
  mysql: { scheme: 'mysql', vars: ['MYSQL_USER', 'MYSQL_PASS', 'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_DB'] },
}

function buildDsn(engine, env = process.env) {
  const spec = ENGINES[engine]
  if (!spec) throw new Error(`unknown engine: ${engine}`)
  const values = spec.vars.map(name => env[name])
  if (values.some(value => !value)) return null
  const [user, pass, host, port, db] = values.map(encodeURIComponent)
  return `${spec.scheme}://${user}:${pass}@${host}:${port}/${db}`
}

function stubResponse(message) {
  if (message?.id === undefined || message.id === null) return null
  const reply = result => ({ jsonrpc: '2.0', id: message.id, result })
  switch (message.method) {
    case 'initialize':
      return reply({
        protocolVersion: message.params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'dbhub-disabled', version: '1.0.0' },
      })
    case 'tools/list':
      return reply({ tools: [] })
    case 'ping':
      return reply({})
    default:
      return { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } }
  }
}

function runStub(input = process.stdin, output = process.stdout) {
  const lines = readline.createInterface({ input })
  lines.on('line', line => {
    let message
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    const response = stubResponse(message)
    if (response) output.write(JSON.stringify(response) + '\n')
  })
}

function runDbhub(dsn) {
  const args = ['-y', '@bytebase/dbhub', '--transport', 'stdio']
  const [command, argv] = process.platform === 'win32'
    ? [process.execPath, [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js'), ...args]]
    : ['npx', args]
  const child = spawn(command, argv, { stdio: 'inherit', env: { ...process.env, DSN: dsn } })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
  child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0))
}

if (require.main === module) {
  const dsn = buildDsn(process.argv[2])
  if (dsn) runDbhub(dsn)
  else runStub()
}

module.exports = { ENGINES, buildDsn, stubResponse }
