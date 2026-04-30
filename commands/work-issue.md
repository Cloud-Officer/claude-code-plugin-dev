---
description: Implement a GitHub issue or Jira ticket end-to-end (explore, design, implement, PR)
argument-hint: <issue-number-or-jira-key>
allowed-tools: Bash(git:*), Bash(gh:*), Bash(jira:*), Bash(awk:*), Bash(cat:*), Bash(echo:*), Bash(grep:*), Bash(jq:*), Bash(sed:*), Bash(tr:*), Read, Edit, Write, Glob, Grep, TodoWrite, Agent, mcp__github__*, mcp__atlassian__*, mcp__figma__*
---

Work on issue: $ARGUMENTS

## MCP Tools with Fallbacks

This command uses MCP tools when available and falls back gracefully if they are unavailable or return errors.

### GitHub Access

**Prefer MCP tools** (`mcp__github__*`) when available. If MCP tools are not available (tool not found errors), **fall back to the `gh` CLI**.

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Check issues enabled | `mcp__github__list_issues` (if it succeeds, issues are enabled) | `gh repo view --json hasIssuesEnabled --jq '.hasIssuesEnabled'` |
| Get issue details | `mcp__github__get_issue` | `gh issue view $ARGUMENTS --comments` |
| Create PR | `mcp__github__create_pull_request` | `gh pr create --base ... --head ... --title "..." --body "..."` |
| Update issue | `mcp__github__update_issue` | `gh issue edit $ARGUMENTS --title "..." --body "..."` |
| Get repo owner/name | Parse from `git remote get-url origin` | `gh repo view --json owner,name` |

**Note:** MCP tools require `owner` and `repo` parameters. Extract these from `git remote get-url origin` (parse the owner/repo from the URL).

### Jira Access

**Prefer MCP tools** (`mcp__atlassian__*`) when available. If MCP tools are not available (tool not found errors), **fall back to the `jira` CLI**.

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Get issue details | `mcp__atlassian__getJiraIssue` | `jira issue view $ARGUMENTS --comments 16` |
| Transition issue | `mcp__atlassian__transitionJiraIssue` | `jira issue move $ARGUMENTS "Code Review"` |
| Update issue | `mcp__atlassian__editJiraIssue` | `jira issue edit $ARGUMENTS --summary "..." --description "..."` |
| Add comment | `mcp__atlassian__addCommentToJiraIssue` | N/A (not used in CLI flow) |
| Get transitions | `mcp__atlassian__getTransitionsForJiraIssue` | N/A (not needed with CLI) |

### Figma Design Context

When the issue description or comments contain Figma URLs (`figma.com/design/...` or `figma.com/file/...`), use Figma MCP tools to pull design context before implementing. If Figma MCP is unavailable, skip this step — do not block implementation.

| Operation | MCP Tool |
| --- | --- |
| Get design context | `mcp__figma__get_design_context` |
| Get screenshot | `mcp__figma__get_screenshot` |
| Search design system | `mcp__figma__search_design_system` |

## Detect Issue Tracker

```bash
# Fallback if MCP tools unavailable
gh repo view --json hasIssuesEnabled --jq '.hasIssuesEnabled'
```

- **GitHub** (if `true`): Use `mcp__github__*` tools (preferred) or `gh issue` commands, branch name `issue-$ARGUMENTS`
- **Jira** (if `false`): Use `jira` commands, branch name `$ARGUMENTS` (uppercase)

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
| Bug | `Fix #$ARGUMENTS: <description>` | `Fix #$ARGUMENTS: <summary>` |
| Feature | `Feat #$ARGUMENTS: <description>` | `Feat #$ARGUMENTS: <summary>` |
| Task | `#$ARGUMENTS: <description>` | `#$ARGUMENTS: <summary>` |

For Jira issues, always use `$ARGUMENTS: <description>` (the Jira key is the prefix).

## Workflow

Steps 4–6 and 8 are gated by Issue Type (detected above). The gating column on each step shows when to run it.

0. **Initialize todo list** (all types)

   Use `TodoWrite` to create a todo list of the workflow steps for this issue. Mark each item completed as you finish it. This survives context compaction and gives the user a stable progress view across long sessions.

