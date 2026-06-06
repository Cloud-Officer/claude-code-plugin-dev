---
name: create-pr
description: Create, open, submit, or prepare a pull request (PR). Generates the commit message, PR title, and PR body, opens the PR, then returns the repo to its default branch. Use when the user wants to create a PR, open a PR, submit a PR, make a PR, push a PR, send a PR, generate PR content, prepare a pull request, or fill a PR template from code changes.
allowed-tools: Bash(git:*), Bash(gh:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(mkdir:*), Bash(open:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*), Bash(xcodebuild:*), Bash(swift:*), Bash(xcrun:*), Bash(npm:*), Bash(yarn:*), Bash(pnpm:*), Bash(bundle:*), Bash(pytest:*), Bash(go:*), Bash(dotnet:*), Read, Glob
---

# Create Pull Request

Generate the PR content, open the pull request, then leave the repo on its default branch.

## Run from the target repo's directory (direnv)

`gh` and `git push` authenticate with the `GITHUB_TOKEN` that [direnv](https://direnv.net/) loads from the `.envrc` of the **current working directory**. Opening a PR from a directory whose `.envrc` belongs to a **different** repo uses the wrong account's token, and the PR fails (or pushes to the wrong place).

**Before Step 1, make the repo whose changes you are PR-ing the working directory — in its own Bash call:**

```bash
cd /path/to/that-repo        # or, when already inside it: cd "$(git rev-parse --show-toplevel)"
```

Run the `cd` as a **separate** call — never chain it as `cd … && gh …`. direnv reloads `.envrc` on the next prompt, so the *following* calls pick up the correct token; a command on the same line as the `cd` still runs with the old environment.

## Step 1: Gather Information

**YOU MUST EXECUTE THESE COMMANDS IN ORDER. DO NOT SKIP ANY STEP.**

**Step 1.1:** Capture branch info (used in later steps):

```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "master")
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Default: $DEFAULT_BRANCH | Current: $CURRENT_BRANCH"
```

**Step 1.2:** Get file change summary (THIS IS CRITICAL - you must see ALL files):

```bash
echo "=== COMMITTED AHEAD OF BASE ===" && git diff ${DEFAULT_BRANCH}...HEAD --stat -- ':!docs/soup.md' ':!.soup.json' && echo "=== STAGED ===" && git diff --cached --stat -- ':!docs/soup.md' ':!.soup.json' && echo "=== UNSTAGED ===" && git diff --stat -- ':!docs/soup.md' ':!.soup.json'
```

**Step 1.3:** Get the full diff (committed + staged + unstaged changes):

```bash
echo "=== COMMITTED AHEAD OF BASE ===" && git diff ${DEFAULT_BRANCH}...HEAD -- ':!docs/soup.md' ':!.soup.json' && echo "=== STAGED ===" && git diff --cached -- ':!docs/soup.md' ':!.soup.json' && echo "=== UNSTAGED ===" && git diff -- ':!docs/soup.md' ':!.soup.json'
```

**NOTE:** Include ALL three sections (committed, staged, unstaged) in your analysis. Changes may appear in any combination depending on the workflow.

**Step 1.4:** Find the PR template:

```bash
cat .github/pull_request_template.md 2>/dev/null || cat .github/PULL_REQUEST_TEMPLATE.md 2>/dev/null || echo "No PR template found"
```

**Step 1.5:** Check for JIRA ticket:

```bash
echo $JIRA_TICKET
```

**CRITICAL:** The PR summary MUST mention ALL files shown in the Step 1.2 `--stat` output. Count the files and verify your summary accounts for all of them.

## Step 2: Generate PR Content

Generate the commit message, PR title, and PR body following the guidelines below, and show them to the user in this exact format so the inputs to the upcoming `gh pr create` are visible and reviewable:

```text
COMMIT MESSAGE:
<one line, max 80 characters>
---
PR TITLE:
<one line, max 80 characters>
---
PR BODY:
<filled PR template - can contain any valid markdown>
```

Formatting rules for this block:

- Section labels must be plain text exactly as shown: "COMMIT MESSAGE:", "PR TITLE:", "PR BODY:"
- Do NOT use markdown formatting on the labels (no **bold**, no `code blocks` around them)
- Separate sections with exactly "---" on its own line
- The PR BODY content can contain any valid markdown (code blocks, lists, etc.)

After printing this block, continue immediately with Step 3 — do not stop here.

## Step 3: Commit Any Uncommitted Changes

If there are unstaged or staged-but-uncommitted changes, commit them now using the commit message from Step 2. If the working tree is already clean, skip this step.

```bash
git add -A
git diff --cached --quiet || git commit -m "<commit message from Step 2>"
```

## Step 4: Run Tests Locally (gate before pushing)

Run the project's existing test suite before pushing. A red CI run that a local test would have caught is exactly what this step exists to prevent. **If a test harness exists and you have not run it, do not push.**

**Step 4.1 — Detect the runner from the repo, including compiled/mobile stacks:**

- JS/TS: `package.json` scripts → `npm test` / `yarn test` / `pnpm test`
- Ruby: `Gemfile` + `spec/` → `bundle exec rspec`; `test/` → `bin/rails test`
- Python: `pytest.ini` / `pyproject.toml` / `tox.ini` → `pytest`
- Go: `go test ./...`
- .NET: `*.csproj` / `*.sln` → `dotnet test`
- **Swift / iOS (you are on macOS — these ARE runnable locally):**
  - `Package.swift` (SwiftPM) → `swift test`
  - `*.xcworkspace` / `*.xcodeproj` → `xcodebuild test -scheme <Scheme> -destination 'platform=iOS Simulator,name=iPhone 15'`
    - List schemes with `xcodebuild -list -workspace <name>.xcworkspace` (or `-project <name>.xcodeproj`) and pick the app/test scheme.
    - Use `-workspace` when a `.xcworkspace` exists (CocoaPods/SPM workspaces), otherwise `-project`.

**Step 4.2 — Run the suite covering your changes and paste the runner's own pass marker as proof:**

`** TEST SUCCEEDED **` / `Test Suite '...' passed` (Xcode), `0 failures` (rspec), `passed`/`N passed` (pytest), `ok` (go). A bare "tests pass" without the runner's output does not count. If anything fails, fix it **before** pushing — never push red.

**Step 4.3 — The "can't run it locally" exception is narrow.** On macOS, `swift test` and `xcodebuild test` against the iOS Simulator run locally; "slow to build" or "needs a scheme" is not an excuse to skip — find the scheme and run it. Only skip when the suite needs infrastructure genuinely absent on this machine (live external services, physical hardware), and say so explicitly. If the repo has no test harness at all, state that and continue.

## Step 5: Push the Branch

```bash
git push -u origin "$CURRENT_BRANCH"
```

## Step 6: Open the Pull Request

Prefer `mcp__github__create_pull_request` when the GitHub MCP server is available. Otherwise use the GitHub CLI:

```bash
PR_URL=$(gh pr create --base "$DEFAULT_BRANCH" --head "$CURRENT_BRANCH" --title "<PR title from Step 2>" --body "<PR body from Step 2>")
open "$PR_URL"
```

If a PR already exists for `$CURRENT_BRANCH` (e.g., the caller already opened it), `gh pr create` will fail — treat that as success and continue to Step 7.

## Step 7: Monitor CI in the Background

A pushed PR is not done until its checks are green — but CI (especially Xcode Cloud) can take several minutes, so **watch it without blocking the session**. Launch the watch as a background task, then continue straight to Step 8. The background watch re-invokes you when CI settles, so a failure is still caught and triaged in this session — just not by sitting idle.

Run this with the Bash tool's **`run_in_background: true`** (do not foreground it):

```bash
gh pr checks "$CURRENT_BRANCH" --watch --fail-fast
```

`gh pr checks` reports **every** check registered on the PR — GitHub Actions **and Xcode Cloud**, which posts its build/test result back to GitHub as a check run. So this one command covers both CIs. (`--fail-fast` returns as soon as one check fails; drop it to wait for the full set.) The command exits non-zero if any check fails, zero if all pass.

> **Reading the checks always works here — run `gh pr checks` and report what it returns.** The token that just pushed the branch and opened the PR has everything needed to read that PR's checks, so trust the command and let its output drive your next step. If it ever errors, surface the **verbatim** output and exit code so the real cause is visible. A 404/403 means the wrong working directory loaded the wrong per-repo token — `cd` into the PR's repo and retry.

Do **not** wait on it before Step 8 — proceed immediately. When the background task completes:

- **All checks green (exit 0):** report it; nothing more to do.
- **A check fails (non-zero):** Step 8 has likely already returned you to the default branch, so re-checkout the PR branch first (`git checkout "$CURRENT_BRANCH"`), then pull the failing logs, fix the cause, and push again (re-run Steps 4–7). Do not leave the PR with a red required check.
  - GitHub Actions: `gh run view --log-failed` (the failing run URL is also printed by `gh pr checks`).
  - **Xcode Cloud:** the check tells you only pass/fail. For the failing test names and logs, use the `appstore` skill — `asc-mcp` does not expose the `ci*` endpoints, so the failing `.xcresult` must be fetched via the App Store Connect API and read with `xcrun xcresulttool`.

If the repo has no CI configured, `gh pr checks` exits immediately with no checks — note that and continue.

## Step 8: Return to Default Branch

Leave the repo on the default branch so the user is back at a clean starting point:

```bash
git checkout "$DEFAULT_BRANCH"
git pull --ff-only
```

**Skip this step when running inside a `git worktree`.** A branch can only be checked out by one worktree at a time, so `git checkout` will fail (or pull the branch out from under the main checkout). Detect with:

```bash
git rev-parse --is-inside-work-tree >/dev/null && [ "$(git rev-parse --git-common-dir)" != "$(git rev-parse --git-dir)" ] && echo "in worktree"
```

In a worktree, leave the branch in place and let the caller `cd` back to the main checkout.

## Commit Message Guidelines

- One line only, maximum 80 characters
- Start with a verb (Add, Fix, Update, Remove, Refactor, etc.)
- Be specific but concise
- No period at the end
- NO footers, NO co-authors, NO signatures

## PR Title Guidelines

- One line only, maximum 80 characters
- Should summarize the overall purpose of the PR
- Can be similar to commit message but may be slightly more descriptive

## PR Body Guidelines

### Summary

**IMPORTANT: The Summary section heading must be `## Summary` (h2), not `# Summary` (h1).**

Structure the summary as follows:

1. Start with a short paragraph describing the big picture of the changes
2. Follow with **Key changes:** (bold)
3. Add a bullet list of all changes made, one per line. Similar changes can be summarized together.

### Types of changes

**CRITICAL: Preserve ALL checkbox items from the template exactly as they appear.** Mark applicable items with `[x]` and leave non-applicable items as `[ ]`. Never delete, modify, or omit any checkbox items from the original template.

### Checklist

**CRITICAL: Preserve ALL checkbox items from the template exactly as they appear.** Mark applicable items with `[x]` and leave non-applicable items as `[ ]`. Never delete, modify, or omit any checkbox items from the original template.

### Jira Tickets

If the PR template does NOT contain a Jira Tickets section:

- Do not add one

If the PR template contains a Jira Tickets section:

- If `JIRA_TICKET` env var is set: replace any placeholder (e.g., `XXX-XXXX`) with the value from the environment variable
- If `JIRA_TICKET` env var is NOT set or empty: omit the entire Jira Tickets section from the output

### Further comments (if required)

This section should ONLY be filled if one of the following applies:

- Breaking changes are introduced
- Complex database migration is required
- Reprocessing of existing data is required

If NONE of the above apply, omit this entire section from the output.

If the section is required, write a paragraph explaining the breaking changes, complex database migration, or reprocessing of existing data with any useful information for the reviewer to understand why it is needed and what actions to take.

**Note:** When this section is filled due to database migration or reprocessing of existing data, the corresponding checklist item about database changes requiring migration/downtime/reprocessing should also be marked with `[x]`.

## Important Rules

- Run from the repo whose changes you are PR-ing (see "Run from the target repo's directory" above) — `gh`/`git push` use the `GITHUB_TOKEN` direnv loads for the current directory, so the wrong directory means the wrong token
- NEVER add "Generated with Claude Code" or similar signatures to commit messages or PR body
- NO emojis unless explicitly requested
- Before generating PR content, ensure the `run-linters` skill has been executed to verify code quality
- Run the existing test suite locally before pushing (Step 4) — for Swift/iOS that means `swift test` or `xcodebuild test`, which run on this Mac; never push a behavior change without running its tests, and never claim tests pass without the runner's own pass marker
- After pushing, watch CI **in the background** (Step 7) — run `gh pr checks --watch` with `run_in_background: true` so the session is not blocked, then triage when it reports; one command covers GitHub Actions and Xcode Cloud alike, and the PR is not done while a required check is red. The token that opened the PR can read its checks, so run the command and act on its output.
- The skill is not done until Step 8 has run (or has been deliberately skipped because of a worktree). Do not stop after printing the Step 2 block.
