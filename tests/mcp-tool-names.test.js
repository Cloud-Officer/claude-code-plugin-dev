'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const root = path.join(__dirname, '..')
const skillsDir = path.join(root, 'skills')
const bundledServers = Object.keys(JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8')).mcpServers)

// query-db and analyze-db get their twins in a separate change.
const twinExempt = new Set(['query-db', 'analyze-db'])

const githubTools = new Set([
  'add_comment_to_pending_review', 'add_issue_comment', 'add_reply_to_pull_request_comment', 'assign_copilot_to_issue',
  'create_branch', 'create_or_update_file', 'create_pull_request', 'create_repository', 'delete_file',
  'delete_repository', 'fork_repository', 'get_commit', 'get_file_contents', 'get_label', 'get_latest_release',
  'get_me', 'get_release_by_tag', 'get_tag', 'get_team_members', 'get_teams', 'issue_read', 'issue_write',
  'list_branches', 'list_commits', 'list_issue_fields', 'list_issue_types', 'list_issues', 'list_pull_requests',
  'list_releases', 'list_repository_collaborators', 'list_tags', 'merge_pull_request', 'pull_request_read',
  'pull_request_review_write', 'push_files', 'request_copilot_review', 'search_code', 'search_commits',
  'search_issues', 'search_pull_requests', 'search_repositories', 'search_users', 'sub_issue_write',
  'update_issue_comment', 'update_pull_request', 'update_pull_request_branch', '*',
])

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name)
  return entry.isDirectory() ? walk(full) : [full]
})

const allowedTools = (file) => {
  const frontmatter = fs.readFileSync(file, 'utf8').split(/^---\s*$/m)[1] ?? ''
  const line = frontmatter.split('\n').find((l) => l.startsWith('allowed-tools:'))
  return line ? line.slice('allowed-tools:'.length).split(',').map((t) => t.trim()).filter(Boolean) : []
}

describe('MCP tool names', () => {
  for (const dir of fs.readdirSync(skillsDir)) {
    const file = path.join(skillsDir, dir, 'SKILL.md')
    if (twinExempt.has(dir) || !fs.existsSync(file)) continue
    const tools = new Set(allowedTools(file))

    it(`skills/${dir} grants both name forms for every bundled MCP server`, () => {
      for (const tool of tools) {
        const plain = tool.match(/^mcp__(.+?)__(.+)$/)
        if (plain && bundledServers.includes(plain[1])) {
          assert.ok(tools.has(`mcp__plugin_co-dev_${plain[1]}__${plain[2]}`), `${tool} has no plugin_co-dev twin`)
        }
        const prefixed = tool.match(/^mcp__plugin_co-dev_(.+?)__(.+)$/)
        if (prefixed) assert.ok(tools.has(`mcp__${prefixed[1]}__${prefixed[2]}`), `${tool} has no plain twin`)
      }
    })
  }

  it('references only current github-mcp-server tools', () => {
    const stale = walk(skillsDir).flatMap((file) => {
      const text = fs.readFileSync(file, 'utf8')
      return [...text.matchAll(/mcp__(?:plugin_co-dev_)?github__([A-Za-z0-9_*]+)/g)]
        .filter((m) => !githubTools.has(m[1]))
        .map((m) => `${path.relative(root, file)}: ${m[0]}`)
    })
    assert.deepEqual(stale, [])
  })
})
