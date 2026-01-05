Fix issue: $ARGUMENTS

## Detect Issue Tracker

```bash
gh repo view --json hasIssuesEnabled --jq '.hasIssuesEnabled'
```

- **GitHub** (if `true`): Use `gh issue` commands, branch name `issue-$ARGUMENTS`, commit format `Fix #$ARGUMENTS: description`
- **Jira** (if `false`): Use `jira` commands, branch name `$ARGUMENTS` (uppercase), commit format `$ARGUMENTS: description`

## Workflow

1. **Get issue details** - Present to user before proceeding
   - GitHub: `gh issue view $ARGUMENTS --comments`
   - Jira: `jira issue view $ARGUMENTS --comments 16`

2. **Prepare repository**

   ```bash
   DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
   git fetch --all
   git checkout $DEFAULT_BRANCH
   git pull origin $DEFAULT_BRANCH
   git submodule update --init --recursive
   ```

   - GitHub: `git checkout -b issue-$ARGUMENTS`
   - Jira: `git checkout -b $ARGUMENTS` (uppercase)

3. **Fix the issue**
   - Analyze issue and affected code
   - Ask clarifying questions if description is unclear, multiple approaches exist, or context is missing
   - Implement incrementally, get user approval before proceeding

4. **Create PR** (only when user explicitly requests)

   **Commit and push:**

   ```bash
   git add .
   ```

   - GitHub: `git commit -m "Fix #$ARGUMENTS: <brief description>"` then `git push -u origin issue-$ARGUMENTS`
   - Jira: `git commit -m "$ARGUMENTS: <brief description>"` then `git push -u origin $ARGUMENTS`
   - NO footers, NO co-authors, NO "Generated with Claude Code" signatures

   **Generate PR content:**
   Use the `create-pr` skill to generate PR title and body from the staged changes.

   **Create PR:**
   - GitHub: `gh pr create --base $DEFAULT_BRANCH --head issue-$ARGUMENTS --title "Fix #$ARGUMENTS: <summary>" --body "<PR body from skill>"`
   - Jira: `gh pr create --base $DEFAULT_BRANCH --head $ARGUMENTS --title "$ARGUMENTS <summary>" --body "<PR body from skill>"`

   **After PR created:**
   - Jira only: `jira issue move $ARGUMENTS "Code Review"`

5. **Update issue if needed**
   If the implementation differs from the original or additional context would be helpful, update the issue.
   Write in a prospective tone (as if before implementation, not after):
   - GitHub: `gh issue edit $ARGUMENTS --title "<updated title>" --body "<updated description>"`
   - Jira: `jira issue edit $ARGUMENTS --summary "<updated title>" --description "<updated description>"`

6. **Cleanup**

   ```bash
   git checkout $DEFAULT_BRANCH
   ```

## Rules

- Never create PR without user confirmation
- Commit messages: single line only, NO footers or signatures
- NEVER add "Generated with Claude Code" or similar signatures to commits or PRs
- Jira: Branch names must be UPPERCASE (matching Jira key format)
