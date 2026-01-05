---
name: create-pr
description: Generate commit message, PR title, and PR body for a pull request. Use when the user wants to create a PR, generate PR content, prepare a pull request, or fill a PR template from code changes.
allowed-tools: Bash(git diff:*), Bash(git rev-parse:*), Bash(git status:*), Bash(git symbolic-ref:*), Bash(echo:*), Bash(tee:*), Bash(date:*), Read, Glob
---

# Create Pull Request Content

Generate all content needed for a pull request: commit message, PR title, and PR body.

## Step 1: Gather Information

**DEBUG MODE:** Log all commands and outputs to `pr-debug.log` for troubleshooting:

```bash
echo "=== PR SKILL DEBUG LOG ===" > pr-debug.log
echo "Timestamp: $(date)" >> pr-debug.log
```

1. **Get the current branch name:**

   ```bash
   echo -e "\n=== CURRENT BRANCH ===" >> pr-debug.log
   git rev-parse --abbrev-ref HEAD | tee -a pr-debug.log
   ```

2. **Get the full picture of changes:**

   First, detect the default branch:

   ```bash
   echo -e "\n=== DEFAULT BRANCH ===" >> pr-debug.log
   git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@' | tee -a pr-debug.log
   ```

   Run `git diff --stat` to get a summary list of ALL changed files:

   ```bash
   echo -e "\n=== DIFF STAT (ALL FILES) ===" >> pr-debug.log
   git diff $(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@') --stat -- . ':!docs/soup.md' ':!.soup.json' | tee -a pr-debug.log
   ```

   Run `git diff` to get the full diff content:

   ```bash
   echo -e "\n=== FULL DIFF ===" >> pr-debug.log
   git diff $(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@') -- . ':!docs/soup.md' ':!.soup.json' | tee -a pr-debug.log
   ```

   **CRITICAL:** The PR summary MUST mention ALL files shown in the `--stat` output. Do not skip or omit any files. If the diff is large, group related files together (e.g., "Added 5 workflow files in .github/workflows/") but ensure every file is accounted for.

3. **Find the PR template** by checking these locations in order:
   - `.github/pull_request_template.md`
   - `.github/PULL_REQUEST_TEMPLATE.md`

4. **Check for JIRA ticket** by running: `echo $JIRA_TICKET`

## Step 2: Generate Output

Output ONLY the following format. Start immediately with "COMMIT MESSAGE:" - no preamble or commentary:

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

IMPORTANT formatting rules:

- Section labels must be plain text exactly as shown: "COMMIT MESSAGE:", "PR TITLE:", "PR BODY:"
- Do NOT use markdown formatting on the labels (no **bold**, no `code blocks` around them)
- Separate sections with exactly "---" on its own line
- The PR BODY content can contain any valid markdown (code blocks, lists, etc.)

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

- NEVER add "Generated with Claude Code" or similar signatures to commit messages or PR body
- NO emojis unless explicitly requested
- Before generating PR content, ensure the `run-linters` skill has been executed to verify code quality
