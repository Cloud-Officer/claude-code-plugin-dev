export const meta = {
  name: 'work-issue-parallel',
  description: 'Implement several issues at once: one worktree-isolated agent per issue (explore, implement, write+run tests, commit on a branch), returning a per-issue result the command turns into PR(s)',
  phases: [
    { title: 'Implement', detail: 'one worktree-isolated agent per issue: fetch, explore, implement, test, commit' },
  ],
}

// ---------------------------------------------------------------------------
// Parallel path for the work-issue command. Used ONLY when the user passes
// more than one issue. A single issue still runs the normal interactive flow
// in work-issue.md (clarifying-questions gate, architecture choice, per-step
// approval) — those gates need a human and don't fit a background workflow.
//
// Each issue is implemented by its OWN agent in its OWN git worktree
// (isolation: 'worktree') so parallel file edits never collide. Each agent
// commits its work on a dedicated branch; because worktrees share the repo's
// object store and refs, those branches persist after the worktree is removed,
// so the command can open PR(s) from them afterwards.
//
// This workflow deliberately STOPS at "committed on a branch, tests green". It
// does NOT open PRs — the command asks the user "separate PRs or one combined
// PR?" once, after this returns, and drives create-pr accordingly.
//
// Invoked by commands/work-issue.md via:
//   Workflow({ scriptPath: "${CLAUDE_PLUGIN_ROOT}/commands/work-issue.workflow.js",
//              args: { issues: [{ ref, tracker }], defaultBranch, repoRoot } })
// ---------------------------------------------------------------------------

const input = args || {}
const issues = Array.isArray(input.issues) ? input.issues : []
const defaultBranch = input.defaultBranch || 'main'
const repoRoot = input.repoRoot || '.'

function branchName(issue) {
  const ref = String(issue.ref)
  return issue.tracker === 'jira' ? ref.toUpperCase() : 'issue-' + ref
}

