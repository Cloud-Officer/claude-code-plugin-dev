const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { after, describe, it } = require('node:test')

const SCRIPT = path.join(__dirname, '..', 'skills', 'query-db', 'scripts', 'db-tunnel.sh')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'db-tunnel-'))
const bin = path.join(tmp, 'bin')
const PORT = 40000 + Math.floor(Math.random() * 10000)

fs.mkdirSync(bin)
fs.writeFileSync(path.join(bin, 'ssm-jump'), [
  '#!/bin/bash',
  'for a in "$@"; do [ "$prev" = --forward ] && port=${a##*:}; prev=$a; done',
  'if [ -n "$FAKE_SSO_EXPIRED" ]; then echo "Error loading SSO Token: Token for x has expired"; exit 255; fi',
  'exec node -e "require(\'net\').createServer().listen($port, \'127.0.0.1\')"',
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

after(() => {
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

    assert.match(run(['close', 'mysql', 'rc']).stdout, /^CLOSED: rc-mysql tunnel/)
    assert.match(run(['close', 'mysql', 'rc']).stdout, /^NOT-OURS: /)
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

  it('fails fast with an SSO hint when ssm-jump exits', () => {
    const result = run(['ensure', 'mysql', 'rc'], { FAKE_SSO_EXPIRED: '1' })
    assert.equal(result.status, 1)
    assert.match(result.stdout, /^ERROR: rc mysql tunnel did not open/)
    assert.match(result.stdout, /HINT: SSO_EXPIRED profile=acme .*aws sso login --profile acme/)
  })
})
