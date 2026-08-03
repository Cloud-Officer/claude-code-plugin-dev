---
name: create-issue
description: Create, open, file, or report an issue, bug, or ticket in GitHub or Jira. Use when the user wants to open an issue, file a bug, report a bug, create a ticket, log an issue, or submit a bug report. Automatically detects if GitHub issues are enabled; if so creates a GitHub issue, otherwise creates a Jira issue.
allowed-tools: Bash(gh:*), Bash(jira:*), Bash(git:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(mkdir:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*), Read, Write, mcp__github__create_issue, mcp__github__list_issues, mcp__github__search_issues, mcp__github__get_issue, mcp__github__add_issue_comment, mcp__atlassian__createJiraIssue, mcp__atlassian__getJiraIssueTypeMetaWithFields, mcp__atlassian__getJiraProjectIssueTypesMetadata, mcp__atlassian__getVisibleJiraProjects
---

# Create Issue

Create an issue in the appropriate tracker (GitHub Issues or Jira).

## Run from the target repo's directory (direnv)

The CLI fallbacks below authenticate with credentials that [direnv](https://direnv.net/) loads from the `.envrc` of the **current working directory**: `GITHUB_TOKEN` for `gh`/`git`, and the Jira credentials for the `jira` CLI. Run one of these from a directory whose `.envrc` belongs to a **different** repo and it authenticates as the wrong account — the command fails, or files the issue in the wrong place.

**Before any command that needs per-repo credentials (`gh`, `jira`), make the target repo the working directory in its own step:**

```bash
cd /path/to/target-repo        # or, when already inside it: cd "$(git rev-parse --show-toplevel)"
```

Run the `cd` as a **separate** Bash call — never chain it as `cd … && gh …`. direnv reloads `.envrc` on the next prompt, so the *following* calls get the right token; a command on the same line as the `cd` still runs with the old environment. MCP tools (`mcp__github__*`, `mcp__atlassian__*`) captured their credentials when Claude started and are unaffected.

## MCP Tools with Fallbacks

This skill uses MCP tools when available and falls back gracefully if they are unavailable or return errors.

### GitHub Access

**Prefer MCP tools** (`mcp__github__*`) when available. If MCP tools are not available (tool not found errors), **fall back to the `gh` CLI**.

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Check issues enabled | `mcp__github__list_issues` (if it succeeds, issues are enabled) | `gh repo view --json hasIssuesEnabled --jq '.hasIssuesEnabled'` |
| Create issue | `mcp__github__create_issue` | `gh issue create --title "..." --body-file issue-body.md --label "..."` |
| Get repo owner/name | Parse from `git remote get-url origin` | `gh repo view --json owner,name` |

### Jira Access

**Prefer MCP tools** (`mcp__atlassian__*`) when available. If MCP tools are not available (tool not found errors), **fall back to the `jira` CLI**.

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Create issue | `mcp__atlassian__createJiraIssue` | `jira issue create --no-input --type "..." --priority "..." --summary "..."` |
| Get issue type metadata | `mcp__atlassian__getJiraIssueTypeMetaWithFields` | N/A (not needed with CLI) |
| Get project issue types | `mcp__atlassian__getJiraProjectIssueTypesMetadata` | N/A (not needed with CLI) |
| List projects | `mcp__atlassian__getVisibleJiraProjects` | N/A (not needed with CLI) |

## Step 1: Detect Issue Tracker

1. **Get repository name**: `basename $(git rev-parse --show-toplevel)`
2. **Check if GitHub issues are enabled**:

   ```bash
   gh repo view --json hasIssuesEnabled --jq '.hasIssuesEnabled'
   ```

   - If `true` → Create GitHub issue
   - If `false` → Create Jira issue

3. **Determine issue type**: Task, Bug, or Story
4. **Check for assignee** in user's request
5. **Determine priority/labels** based on severity

---

## GitHub Issues

If GitHub issues are enabled, create a GitHub issue. **Prefer `mcp__github__create_issue`** when available, fall back to `gh issue create` CLI.

### Step 2a: Write issue body to `issue-body.md`

Use the appropriate template based on issue type (see Templates section below).

**Note:** This file is deleted in Step 2c.

### Step 2b: Create the issue

With the MCP tool, pass the same values the CLI flags carry: the title, the body (the contents of `issue-body.md`), the labels, and the assignee if the user specified one.

With the CLI:

```bash
gh issue create --title "<SUMMARY>" --body-file issue-body.md --label "<LABEL>"
```

Add `--assignee "<username>"` if user specified an assignee.

**Note:** No repo name prefix needed - GitHub issues are already scoped to the repository.

### Step 2c: Delete the temp file

Whichever path you took, remove the temp file once the issue exists:

```bash
rm issue-body.md
```

---

## Jira Issues

If GitHub issues are disabled, create a Jira issue. **Prefer `mcp__atlassian__createJiraIssue`** when available, fall back to `jira issue create` CLI.

### Step 2a: Write issue body to `issue-body.md`

Use the appropriate template based on issue type (see Templates section below).

**Note:** This file will be deleted after the command runs.

### Step 2b: Run jira command

```bash
jira issue create --no-input \
  --type "<TYPE>" \
  --priority "<PRIORITY>" \
  --label "<LABEL>" \
  --summary "[<REPO-NAME>] <SUMMARY>" \
  --template issue-body.md && rm issue-body.md
```

Add `--assignee "<username>"` if user specified an assignee.

---

## Templates

Choose the appropriate template based on issue type:

### Template: Task

```markdown
## What

Provide a clear and concise description of the task.

## In Scope

- Define what is included in this task

## Out of Scope

- Clarify what is not covered

## Security and Compliance

- If no security/compliance impact, write: "No direct security or compliance impact."
- If there IS impact, be specific about which control/requirement is violated and the actual risk

## Testing Details

- Outline the testing strategy

## Technical Details

Include any remaining details such as code snippets, file locations, or tool suggestions.
```

---

### Template: Bug

```markdown
## Description

A concise description of the bug.

## Environment

- **Environment:** (e.g., Test, Production)
- **App Version:**
- **Browser/OS:**
- **Affected Component:**

## Actual Behaviour

Detailed description of what actually happened. Include any error messages, logs, or screenshots.

## Expected Behaviour

Detailed explanation of what should have happened.

## Steps to Reproduce

1. Step one
2. Step two
3. Step three

**Reproducibility:** (Always, Sometimes, Rarely)

## Impact & Severity

- **Impact:** Describe the impact on users or business operations
- **Severity:** (Critical, Major, Minor)

## Troubleshooting & Workaround

- Steps already taken to diagnose or fix the issue
- Temporary workaround available (if any)

## Additional Information

- Screenshots, videos, or additional logs
- Related bugs or tickets
- Potential fixes or areas to investigate (optional)
```

---

### Template: Story

```markdown
## Who

- **User Group:** Who will use or benefit from this feature (end-users, admins, editors, etc.)
- **Stakeholders:** Relevant internal teams or customer segments

## What

- **Intent:** Describe the goal of the story; focus on what needs to be achieved, not on technical implementation
- **Scope:** Outline the high-level functionality without UI specifics or library details

## Why

- **Business Value:** Explain how this feature improves UX, increases retention, or shortens the journey to issue resolution
- **Metrics/KPIs:** Connect the story to relevant performance indicators
- **Non-Functional Requirements:** Include performance, security, compliance, and any other quality requirements

## High-Level Description & Design

- **Overview:** Provide a brief narrative of the feature
- **Figma/Design Link:** [Insert link] with all relevant design notes
- **Design Requirements:** UI/UX must cater to all screen sizes, including very small devices. Include designs for buttons with text on two rows to support multiple languages

## Backend API & Contract Changes

- **API Changes:** Describe any required changes or new endpoints
- **Integration:** Specify the method for frontend integration
- **Performance & Security:** Highlight any potential performance issues or security considerations

## Frontend Considerations

- **Platform-Specific Notes:** List any particular requirements for different platforms
- **Error & Success Paths:** Clearly define both success and error flows

## Infrastructure & Compliance

- **Impact Assessment:** Evaluate any effects on infrastructure or security compliance standards
- **Performance & Cost:** Highlight any potential performance or cost implications

## Dashboard & Asset Management

- **Dashboard Impact:** Assess any configuration changes or new dashboard requirements
- **Asset Requirements:** Ensure all assets (images, text, translations) are available

## Dependencies & Risks

- **Dependencies:** List any related stories, external dependencies, or systems
- **Blockers:** Identify potential blockers that might impact progress
- **Risks:** Outline possible risks affecting feature delivery
- **Mitigation Strategies:** Describe actions to minimize or manage these risks

## Technical Documentation

- **Documentation Links:** Include links to relevant technical documentation or architecture diagrams
- **Additional Context:** Provide any extra technical notes that could aid implementation

## Environment & Release Notes

- **Environment Considerations:** Note any environment-specific details
- **Release Planning:** Detail feature flags, rollback plans, or special deployment instructions

## Testing Strategy

- **Testing Requirements:** Define testing requirements beyond acceptance criteria
- **Test Scenarios:** Outline key test cases and scenarios

## Acceptance Criteria

- Draft detailed acceptance criteria covering all success scenarios and all error paths
- Variations due to dynamic factors
- Ensure the criteria are measurable and leave no room for ambiguity

## Post-Release Monitoring

- **Monitoring Metrics:** Specify metrics or logs to monitor after release
- **Feedback Mechanism:** Outline how to gather user feedback and performance data post-deployment
```

---

## Priority Mapping (Jira only)

| Severity | Jira Priority |
| -------- | ------------- |
| Critical | Blocker |
| High | Critical |
| Medium | Major |
| Low | Minor |
| Info | Minor |

## Important Rules

- **GitHub Issues:**
  - Prefer `mcp__github__create_issue`; with the CLI fallback, use `gh issue create` with `--body-file`
  - No repo name prefix needed (issues are scoped to repo)
  - Labels are simple strings (e.g., `bug`, `enhancement`, `documentation`)
- **Jira Issues:**
  - Always prefix summary with repo name: `[repo-name] Brief description`
  - Always use `--no-input` flag to prevent interactive prompts
  - Do NOT specify a project (`-p` or `--project`) - use default from user's config
  - Set 15 second timeout - if it hangs, the command is malformed
- **Both:**
  - Use Markdown format
  - Use `##` for main headings, `-` for bullet points
  - Use backticks for inline code
  - For sections not applicable, write "N/A" or "Nothing to mention"
  - Delete the temp file (`issue-body.md`) after creating the issue