function buildImplementPrompt(issue) {
  const isJira = issue.tracker === 'jira'
  const ref = String(issue.ref)
  const branch = branchName(issue)
  return [
    'You are implementing ONE issue end-to-end inside an ISOLATED git worktree, in parallel with other agents',
    'working on other issues. Stay entirely within your worktree — never touch another issue\'s files or branch.',
    '',
    '## Issue',
    'Tracker: ' + (isJira ? 'Jira' : 'GitHub') + '  ·  Ref: ' + ref,
    'Base branch: origin/' + defaultBranch,
    'Your branch: ' + branch + (isJira ? '  (Jira keys are UPPERCASE)' : ''),
    '',
    '## Steps',
    '1. Fetch the issue details:',
    isJira
      ? '   - `mcp__atlassian__getJiraIssue` (preferred) or `jira issue view ' + ref + ' --comments 16`.'
      : '   - `mcp__github__get_issue` (preferred) or `gh issue view ' + ref + ' --comments`.',
    '   Read the title, description, acceptance criteria, and comments. If Figma URLs appear, pull design context',
    '   via `mcp__figma__*` when available (skip silently if not).',
    '',
    '2. Create your branch from the LATEST base, inside your worktree:',
    '   ```bash',
    '   git fetch --all --quiet',
    '   git checkout -b ' + branch + ' origin/' + defaultBranch + ' 2>/dev/null || git checkout ' + branch,
    '   git submodule update --init --recursive',
    '   ```',
    '',
    '3. Determine the issue TYPE and act accordingly:',
    '   - Bug → implement the fix directly (you already know the failure point). Write a regression test that',
    '     FAILS before the fix and PASSES after; confirm both.',
    '   - Task → implement directly. If non-trivial, briefly explore the relevant code first.',
    '   - Feature → explore similar features and the architecture before implementing, then build the smallest',
    '     correct change that satisfies the acceptance criteria.',
    '   You are autonomous here (no human to ask mid-run). Where the issue is ambiguous, choose the most',
    '   conventional interpretation, implement it, and RECORD the assumption in your result\'s `assumptions[]`',
    '   so the user can review it at PR time. Do not invent scope beyond the issue.',
    '',
    '4. Tests are a HARD GATE. Any behaviour-altering change must be covered by tests that pass:',
    '   - Find the project\'s test runner from the manifest/config; match the nearest existing tests\' style.',
    '   - Cover the success path AND the negative/failure paths AND the regression surface of anything shared',
    '     you changed.',
    '   - Run the narrow suite for the touched area. Capture the runner\'s OWN pass marker (e.g. `0 failures`,',
    '     `N passed`, `ok`, `** TEST SUCCEEDED **`) into `test_status` — never paraphrase "tests pass".',
    '   - No-test exception is narrow and must be stated: pure copy/i18n, static assets, formatting-only,',
    '     config/docs, generated files. "Hard to test" is NOT an exception — if you cannot test it, set',
    '     `success:false` and explain in `block_reason` rather than shipping untested code.',
    '',
    '5. Commit on your branch — single-line message, NO footers, NO co-authors, NO "Generated with Claude Code":',
    '   ```bash',
    '   git add -A',
    isJira
      ? '   git commit -m "' + ref + ': <brief description>"'
      : '   git commit -m "<PREFIX> #' + ref + ': <brief description>"   # PREFIX: Bug→Fix, Feature→Feat, Task→(none)',
    '   ```',
    '   Do NOT push and do NOT open a PR — the command handles PRs after all agents finish.',
    '',
    '## Return',
    'Report your result. `pr_title` and `closing_keyword` are what the command will use when it opens the PR:',
    isJira
      ? '- pr_title: "' + ref + ' <summary>"   ·   closing_keyword: "" (Jira closes via transition, not keywords)'
      : '- pr_title: "<PREFIX> #' + ref + ': <summary>"   ·   closing_keyword: "' + 'Fixes #' + ref + '" for a Bug, else "Closes #' + ref + '"',
    'Set `success:false` (with `block_reason`) if you could not implement or could not make tests pass — the',
    'command will surface it and skip that issue\'s PR rather than open a broken one.',
  ].join('\n')
}

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    ref: { type: ['string', 'integer'] },
    tracker: { type: 'string' },
    branch: { type: 'string' },
    issue_type: { type: 'string' },        // Bug | Feature | Task
    title: { type: 'string' },
    success: { type: 'boolean' },
    summary: { type: 'string' },           // what was implemented
    files_changed: { type: 'array', items: { type: 'string' } },
    test_status: { type: 'string' },       // pasted runner marker, or stated no-test exception
    assumptions: { type: 'array', items: { type: 'string' } },
    pr_title: { type: 'string' },
    closing_keyword: { type: 'string' },
    block_reason: { type: 'string' },      // when success:false
  },
  required: ['ref', 'branch', 'success', 'summary'],
}

// ===========================================================================
// PHASE: IMPLEMENT — one worktree-isolated agent per issue, in parallel.
// ===========================================================================
phase('Implement')

if (!issues.length) {
  log('No issues passed in — nothing to implement.')
  return { defaultBranch, repoRoot, results: [] }
}

log('Implementing ' + issues.length + ' issues in parallel, each in its own git worktree: ' + issues.map(i => i.ref).join(', '))

const results = await pipeline(
  issues,
  (issue) => agent(buildImplementPrompt(issue), {
    label: 'impl:' + issue.ref,
    phase: 'Implement',
    schema: RESULT_SCHEMA,
    agentType: 'general-purpose',
    isolation: 'worktree',
  }).then(r => {
    if (!r) return { ref: issue.ref, tracker: issue.tracker, branch: branchName(issue), success: false, summary: '', block_reason: 'agent did not return a result (skipped or errored)' }
    return { ...r, ref: r.ref ?? issue.ref, tracker: r.tracker || issue.tracker, branch: r.branch || branchName(issue) }
  })
)

const clean = results.filter(Boolean)
const ok = clean.filter(r => r.success)
const failed = clean.filter(r => !r.success)
log('Implemented ' + ok.length + '/' + issues.length + ' successfully' + (failed.length ? ' · ' + failed.length + ' need attention: ' + failed.map(f => f.ref).join(', ') : ''))

return { defaultBranch, repoRoot, results: clean }
