'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { buildDsn, stubResponse } = require('../mcp/dbhub.js')

const PG = { PGUSER: 'app', PGPASSWORD: 'p@ss:w/rd', PGHOST: 'localhost', PGPORT: '5432', PGDATABASE: 'main' }

test('buildDsn returns a postgres DSN when every variable is set', () => {
  assert.equal(buildDsn('postgres', PG), 'postgres://app:p%40ss%3Aw%2Frd@localhost:5432/main')
})

test('buildDsn returns null when any variable is missing or empty', () => {
  assert.equal(buildDsn('postgres', { ...PG, PGHOST: '' }), null)
  assert.equal(buildDsn('mysql', {}), null)
})

test('buildDsn rejects an unknown engine', () => {
  assert.throws(() => buildDsn('oracle', {}), /unknown engine/)
})

test('stub answers initialize and lists no tools', () => {
  const init = stubResponse({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })
  assert.equal(init.result.protocolVersion, '2025-03-26')
  assert.deepEqual(stubResponse({ jsonrpc: '2.0', id: 2, method: 'tools/list' }).result, { tools: [] })
})

test('stub ignores notifications and rejects unknown methods', () => {
  assert.equal(stubResponse({ jsonrpc: '2.0', method: 'notifications/initialized' }), null)
  assert.equal(stubResponse({ jsonrpc: '2.0', id: 3, method: 'tools/call' }).error.code, -32601)
})

test('script runs the stub over stdio when the variables are unset', async () => {
  const env = { ...process.env }
  for (const name of Object.keys(PG)) delete env[name]
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'mcp', 'dbhub.js'), 'postgres'], { env })
  child.stdin.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n')
  let out = ''
  for await (const chunk of child.stdout) out += chunk
  assert.deepEqual(JSON.parse(out), { jsonrpc: '2.0', id: 1, result: { tools: [] } })
})