1. **Get issue details** (all types) — Present to user before proceeding
   - GitHub: `mcp__github__get_issue` (preferred) or `gh issue view $ARGUMENTS --comments`
   - Jira: `mcp__atlassian__getJiraIssue` (preferred) or `jira issue view $ARGUMENTS --comments 16`

2. **Extract Figma design context** (all types — only if Figma links are present)

   Scan the issue title, description, and comments for Figma URLs (matching `figma.com/design/` or `figma.com/file/`). If found:

   1. Use `mcp__figma__get_design_context` with the Figma URL to extract layout, styling, and component information
   2. Use `mcp__figma__get_screenshot` to capture a visual reference of the design
   3. If the project uses a design system, use `mcp__figma__search_design_system` to find matching components

   Present the design context to the user alongside the issue details. Use this context to guide implementation — match spacing, colors, typography, and component structure from the design.

   **If no Figma links are found or Figma MCP is unavailable, skip this step.**

3. **Prepare an isolated worktree** (all types)

   This step uses `git worktree` instead of `git checkout -b`. Worktrees give each issue its own working directory, so any uncommitted work in the user's main checkout is left untouched and multiple issues can be in flight in parallel.

   ```bash
   DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
   REPO_ROOT=$(git rev-parse --show-toplevel)
   cd "$REPO_ROOT"
   git fetch --all
   ```

   Decide the branch name from the issue tracker:

   - GitHub: `BRANCH=issue-$ARGUMENTS`
   - Jira: `BRANCH=$ARGUMENTS` (uppercase — matches the Jira key)

   Ensure `.worktrees/` is gitignored in the target repo. If it isn't, add and commit the change before creating the worktree (otherwise the worktree contents would pollute `git status`):

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

8. **Pre-PR review** (opt-in for all types)

   Ask the user: **"Run a pre-PR review before creating the PR? (y/n)"**

   If yes, launch 3 parallel agents over the staged + committed diff:
   - **Simplicity/DRY:** duplication, dead abstractions, over-engineering, premature generalization
   - **Bugs:** off-by-one, missing error handling, broken contracts, type confusion, edge cases
   - **Conventions:** mismatch with codebase patterns, naming, file organization, test placement

   Consolidate findings into a list ordered by severity. Present the highest-severity issues to the user and ask which to fix before the PR.

   For a deeper, whole-codebase audit, point the user at `/code-review-deep` instead — it covers security, dependencies, infrastructure, and more.

9. **Create PR** (all types — only when user explicitly requests)

   **Commit (with the issue-tagged message):**

   ```bash
   git add .
   ```

   - GitHub: `git commit -m "<PREFIX> #$ARGUMENTS: <brief description>"` (use the commit prefix from the issue type table above)
   - Jira: `git commit -m "$ARGUMENTS: <brief description>"`
   - NO footers, NO co-authors, NO "Generated with Claude Code" signatures

   **Open the PR via the `create-pr` skill:**
   The `create-pr` skill takes care of pushing the branch, opening the PR, and switching the working tree back to the default branch when done. Do NOT run `git push` or `gh pr create` here — the skill does both.

   When invoking the skill, override its commit-message / PR-title defaults with the issue-tagged form:
   - GitHub: title = `<PREFIX> #$ARGUMENTS: <summary>`
   - Jira: title = `$ARGUMENTS <summary>`

   **After the skill finishes:**
   - Jira only: `mcp__atlassian__transitionJiraIssue` (preferred) or `jira issue move $ARGUMENTS "Code Review"`

10. **Update issue if needed** (all types)
    If the implementation differs from the original or additional context would be helpful, update the issue.
    Write in a prospective tone (as if before implementation, not after):
    - GitHub: `mcp__github__update_issue` (preferred) or `gh issue edit $ARGUMENTS --title "<updated title>" --body "<updated description>"`
    - Jira: `mcp__atlassian__editJiraIssue` (preferred) or `jira issue edit $ARGUMENTS --summary "<updated title>" --description "<updated description>"`

11. **Cleanup** (all types)

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

- Never create PR without user confirmation
- Commit messages: single line only, NO footers or signatures
- NEVER add "Generated with Claude Code" or similar signatures to commits or PRs
- Jira: Branch names must be UPPERCASE (matching Jira key format)
- Use the correct commit prefix based on detected issue type (Bug → Fix, Feature → Feat, Task → no prefix)
