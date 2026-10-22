'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { after, describe, it } = require('node:test')

const SCRIPT = path.join(__dirname, '..', 'skills', 'query-db', 'scripts', 'db-tunnel.sh')
const PS_SCRIPT = path.join(__dirname, '..', 'skills', 'query-db', 'scripts', 'db-tunnel.ps1')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'db-tunnel-'))
const bin = path.join(tmp, 'bin')
const PORT = 40000 + Math.floor(Math.random() * 10000)
const OTHER_PORT = PORT + 1
const stateDir = path.join(tmp, 'state', 'co-dev', 'db-tunnels')

fs.mkdirSync(bin)
fs.writeFileSync(path.join(bin, 'ssm-jump'), [
  '#!/bin/bash',
  'for a in "$@"; do [ "$prev" = --forward ] && port=${a##*:}; prev=$a; done',
  'if [ -n "$FAKE_SSO_EXPIRED" ]; then echo "Error loading SSO Token: Token for x has expired"; exit 255; fi',
  'exec node -e "require(\'net\').createServer().listen($port, \'127.0.0.1\')" ssm start-session',
  ''
].join('\n'), { mode: 0o755 })

const baseEnv = {
  PATH: bin + path.delimiter + process.env.PATH,
  HOME: tmp,
  XDG_STATE_HOME: path.join(tmp, 'state'),
  DB_ENVS: 'beta rc',
  MYSQL_PORT_RC: String(PORT),
  MYSQL_TUNNEL_RC: `ssm-jump --profile acme -a api-rc --forward db.example.com:6033:${PORT}`
}

const run = (args, env = {}) => spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', env: { ...baseEnv, ...env } })

const bash = (script) => spawnSync('bash', ['-c', script], { encoding: 'utf8' }).stdout.trim()
const background = (command) => Number(bash(`${command} >/dev/null 2>&1 </dev/null & echo $!`))
const alive = (pid) => /^[^Z]/.test(bash(`ps -o stat= -p ${pid}`))
const identity = (pid) => spawnSync('ps', ['-o', 'lstart=,command=', '-p', String(pid)], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } }).stdout.replace(/\n$/, '')
const waitForPort = (port) => bash(`for i in $(seq 50); do (exec 3<>/dev/tcp/127.0.0.1/${port}) 2>/dev/null && echo up && exit; sleep 0.1; done`)
const listener = (port) => `node -e "require('net').createServer().listen(${port}, '127.0.0.1')"`
const writeState = (label, content) => {
  fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(path.join(stateDir, `${label}.pid`), content)
}
const strays = []

