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

1. **Get issue details** - Present to user before proceeding
   - GitHub: `mcp__github__get_issue` (preferred) or `gh issue view $ARGUMENTS --comments`
   - Jira: `mcp__atlassian__getJiraIssue` (preferred) or `jira issue view $ARGUMENTS --comments 16`

2. **Extract Figma design context** (only if Figma links are present)

   Scan the issue title, description, and comments for Figma URLs (matching `figma.com/design/` or `figma.com/file/`). If found:

   1. Use `mcp__figma__get_design_context` with the Figma URL to extract layout, styling, and component information
   2. Use `mcp__figma__get_screenshot` to capture a visual reference of the design
   3. If the project uses a design system, use `mcp__figma__search_design_system` to find matching components

   Present the design context to the user alongside the issue details. Use this context to guide implementation — match spacing, colors, typography, and component structure from the design.

   **If no Figma links are found or Figma MCP is unavailable, skip this step.**

3. **Prepare repository**

   ```bash
   DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
   git fetch --all
   git checkout $DEFAULT_BRANCH
   git pull origin $DEFAULT_BRANCH
   git submodule update --init --recursive
   ```

   - GitHub: `git checkout -b issue-$ARGUMENTS`
   - Jira: `git checkout -b $ARGUMENTS` (uppercase)

4. **Implement the changes**
   - Analyze issue and affected code
   - If Figma design context was extracted in step 2, use it to match the design (spacing, colors, typography, component structure)
   - Ask clarifying questions if description is unclear, multiple approaches exist, or context is missing
   - Implement incrementally, get user approval before proceeding

5. **Create PR** (only when user explicitly requests)

   **Commit and push:**

   ```bash
   git add .
   ```

   - GitHub: `git commit -m "<PREFIX> #$ARGUMENTS: <brief description>"` then `git push -u origin issue-$ARGUMENTS` (use the commit prefix from the issue type table above)
   - Jira: `git commit -m "$ARGUMENTS: <brief description>"` then `git push -u origin $ARGUMENTS`
   - NO footers, NO co-authors, NO "Generated with Claude Code" signatures

   **Generate PR content:**
   Use the `create-pr` skill to generate PR title and body from the staged changes.

   **Create PR:**
   - GitHub: `mcp__github__create_pull_request` (preferred) or `gh pr create --base $DEFAULT_BRANCH --head issue-$ARGUMENTS --title "<PREFIX> #$ARGUMENTS: <summary>" --body "<PR body from skill>"`
   - Jira: `gh pr create --base $DEFAULT_BRANCH --head $ARGUMENTS --title "$ARGUMENTS <summary>" --body "<PR body from skill>"`

   **After PR created:**
   - Jira only: `mcp__atlassian__transitionJiraIssue` (preferred) or `jira issue move $ARGUMENTS "Code Review"`

6. **Update issue if needed**
   If the implementation differs from the original or additional context would be helpful, update the issue.
   Write in a prospective tone (as if before implementation, not after):
   - GitHub: `mcp__github__update_issue` (preferred) or `gh issue edit $ARGUMENTS --title "<updated title>" --body "<updated description>"`
   - Jira: `mcp__atlassian__editJiraIssue` (preferred) or `jira issue edit $ARGUMENTS --summary "<updated title>" --description "<updated description>"`

7. **Cleanup**

   ```bash
   git checkout $DEFAULT_BRANCH
   ```

## Rules

- Never create PR without user confirmation
- Commit messages: single line only, NO footers or signatures
- NEVER add "Generated with Claude Code" or similar signatures to commits or PRs
- Jira: Branch names must be UPPERCASE (matching Jira key format)
- Use the correct commit prefix based on detected issue type (Bug → Fix, Feature → Feat, Task → no prefix)
