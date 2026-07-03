---
name: work-issue
description: "Implement one or more GitHub issues or Jira tickets end-to-end — explore, design, implement, and open a PR. Multiple issues run in parallel. Use when the user wants to work on an issue, implement a ticket, fix a bug from a tracker, or take a GitHub issue or Jira key from description to pull request."
allowed-tools: Bash(git:*), Bash(gh:*), Bash(jira:*), Bash(awk:*), Bash(cat:*), Bash(echo:*), Bash(grep:*), Bash(jq:*), Bash(sed:*), Bash(tr:*), Read, Edit, Write, Glob, Grep, TodoWrite, Agent, Workflow, AskUserQuestion, mcp__github__*, mcp__atlassian__*, mcp__figma__*
---

## Arguments

The user names one or more issues to work on — GitHub issue numbers or Jira keys (e.g. `123` or `PROJ-456`). Parse them from the request. In the steps below, `<issue>` stands for the issue reference currently being worked; when several are given, run them in parallel as described.

## Run from the target repo's directory (direnv)

The CLI fallbacks below authenticate with credentials that [direnv](https://direnv.net/) loads from the `.envrc` of the **current working directory**: `GITHUB_TOKEN` for `gh`/`git`, and the Jira credentials for the `jira` CLI. Run one of these from a directory whose `.envrc` belongs to a **different** repo and it authenticates as the wrong account — the command fails, or the PR is opened against the wrong place.

**Before any command that needs per-repo credentials (`gh`, `git push`, `git fetch`, `jira`), make the target repo the working directory in its own step:**

```bash
cd /path/to/target-repo        # or, when already inside it: cd "$(git rev-parse --show-toplevel)"
```

Run the `cd` as a **separate** Bash call — never chain it as `cd … && gh …`. direnv reloads `.envrc` on the next prompt, so the *following* calls get the right token; a command on the same line as the `cd` still runs with the old environment. Step 3 already `cd`s into `$REPO_ROOT` (or the worktree under it) — keep every later `gh`/`jira`/`git push` running from there. MCP tools (`mcp__github__*`, `mcp__atlassian__*`) captured their credentials when Claude started and are unaffected.

## MCP Tools with Fallbacks

This command uses MCP tools when available and falls back gracefully if they are unavailable or return errors.

### GitHub Access

**Prefer MCP tools** (`mcp__github__*`) when available. If MCP tools are not available (tool not found errors), **fall back to the `gh` CLI**.

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Check issues enabled | `mcp__github__list_issues` (if it succeeds, issues are enabled) | `gh repo view --json hasIssuesEnabled --jq '.hasIssuesEnabled'` |
| Get issue details | `mcp__github__get_issue` | `gh issue view <issue> --comments` |
| Create PR | `mcp__github__create_pull_request` | `gh pr create --base ... --head ... --title "..." --body "..."` |
| Update issue | `mcp__github__update_issue` | `gh issue edit <issue> --title "..." --body "..."` |
| Add comment | `mcp__github__add_issue_comment` | `gh issue comment <issue> --body "..."` |
| Get repo owner/name | Parse from `git remote get-url origin` | `gh repo view --json owner,name` |

**Note:** MCP tools require `owner` and `repo` parameters. Extract these from `git remote get-url origin` (parse the owner/repo from the URL).

### Jira Access

**Prefer MCP tools** (`mcp__atlassian__*`) when available. If MCP tools are not available (tool not found errors), **fall back to the `jira` CLI**.

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Get issue details | `mcp__atlassian__getJiraIssue` | `jira issue view <issue> --comments 16` |
| Transition issue | `mcp__atlassian__transitionJiraIssue` | `jira issue move <issue> "Code Review"` |
| Update issue | `mcp__atlassian__editJiraIssue` | `jira issue edit <issue> --summary "..." --description "..."` |
| Add comment | `mcp__atlassian__addCommentToJiraIssue` | `jira issue comment add <issue> "..."` |
| Get transitions | `mcp__atlassian__getTransitionsForJiraIssue` | N/A (not needed with CLI) |

### Figma Design Context

When the issue description or comments contain Figma URLs (`figma.com/design/...` or `figma.com/file/...`), use Figma MCP tools to pull design context before implementing. If Figma MCP is unavailable, skip this step — do not block implementation.

| Operation | MCP Tool |
| --- | --- |
| Get design context | `mcp__figma__get_design_context` |
| Get screenshot | `mcp__figma__get_screenshot` |
| Search design system | `mcp__figma__search_design_system` |

## Single issue vs. multiple issues (mode select)

Parse `<issue>` into a list of issue refs (split on whitespace and/or commas; e.g. `123 124 DEV-5` or `123, 124`). Count them:

- **One ref → sequential mode (default).** Run the full interactive workflow below (Steps 0–12) exactly as written. The clarifying-questions gate (Step 5) and architecture-choice gate (Step 6) need a human in the loop, so a single issue keeps the rich back-and-forth.
- **Two or more refs → parallel mode.** Implement them concurrently via the workflow described in the next section, then open PR(s). Use parallel mode when the user passes a batch of issues — it is best for Bugs and well-specified Tasks. If any ref is a **Feature likely to need design discussion**, tell the user it is better done on its own in sequential mode, and offer to either implement it autonomously (the agent records its assumptions for review) or split it out.

---

## Parallel mode (multiple issues)

Each issue is implemented by its own agent in its own **git worktree**, so parallel file edits never collide. The fan-out runs as a deterministic workflow (`work-issue.workflow.js`); your job in the command is the preflight, launching the workflow, and the human-in-the-loop PR decision at the end.

**Why a workflow:** the per-issue explore → implement → test → commit loop is independent across issues, so it parallelises cleanly. What does NOT parallelise — the single "separate vs. combined PR" decision and PR creation itself — stays here in the command.

### P1 — Preflight

`cd` into the target repo in its own Bash call (so direnv loads the right token — see the direnv note above), then gather the base context once:

```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
REPO_ROOT=$(git rev-parse --show-toplevel)
git fetch --all --quiet
```

Detect the tracker once (`gh repo view --json hasIssuesEnabled --jq '.hasIssuesEnabled'`) and reuse it for every ref — a batch is assumed to target one repo/tracker. Refuse to start if the working tree has uncommitted changes (the worktrees branch from `origin/$DEFAULT_BRANCH`, but a dirty main checkout still signals risk) — ask the user to stash/commit first.

### P2 — Launch the workflow

```text
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/work-issue/work-issue.workflow.js",
  args: {
    defaultBranch: "<DEFAULT_BRANCH>",
    repoRoot: "<REPO_ROOT>",
    issues: [ { ref: "123", tracker: "github" }, { ref: "124", tracker: "github" } ]
  }
})
```

Each agent fetches its issue, creates branch `issue-<n>` (GitHub) or `<KEY>` uppercase (Jira) from `origin/$DEFAULT_BRANCH`, implements the change, **writes and runs tests (hard gate — same rule as Step 8)**, and commits with the correct issue-tagged, signature-free message. Agents are autonomous (no mid-run questions) and record any judgement calls in `assumptions[]`. They do **not** push or open PRs. The workflow returns:

```text
{
  defaultBranch, repoRoot,
  results: [ { ref, tracker, branch, issue_type, title, success, summary,
               files_changed, test_status, assumptions, pr_title, closing_keyword, block_reason } ]
}
```

The implementation rules (branch naming, issue-type → commit prefix, the test hard-gate, no-signature commits) live in `${CLAUDE_PLUGIN_ROOT}/skills/work-issue/work-issue.workflow.js` — edit that file to tune the parallel path.

### P3 — Review results

Present a compact per-issue summary from `results`: outcome, branch, `test_status`, `files_changed`, and any `assumptions`. For any `success:false`, show `block_reason` and **exclude it from PR creation** — offer to retry it in sequential mode. Let the user eyeball the diffs (`git diff origin/$DEFAULT_BRANCH...<branch>`) before opening anything.

### P4 — Ask: separate PRs or one combined PR?

Once the user is happy, use `AskUserQuestion` to decide how to ship the successful branches:

- **Separate PRs (one per issue)** — for each successful result, open a PR from its branch via the `create-pr` skill, using its `pr_title` and adding its `closing_keyword` to the PR **body** (GitHub). This is the default when the issues are unrelated.
- **Single combined PR** — create one integration branch from `origin/$DEFAULT_BRANCH`, merge each successful issue branch into it (`git merge --no-ff <branch>` per issue; resolve any conflicts, re-run tests), then open one PR via `create-pr`. Put **every** issue's closing keyword on its own line in the body (`Closes #123`, `Fixes #124`, …) so all of them auto-close on merge. Use this when the issues are tightly related or the user wants a single review.

In both cases the `create-pr` skill handles running tests locally, pushing, opening the PR, and watching CI (via the Actions runs REST API) — do not `git push` / `gh pr create` yourself. After PRs are open, run Steps 10–11 (update issue, post the tester QA checklist) per issue, and for Jira transition each to **Code Review**. Then clean up worktrees (`git worktree remove .worktrees/<branch>` or the workflow's temporary worktrees) once the user confirms, preserving the branches until the PRs merge.

---

## Detect Issue Tracker

```bash
# Fallback if MCP tools unavailable
gh repo view --json hasIssuesEnabled --jq '.hasIssuesEnabled'
```

- **GitHub** (if `true`): Use `mcp__github__*` tools (preferred) or `gh issue` commands, branch name `issue-<issue>`
- **Jira** (if `false`): Use `jira` commands, branch name `<issue>` (uppercase)

## Detect Issue Type

After fetching the issue details, determine the issue type:

**GitHub:** Check the issue labels for type indicators:

- Labels containing `bug`, `fix`, `defect` → **Bug**
- Labels containing `feature`, `enhancement`, `story` → **Feature**
- Otherwise → **Task**

**Jira:** Use the issue type field directly:

- `Bug` → **Bug**
- `Story` → **Feature**
- `Task`, `Sub-task`, or other → **Task**

### Commit Prefix by Issue Type

| Issue Type | GitHub Commit Format | GitHub PR Title Format |
| --- | --- | --- |
| Bug | `Fix #<issue>: <description>` | `Fix #<issue>: <summary>` |
| Feature | `Feat #<issue>: <description>` | `Feat #<issue>: <summary>` |
| Task | `#<issue>: <description>` | `#<issue>: <summary>` |

For Jira issues, always use `<issue>: <description>` (the Jira key is the prefix).

## Workflow (sequential mode — single issue)

This is the full interactive flow for **one** issue. For two or more issues, use Parallel mode above instead; it reuses these same rules (issue-type detection, the test hard-gate, commit/PR conventions) but runs them per-issue in isolated worktrees.

Steps 4–6 are gated by Issue Type (detected above) — the gating note on each step shows when to run it. **Step 8 (write and run unit tests) is a hard gate for any change that alters behavior**, regardless of issue type; the PR cannot be opened until it is satisfied or an explicit no-test exception applies.

0. **Initialize todo list** (all types)

   Use `TodoWrite` to create a todo list of the workflow steps for this issue. Mark each item completed as you finish it. This survives context compaction and gives the user a stable progress view across long sessions.

1. **Get issue details** (all types) — Present to user before proceeding
   - GitHub: `mcp__github__get_issue` (preferred) or `gh issue view <issue> --comments`
   - Jira: `mcp__atlassian__getJiraIssue` (preferred) or `jira issue view <issue> --comments 16`

2. **Extract Figma design context** (all types — only if Figma links are present)

   Scan the issue title, description, and comments for Figma URLs (matching `figma.com/design/` or `figma.com/file/`). If found:

   1. Use `mcp__figma__get_design_context` with the Figma URL to extract layout, styling, and component information
   2. Use `mcp__figma__get_screenshot` to capture a visual reference of the design
   3. If the project uses a design system, use `mcp__figma__search_design_system` to find matching components

   Present the design context to the user alongside the issue details. Use this context to guide implementation — match spacing, colors, typography, and component structure from the design.

   **If no Figma links are found or Figma MCP is unavailable, skip this step.**

3. **Prepare an isolated branch** (all types)

   ```bash
   DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
   REPO_ROOT=$(git rev-parse --show-toplevel)
   cd "$REPO_ROOT"
   git fetch --all
   ```

   Decide the branch name from the issue tracker:

   - GitHub: `BRANCH=issue-<issue>`
   - Jira: `BRANCH=<issue>` (uppercase — matches the Jira key)

   **Worktree usage is opt-in based on what the repo already does.** Worktrees are great for keeping the user's main checkout untouched and running multiple issues in parallel, but introducing them into a repo that doesn't use them adds a `.worktrees/` directory, a `.gitignore` change, and a workflow expectation the rest of the team may not share. So default to plain branching, and only use a worktree if the repo is already set up for it.

   Detect whether the repo already uses worktrees:

   ```bash
   USE_WORKTREE=no
   if [ -d "$REPO_ROOT/.worktrees" ]; then
     USE_WORKTREE=yes
   elif [ "$(git worktree list --porcelain | grep -c '^worktree ')" -gt 1 ]; then
     # More than one worktree registered (the main checkout itself counts as 1).
     USE_WORKTREE=yes
   fi
   ```

   ### Path A — `USE_WORKTREE=no` (default for repos not already using worktrees)

   Use plain `git checkout -b` against the latest default branch:

   ```bash
   # Refuse to clobber uncommitted changes in the user's main checkout.
   if ! git diff --quiet || ! git diff --cached --quiet; then
     echo "Uncommitted changes in the working tree — stash, commit, or discard before continuing." >&2
     exit 1
   fi
   git checkout -b "$BRANCH" "origin/$DEFAULT_BRANCH"
   git submodule update --init --recursive
   ```

   All subsequent steps run from `$REPO_ROOT` on the new branch.

   ### Path B — `USE_WORKTREE=yes` (only when the repo already uses worktrees)

   Ensure `.worktrees/` is gitignored. If it isn't, add and commit the change before creating the worktree (otherwise the worktree contents would pollute `git status`):

   ```bash
   if ! git check-ignore -q .worktrees 2>/dev/null; then
     echo ".worktrees/" >> .gitignore
     git add .gitignore && git commit -m "Ignore .worktrees/ directory"
   fi
   ```

   Create the worktree on a new branch based on the **latest** default branch (not the user's current `HEAD`):

   ```bash
   git worktree add ".worktrees/$BRANCH" -b "$BRANCH" "origin/$DEFAULT_BRANCH"
   cd ".worktrees/$BRANCH"
   git submodule update --init --recursive
   ```

   All subsequent steps (exploration, edits, commit, push, PR) run from inside `.worktrees/$BRANCH`. The user's main checkout is untouched.

   **Note for Claude Code users:** `claude --worktree <name>` provides a similar isolated-workspace flow at the harness level. This command intentionally manages the worktree itself so the workflow is portable across CLI invocations.

4. **Codebase exploration** (Feature: required · Task: if non-trivial · Bug: skip)

   Launch 2–3 explorer agents in parallel via the `Agent` tool with `subagent_type: Explore`. Each should focus on a different aspect of the codebase and return a list of 5–10 key files to read. Example prompts:

   - "Find features similar to `<feature>` and trace through their implementation. Return the 5–10 most important files."
   - "Map the architecture and abstractions for `<feature area>`. Return the 5–10 most important files."
   - "Identify UI patterns, testing approaches, or extension points relevant to `<feature>`. Return the 5–10 most important files."

   **After the agents return, read all files they identified yourself.** Agent summaries miss details — always read the actual code before designing.

   Skip for Bug fixes (you already know the failure point from the issue) and trivial Tasks.

5. **Clarifying questions gate** (Feature: required · Task: if scope unclear · Bug: skip)

   Before implementing, identify all underspecified aspects:
   - Edge cases and error handling
   - Integration points with existing code
   - Scope boundaries (what is in/out of scope)
   - Backward compatibility requirements
   - Performance, security, or accessibility constraints
   - Design preferences when multiple approaches exist

   **Present all questions to the user as a numbered list. Wait for answers before proceeding.**

   If the user says "you decide" or "whatever you think is best", state your recommendation and get explicit confirmation before continuing.

   Skip for Bug fixes — the failure mode answers most of the questions.

6. **Architecture design** (Feature: required · Task: skip · Bug: skip)

   Launch 2–3 architect agents in parallel via the `Agent` tool. Each agent designs an implementation approach with a different bias:

   - **Minimal changes:** smallest diff, maximum reuse of existing patterns
   - **Clean architecture:** maintainability, elegant abstractions, low future cost
   - **Pragmatic balance:** speed + quality, suitable for shipping this week

   Present all three to the user with:
   - One-paragraph summary of each
   - Trade-offs comparison (effort, risk, future flexibility)
   - **Your recommendation with reasoning**
   - Concrete differences in files/components touched

   **Wait for the user to pick an approach before implementing.**

7. **Implement the changes** (all types)
   - For Feature type, follow the architecture chosen in step 6
   - For Bug/Task, implement the fix directly
   - If Figma design context was extracted in step 2, use it to match the design (spacing, colors, typography, component structure)
   - Implement incrementally, get user approval before proceeding to the next major change

8. **Write and run unit tests** (hard gate — required for any change that alters behavior: Bug, Feature, and Task alike)

   Do not advance to the PR unless the change is covered by tests that pass, or it falls into the narrow no-test exception below. This step belongs in the TodoWrite list (step 0) so it cannot be skipped silently.

   1. **Find the project's test setup first — don't guess.** Detect the runner and conventions from the repo before writing anything:
      - Locate existing tests next to the code you changed (sibling `*_test.*`, `*_spec.*`, or a parallel `test/`, `tests/`, `spec/`, `__tests__/` tree).
      - Identify the runner from the manifest/config (`package.json` scripts, `Gemfile` + `spec/`, `pytest.ini`/`pyproject.toml`, `go test`, `*.csproj`, etc.). **For Swift/iOS:** `Package.swift` → `swift test`; `*.xcworkspace`/`*.xcodeproj` → `xcodebuild test -scheme <Scheme> -destination 'platform=iOS Simulator,name=iPhone 15'` (find schemes with `xcodebuild -list`). On macOS these run locally — do not treat an Xcode project as "untestable".
      - Match the nearest existing tests' style — naming, fixtures/factories, mocking approach, assertion library, file placement.

   2. **Write or update tests that cover the change.** Work from the same three sources as the QA checklist (step 11): the issue's objective, the nature of the change, and the blast radius. At minimum cover:
      - the success path for each new or changed behavior;
      - the negative/failure paths (invalid input, missing data, permission denied, not-found, boundaries) — not just the happy path;
      - the regression surface — if you changed a shared function/component/query used in N places, add or extend tests so those callers stay covered.

      For **Bug** fixes, write a regression test that **fails before the fix and passes after**, and state that you confirmed both.

   3. **Run the tests and make them pass.** Run the narrow suite for the touched area first, then the broader suite if it is fast enough. **Paste the runner's own pass marker** — `** TEST SUCCEEDED **` / `Test Suite '...' passed` (Xcode), `0 failures` (rspec), `N passed` (pytest), `ok` (go) — not a paraphrased "tests pass". The "can't run it locally" excuse is narrow: on macOS, `swift test` and `xcodebuild test` against the iOS Simulator DO run locally — a slow build or a missing `-scheme` is not a reason to skip, find the scheme and run it. Only the genuine absence of infrastructure on this machine (live external services, physical hardware) qualifies; say so explicitly and describe how you mitigated it. Never claim tests pass when you did not run them.

   4. **No-test exception — narrow and explicit.** A few change types have no unit-testable logic: pure copy/i18n, static assets, formatting-only changes, config/docs, or generated files. Only then may you skip tests, and you must tell the user **which** category applies and why. "It's hard to test" is not a valid reason — ask the user for guidance instead of skipping.

   If the project has no test harness at all, surface that to the user and propose adding a minimal one (or get explicit acknowledgement to proceed without) rather than silently shipping untested code.

9. **Create PR** (all types — only when user explicitly requests)

    **Precondition — tests gate (step 8):** Do not create the PR unless step 8 is satisfied: tests covering the change exist and pass, *or* a stated no-test exception applies. If neither holds, go back and write the tests first.

    **Commit (with the issue-tagged message):**

    ```bash
    git add .
    ```

    - GitHub: `git commit -m "<PREFIX> #<issue>: <brief description>"` (use the commit prefix from the issue type table above)
    - Jira: `git commit -m "<issue>: <brief description>"`
    - NO footers, NO co-authors, NO "Generated with Claude Code" signatures

    **Open the PR via the `create-pr` skill:**
    The `create-pr` skill takes care of running the test suite locally before pushing, pushing the branch, opening the PR, **watching CI in the background (via the Actions runs REST API, non-blocking)**, and switching the working tree back to the default branch when done. Do NOT run `git push` or `gh pr create` here — the skill does both. The task is not done until CI is green: if the background watch reports a failing GitHub Actions or Xcode Cloud check, fix it and push again before handing off. Read CI status with the Actions runs REST API (`gh api "repos/<owner>/<repo>/actions/runs?head_sha=<SHA>"` → `/actions/runs/<id>/jobs`), not `gh pr checks` — this workflow's fine-grained PAT has no Checks permission and cannot read check runs, so `gh pr checks` always 403s here. See the `create-pr` skill's Step 7.

    When invoking the skill, override its commit-message / PR-title defaults with the issue-tagged form:

    - GitHub: title = `<PREFIX> #<issue>: <summary>`
    - Jira: title = `<issue> <summary>`

    **GitHub — auto-close the issue on merge (REQUIRED):** the `#<issue>:` title prefix is only a *mention* and does NOT close the issue. Ensure the PR **body** (not the title) contains a GitHub closing keyword referencing the issue, so merging the PR closes it automatically. Add a dedicated line to the body using the verb that matches the issue type:

    - Bug → `Fixes #<issue>`
    - Feature → `Closes #<issue>`
    - Task → `Closes #<issue>`

    The closing keyword + issue number must appear as plain text in the body (e.g. on its own line under the summary, or as `Closes #<issue>.`). Do not bury it inside a code block or a link, or GitHub won't parse it.

    **Jira:** GitHub closing keywords do NOT close Jira issues — skip the keyword for Jira and rely on the transition step below.

    **After the skill finishes:**

    - Jira only: `mcp__atlassian__transitionJiraIssue` (preferred) or `jira issue move <issue> "Code Review"`

10. **Update issue if needed** (all types)
    If the implementation differs from the original or additional context would be helpful, update the issue.
    Write in a prospective tone (as if before implementation, not after):
    - GitHub: `mcp__github__update_issue` (preferred) or `gh issue edit <issue> --title "<updated title>" --body "<updated description>"`
    - Jira: `mcp__atlassian__editJiraIssue` (preferred) or `jira issue edit <issue> --summary "<updated title>" --description "<updated description>"`

11. **Post a tester QA checklist on the issue** (all types)

    Once the PR is open and the issue is updated, post a comment on the issue aimed at the **testers / QA team**. This is the hand-off gate right before the task moves through code review — it gives a tester an explicit, checkable list to confirm the work is *actually* done, not just merged.

    - GitHub: `mcp__github__add_issue_comment` (preferred) or `gh issue comment <issue> --body "..."`
    - Jira: `mcp__atlassian__addCommentToJiraIssue` (preferred) or `jira issue comment add <issue> "..."`
    - Jira note: post this comment as part of (or right after) the move to **Code Review** in step 9, so testers picking up the ticket find the checklist waiting.

    ### Where the checks come from

    Use **three sources**, in this order — do not stop at the first:

    1. **The issue's objective and acceptance criteria, NOT what you implemented.** It is easy to mirror the diff back ("I added a Save button, so: verify the Save button exists"), which only confirms the code does what the code does. Work backward from the stated goal and write checks that confirm *the original need is met* — including cases the issue implies that the implementation might have missed. If the goal and your implementation diverge, the checklist should expose that gap, not hide it.
    2. **The area and the nature of the code change — even when the issue has no acceptance criteria** (many won't). Reason from what you actually touched: which behaviors, screens, endpoints, jobs, or data does this code govern, and what would a tester exercise to trust it? This is where most of the checklist comes from when the issue is thin.
    3. **The blast radius / impact.** Trace every place the changed code is reached from. **If a shared function, component, query, config, or constant is used in 4 places and you changed it, all 4 places must be on the checklist** — not just the one the issue mentions. Call out the callers/screens/flows explicitly so the tester knows the full surface to regression-test. When unsure of the reach, grep for the symbol and list what you find.

    ### What to cover

    Go well beyond the happy path. Tailor depth to the change, but consider each axis and include the ones that apply:

    - **Success paths** — each acceptance criterion (or, absent one, each intended behavior) works end to end.
    - **Negative / failure paths** — invalid input, empty/missing data, permission denied, not-found, duplicate, concurrent edits, cancel/abort, validation errors. These matter as much as the happy path.
    - **Boundaries & edge cases** — empty, min/max, very large, unicode/special characters, zero, negative, timezones, pagination limits.
    - **Security** — authz/authn on the touched paths, ownership/tenant isolation, injection, sensitive data exposure, CSRF/escaping for UI changes. Flag anything a malicious user could try.
    - **Stress / load** — many rows, large payloads, rapid repeated actions, long-running jobs — wherever the change could degrade or time out.
    - **Network / resilience** — slow or dropped connections, timeouts, retries, offline behavior, partial responses. Especially for anything making requests.
    - **Regression surface** — every call site / screen from the blast-radius analysis above.

    ### Help build the test cases

    Don't just hand over a flat checklist — help the testers grow their suite:

    - Phrase items as runnable test cases: a short **Given / When / Then** (or precondition → action → expected result) so they can be added to the test plan as-is.
    - Point to the automated tests you wrote or updated in step 8, and note any additional ones the testers should **add or update** (and where they live, if you know).
    - Where a behavior is worth locking in, suggest the specific automated test to write.

    ### Format

    - A clear heading, e.g. `## ✅ For testers / QA`.
    - A one-line summary of what the user should be able to do now (in terms of the goal, not the code).
    - A short **Impact / areas to regression-test** line listing the call sites and flows the change reaches.
    - A markdown checkbox list (`- [ ]`), grouped by the axes above (Success, Negative, Security, Stress, Network, Regression…) — skip axes that genuinely don't apply, but justify nothing by omission.
    - A final checkbox: `- [ ] All checks above pass — task validated as done`.

    Write the comment in the **same language the issue itself is written in**. Detect that language *only* from the prose the reporter actually typed in the issue's title and description — the human sentences, not code identifiers or field labels. **Ignore every environmental signal**: the Jira/GitHub UI language, the browser or OS locale, the account's language setting, project defaults, and any prior assumption that "issues here are usually French." A French UI around an English issue body still means the comment must be English. If the title and body are in English, comment in English; if they're in French, comment in French. When the body is genuinely mixed or too short to tell, match the language of the title, then the longest prose block. Keep each item short and verifiable by a human who has not seen the diff.

12. **Cleanup** (all types)

    The cleanup depends on which path was taken in step 3.

    ### If `USE_WORKTREE=no` (plain branch)

    The `create-pr` skill already returns the working tree to the default branch when it finishes. Nothing else to do — the local branch `$BRANCH` is preserved for follow-up work. Delete it explicitly with `git branch -D "$BRANCH"` once the PR is merged.

    ### If `USE_WORKTREE=yes` (worktree)

    Two options — ask the user which they want, defaulting to **keep** so they can inspect or continue iterating:

    - **Keep the worktree** (default): just `cd "$REPO_ROOT"` to return to the main checkout. The worktree at `.worktrees/$BRANCH` stays put for follow-up work.
    - **Remove the worktree** (if the PR has merged or the work is abandoned):

      ```bash
      cd "$REPO_ROOT"
      git worktree remove ".worktrees/$BRANCH"
      # If the worktree has uncommitted changes, `git worktree remove` will refuse.
      # Confirm with the user before forcing: `git worktree remove --force ".worktrees/$BRANCH"`
      ```

    The local branch is preserved either way. Delete it explicitly with `git branch -D "$BRANCH"` once the PR is merged.

## Rules

- Run `gh`/`jira`/`git push` from the target repo's directory so direnv loads the right `GITHUB_TOKEN`/Jira token (see "Run from the target repo's directory" above) — step 3 `cd`s into `$REPO_ROOT`/the worktree; stay there
- No change ships without tests: step 8 is a hard gate — any behavior-altering change (Bug, Feature, or Task) must be covered by unit tests that pass before the PR is created. Bug fixes need a regression test that fails before the fix and passes after. The only exception is changes with no unit-testable logic (pure copy/i18n, assets, formatting, config/docs, generated files), and that exception must be stated explicitly to the user — never skipped silently or excused with "hard to test"
- Never create PR without user confirmation
- Commit messages: single line only, NO footers or signatures
- NEVER add "Generated with Claude Code" or similar signatures to commits or PRs
- Jira: Branch names must be UPPERCASE (matching Jira key format)
- Use the correct commit prefix based on detected issue type (Bug → Fix, Feature → Feat, Task → no prefix)
- GitHub: the PR **body** must include a closing keyword (`Closes`/`Fixes`/`Resolves #<n>`) so the issue auto-closes on merge — the `#<n>:` title prefix alone only links the issue, it does not close it
- The tester QA checklist (step 11) is sourced from three things, not just one: the issue's objective (never a recap of the diff), the area/nature of the change (when the issue has no acceptance criteria), and the full blast radius (if changed code is reached from N places, all N must be checked). Cover negative paths, security, stress, and bad-network cases — not only the happy path — and help testers turn items into Given/When/Then test cases. Write it in the language the issue body is written in (detect from the reporter's own prose in the title/description — never from the Jira/GitHub UI language, browser/OS locale, or account settings; a French UI on an English issue still requires an English comment)