after(() => {
  for (const pid of strays) spawnSync('kill', [String(pid)])
  run(['close-all'])
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('db-tunnel.sh', () => {
  it('opens the tunnel, reuses it, reopens it after it drops, and closes it', () => {
    const opened = run(['ensure', 'mysql', 'rc'])
    assert.equal(opened.status, 0, opened.stdout)
    assert.match(opened.stdout, new RegExp(`^OPENED: rc mysql tunnel on 127\\.0\\.0\\.1:${PORT} `))

    const reused = run(['ensure', 'mysql', 'rc'])
    assert.match(reused.stdout, /^OPEN: .*started earlier by this skill/)

    const [pid] = fs.readFileSync(path.join(tmp, 'state', 'co-dev', 'db-tunnels', 'rc-mysql.pid'), 'utf8').trim().split(' ')
    spawnSync('pkill', ['-P', pid])
    spawnSync('kill', [pid])
    spawnSync('sleep', ['1'])

    const reopened = run(['ensure', 'mysql', 'rc'])
    assert.equal(reopened.status, 0, reopened.stdout)
    assert.match(reopened.stdout, /^REOPENED: /)

    const [reopenedPid] = fs.readFileSync(path.join(stateDir, 'rc-mysql.pid'), 'utf8').trim().split(' ')
    assert.match(run(['close', 'mysql', 'rc']).stdout, /^CLOSED: rc-mysql tunnel/)
    assert.equal(alive(reopenedPid), false)
    assert.match(run(['close', 'mysql', 'rc']).stdout, /^NOT-OURS: /)
  })

  it('never kills an unrelated process that reused a recorded PID', () => {
    const unrelated = background('sleep 60')
    strays.push(unrelated)
    const forged = identity(unrelated).replace(/sleep 60$/, `ssm-jump --forward db.example.com:6033:${OTHER_PORT}`)

    writeState('beta-mysql', `${unrelated} ${OTHER_PORT}\n`)
    writeState('beta-pg', `${unrelated} ${OTHER_PORT}\n${forged}\n`)
    const closed = run(['close-all'])
    assert.match(closed.stdout, /^NOT-OURS: the recorded beta-mysql process/m)
    assert.match(closed.stdout, /^NOT-OURS: the recorded beta-pg process/m)
    assert.equal(alive(unrelated), true)

    writeState('rc-mysql', `${unrelated} ${PORT}\n`)
    const reopened = run(['ensure', 'mysql', 'rc'])
    assert.match(reopened.stdout, /^REOPENED: /)
    assert.equal(alive(unrelated), true)
    run(['close', 'mysql', 'rc'])
    assert.equal(fs.existsSync(path.join(stateDir, 'beta-mysql.pid')), false)
  })

  it('never kills an unrelated listener on the tunnel port', () => {
    const tunnel = background('node -e "setInterval(() => {}, 1e6)" ssm start-session')
    const other = background(listener(OTHER_PORT))
    strays.push(tunnel, other)
    assert.equal(waitForPort(OTHER_PORT), 'up')
    assert.match(identity(tunnel), /ssm start-session$/)

    writeState('beta-mysql', `${tunnel} ${OTHER_PORT}\n${identity(tunnel)}\n`)
    assert.match(run(['close', 'mysql', 'beta'], { MYSQL_PORT_BETA: String(OTHER_PORT) }).stdout, /^WARNING: beta-mysql tunnel .* still listening/)
    assert.equal(alive(tunnel), false)
    assert.equal(alive(other), true)

    writeState('beta-mysql', `${tunnel} ${OTHER_PORT}\n`)
    assert.match(run(['close', 'mysql', 'beta']).stdout, /^NOT-OURS: /)
    assert.equal(alive(other), true)
  })

  it('rejects PID 0, PID 1 and malformed records without killing anything', () => {
    writeState('beta-mysql', `0 ${OTHER_PORT}\n`)
    writeState('beta-pg', `1 ${OTHER_PORT}\nThu  8 Oct 10:51:00 2026     ssm-jump\n`)
    writeState('beta-redis', '   \n')
    const result = run(['close-all'])
    assert.equal(result.stdout.match(/^NOT-OURS: /gm).length, 3, result.stdout)
    assert.doesNotMatch(result.stdout, /CLOSED|WARNING/)
    assert.deepEqual(fs.readdirSync(stateDir).filter((name) => name.endsWith('.pid')), [])
  })

  it('reports NONE when no tunnel variable is declared', () => {
    const result = run(['ensure', 'pg', 'rc'])
    assert.equal(result.status, 0)
    assert.match(result.stdout, /^NONE: PG_TUNNEL_RC is not set/)
  })

  const refusals = [
    ['an environment outside DB_ENVS', ['ensure', 'mysql', 'prod'], {}, /not listed in DB_ENVS/],
    ['an unknown engine', ['ensure', 'oracle', 'rc'], {}, /unknown engine/],
    ['a tunnel command that is not plain ssm-jump', ['ensure', 'mysql', 'rc'], { MYSQL_TUNNEL_RC: 'ssm-jump --forward a:1:2; touch pwned' }, /not a plain/],
    ['a tunnel without --forward', ['ensure', 'mysql', 'rc'], { MYSQL_TUNNEL_RC: 'ssm-jump --profile acme' }, /--forward/],
    ['a local port that differs from the connection port', ['ensure', 'mysql', 'rc'], { MYSQL_PORT_RC: '1' }, /forwards to local port/],
    ['a URL that does not use the forwarded port, without printing it', ['ensure', 'redis', 'rc'], { REDIS_URL_RC: 'redis://:s3cret@127.0.0.1:1/0', REDIS_TUNNEL_RC: `ssm-jump --forward c:6379:${PORT}` }, /does not use that port/]
  ]

  for (const [name, args, env, pattern] of refusals) {
    it(`refuses ${name}`, () => {
      const result = run(args, env)
      assert.equal(result.status, 1)
      assert.match(result.stdout, pattern)
      assert.doesNotMatch(result.stdout, /s3cret/)
      assert.equal(fs.existsSync(path.join(tmp, 'pwned')), false)
    })
  }

  it('warns after the outcome when a tunneled MongoDB URI lacks directConnection or tlsAllowInvalidHostnames', () => {
    const env = {
      MONGODB_URI_RC: `mongodb://u:s3cret@127.0.0.1:${PORT}/app?tls=true&replicaSet=rs0&retryWrites=false`,
      MONGODB_TUNNEL_RC: `ssm-jump --profile acme -a api-rc --forward docdb.example.com:27017:${PORT}`
    }
    const result = run(['ensure', 'mongodb', 'rc'], env)
    assert.equal(result.status, 0, result.stdout)
    const lines = result.stdout.trim().split('\n')
    assert.match(lines[0], /^OPENED: rc mongodb tunnel/)
    assert.match(lines[1], /^WARN: MONGODB_URI_RC sets replicaSet without directConnection=true/)
    assert.match(lines[2], /^WARN: MONGODB_URI_RC uses TLS without tlsAllowInvalidHostnames=true/)
    assert.doesNotMatch(result.stdout, /s3cret/)

    const fixed = run(['ensure', 'mongodb', 'rc'], { ...env, MONGODB_URI_RC: env.MONGODB_URI_RC + '&directConnection=true&tlsAllowInvalidHostnames=true' })
    assert.equal(fixed.stdout.trim().split('\n').length, 1)
    run(['close', 'mongodb', 'rc'])
  })

  it('fails fast with an SSO hint when ssm-jump exits', () => {
    const result = run(['ensure', 'mysql', 'rc'], { FAKE_SSO_EXPIRED: '1' })
    assert.equal(result.status, 1)
    assert.match(result.stdout, /^ERROR: rc mysql tunnel did not open/)
    assert.match(result.stdout, /HINT: SSO_EXPIRED profile=acme .*aws sso login --profile acme/)
  })
})

describe('db-tunnel.ps1', () => {
  const source = fs.readFileSync(PS_SCRIPT, 'utf8')

  it('records and verifies process name and start time before killing', () => {
    assert.match(source, /\$process\.ProcessName\) \$\(\$process\.StartTime/)
    assert.match(source, /Set-Content -Path \$stateFile -Value @\(.*Get-Identity \$process\.Id/)
    assert.match(source, /if \(-not \(Test-Ours \$state\)\) \{\s*Write-Output "NOT-OURS: /)
    assert.match(source, /if \(Test-Ours \$old\) \{ \[void\]\(Stop-Tunnel/)
  })

  it('rejects PIDs below 2 and never walks the tree from them', () => {
    assert.match(source, /\$id -lt 2/)
    assert.match(source, /\$current -lt 2 -or \$seen\.ContainsKey\(\$current\)/)
    assert.doesNotMatch(source, /Stop-Tree/)
  })

  it('limits the port fallback to the tunnel process tree', () => {
    assert.match(source, /Get-NetTCPConnection [^\n]*\| Where-Object \{ \$tree -contains \[int\]\$_\.OwningProcess \}/)
  })
})
