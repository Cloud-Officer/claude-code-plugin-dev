'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'twilio', 'SKILL.md'), 'utf8')
const section = (heading) => skill.split(`\n## ${heading}\n`)[1].split('\n## ')[0]
const conventions = section('Request Conventions')
const safety = section('Safety Rules')
const flat = (text) => text.replace(/\s+/g, ' ')

const patterns = Object.fromEntries(
  conventions.split('\n')
    .map((line) => /^\| ([^|]+?) +\| `(\^[^`]+\$)` +\|/.exec(line))
    .filter(Boolean)
    .map(([, name, source]) => [name.trim(), new RegExp(source)])
)
const enumValue = /^[A-Za-z][A-Za-z-]*$/
const accepted = (value) => enumValue.test(value) || Object.values(patterns).some((re) => re.test(value))

const bashBlocks = [...skill.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1])
const SPEC_FETCH = /^curl -sS "https:\/\/raw\.githubusercontent\.com\/twilio\/twilio-oai\/main\/spec\/json\/[a-z0-9_]+\.json" \|/
const curlLines = bashBlocks.flatMap((block) => block.split('\n')).filter((line) => /\bcurl\b/.test(line) && !SPEC_FETCH.test(line))
const AUTH = '-u "${TWILIO_API_KEY:-$TWILIO_ACCOUNT_SID}:${TWILIO_API_SECRET:-$TWILIO_AUTH_TOKEN}"'

describe('twilio skill value patterns', () => {
  it('declares a pattern for every value kind it substitutes', () => {
    for (const name of ['Phone number (E.164)', 'SID', 'Date', 'HTTPS URL (webhook, media)', 'Name or label (`FriendlyName`)']) {
      assert.ok(patterns[name], `no pattern row for ${name}`)
    }
  })

  it('accepts the documented examples', () => {
    assert.ok(patterns['Phone number (E.164)'].test('+15551234567'))
    assert.ok(patterns['Phone number (E.164)'].test('whatsapp:+15551234567'))
    assert.ok(patterns.SID.test('SM0123456789abcdef0123456789abcdef'))
    assert.ok(patterns['HTTPS URL (webhook, media)'].test('https://example.com/twilio/sms?x=1&y=2'))
    assert.ok(patterns['Name or label (`FriendlyName`)'].test('Support line'))
  })

  it('rejects every value that could break out of a single-quoted shell literal', () => {
    const hostile = ["+1555'; id", '+1555$(id)', '+1555`id`', 'SM"0123', "https://x.com/'a", 'https://x.com/$(id)', 'https://x.com/`id`', 'a\nb', "O'Brien"]
    for (const value of hostile) {
      for (const [name, re] of Object.entries(patterns)) assert.equal(re.test(value), false, `${name} accepts ${JSON.stringify(value)}`)
    }
  })

  it('rejects plain-http and credential-bearing webhook URLs', () => {
    const url = patterns['HTTPS URL (webhook, media)']
    assert.equal(url.test('http://example.com/sms'), false)
    assert.equal(url.test('https://user:pass@example.com/sms'), false)
  })

  it('sends free text through stdin, never on the command line', () => {
    assert.match(flat(conventions), /never goes on the command line/)
    assert.match(conventions, /--data-urlencode 'Body@-'/)
    assert.match(flat(conventions), /rejected, not cleaned up/)
  })
})

describe('twilio skill curl examples', () => {
  it('has curl examples to check', () => {
    assert.ok(curlLines.length >= 10, `only ${curlLines.length} curl lines found`)
  })

  it('authenticates every call the same way and never puts a secret in the URL', () => {
    for (const line of curlLines) {
      assert.ok(line.includes(AUTH), `curl without the standard -u credentials: ${line}`)
      assert.doesNotMatch(line, /https:\/\/[^"' ]*(TOKEN|SECRET)/, line)
    }
  })

  it('passes every form field as a single-quoted value that matches a declared pattern', () => {
    for (const line of curlLines) {
      assert.doesNotMatch(line, /\s-d\s|--data\s|--data-raw|--data-urlencode\s+"/, `unquoted or raw form data: ${line}`)
      for (const [, field] of line.matchAll(/--data-urlencode '([^']*)'/g)) {
        if (field.endsWith('@-')) continue
        const value = field.slice(field.indexOf('=') + 1)
        assert.ok(accepted(value), `value ${JSON.stringify(value)} matches no declared pattern`)
      }
    }
  })

  it('quotes every heredoc delimiter so the text is never expanded', () => {
    for (const block of bashBlocks) {
      for (const [, delimiter] of block.matchAll(/<<\s*(\S+)/g)) assert.match(delimiter, /^'[A-Z_]+'$/, `unquoted heredoc ${delimiter}`)
    }
  })

  it('pre-encodes range-filter operators curl leaves raw in field names', () => {
    for (const line of curlLines) assert.doesNotMatch(line, /--data-urlencode '[A-Za-z]+[<>]=/, line)
  })
})

describe('twilio skill pagination and polling', () => {
  it('follows next-page links only on the same Twilio host and bounds the walk', () => {
    const rule = flat(conventions.split('**Pagination.**')[1].split('\n\n')[0])
    assert.match(rule, /only when its host is the same Twilio host/)
    assert.match(rule, /never send the credentials anywhere else/)
    assert.match(rule, /Stop after 20 pages/)
  })

  it('stops polling a send at a terminal status or the cap and reports the SID', () => {
    const recipe = flat(skill.split('**Messages and calls in flight**')[1].split('\n\n')[0])
    for (const status of ['delivered', 'undelivered', 'failed', 'completed', 'busy', 'no-answer', 'canceled']) {
      assert.ok(recipe.includes(`\`${status}\``), `polling misses ${status}`)
    }
    assert.match(recipe, /12 polls/)
    assert.match(recipe, /report the SID and the last status/)
  })
})

describe('twilio skill safety rules', () => {
  const rules = flat(safety)

  it('gates sends, deletes and spending behind an explicit yes', () => {
    for (const marker of ['**S — sends**', '**D — deletes and irreversible changes**', '**$ — spending**', '**W — writes**']) {
      assert.ok(rules.includes(marker), `missing ${marker}`)
    }
    assert.match(rules, /single test number the user names first/)
    assert.match(rules, /estimated cost from the Pricing API/)
  })

  it('never works around an opt-out', () => {
    assert.match(rules, /Never send to a number that replied STOP \(error 21610\)/)
  })

  it('keeps new secrets out of the conversation', () => {
    assert.match(rules, /Creating an API key or subaccount/)
    assert.match(rules, /report only the path, the SID and the friendly name/)
  })

  it('marks every endpoint row with an access level', () => {
    const rows = section('Endpoint Reference').split('\n').filter((line) => /^\| (GET|POST|DELETE)/.test(line))
    assert.ok(rows.length > 40, `only ${rows.length} endpoint rows`)
    for (const row of rows) {
      const access = row.split('|')[3].trim()
      assert.match(access, /^(R|W|D|S|\$)( \/ (R|W|D|S|\$))?$/, row)
    }
  })

  it('leaves SendGrid email to the sendgrid skill', () => {
    const description = /^description: (.*)$/m.exec(skill)[1]
    assert.match(description, /SendGrid email, use the sendgrid skill instead/)
  })
})
