---
name: run-linters
description: Run linters, lint the code, check code style, or fix linting issues. Use when the user wants to lint, run linters, check code quality, verify code style, fix linting errors, or run code checks after completing code modifications.
allowed-tools: Bash(linters:*), Bash(awk:*), Bash(basename:*), Bash(bundle:*), Bash(cargo:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(go:*), Bash(golangci-lint:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(make:*), Bash(mkdir:*), Bash(npm:*), Bash(npx:*), Bash(pnpm:*), Bash(python3:*), Bash(rake:*), Bash(rubocop:*), Bash(ruff:*), Bash(sed:*), Bash(shellcheck:*), Bash(sort:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*), Bash(yamllint:*), Bash(yarn:*), Read, Edit
---

# Run Linters

Execute linters after code changes are complete to ensure code quality and consistency.

## When to Use

- After completing a set of code changes (not after each small edit)
- Before creating a commit or PR
- When asked to verify code quality

## Step 0: Check for the linters wrapper

The `linters` wrapper is the preferred path, but it is not installed everywhere. Check for it first:

```bash
which linters
```

**If `linters` is found:** continue to Step 1 unchanged.

**If `linters` is NOT found:** tell the user plainly that the `linters` wrapper is not installed on this machine and that you are falling back to the repository's own linters. Then detect which linters the repository configures and run them directly:

| Config file present | Linter to run |
| --- | --- |
| `.eslintrc*`, `eslint.config.*` | `npx eslint .` |
| `.rubocop.yml` | `bundle exec rubocop` (or `rubocop`) |
| `ruff.toml`, `.ruff.toml`, `pyproject.toml` (with `tool.ruff`) | `ruff check .` |
| `.golangci.yml`, `.golangci.yaml` | `golangci-lint run` |
| `Cargo.toml` | `cargo clippy` |
| `.markdownlint*` | `npx markdownlint-cli2 .` |
| `.yamllint*` | `yamllint .` |
| `*.sh` files | `shellcheck` on the shell scripts |

Prefer the project's own runner whenever one exists — an `npm run lint` script in `package.json`, a `rake lint` task, or a `make lint` target that already wraps the linter — over invoking the binary directly. Use the package manager the repository already uses (`npm`, `yarn`, or `pnpm`).

If neither the `linters` wrapper nor any recognised linter config is found, stop and tell the user exactly which config files you searched for. Do NOT claim the code is lint-clean.

## Step 1: Run Linters

Execute the `linters` command which auto-detects active linters in the current repository and runs them with proper configurations:

```bash
linters
```

## Step 2: Analyze Results

- If no issues: Report success and proceed
- If issues found: Continue to Step 3

## Step 3: Fix Issues

For each issue reported:

1. Read the affected file
2. Understand the linting error
3. Fix the issue **in the source code** using Edit tool
4. Re-run `linters` to verify the fix

Repeat until all issues are resolved.

## Important Rules

- Do NOT run after every small change - wait until a logical set of changes is complete
- Fix all issues before reporting completion
- **NEVER report lint success without a linter having actually run and produced output** - a missing command, a failed invocation, or a run you skipped is not a pass
- **NEVER modify linter configuration files** to suppress or ignore issues
- **NEVER add inline disable comments** (e.g., `// eslint-disable`, `# noqa`, `// nolint`) to bypass issues
- Always fix the actual code, not the linter rules
- If an issue seems impossible to fix properly, ask the user for guidance

## Forbidden Files - NEVER Modify

The following configuration files must NEVER be edited to work around linting issues:

**JavaScript/TypeScript:**

- `.eslintrc`, `.eslintrc.js`, `.eslintrc.json`, `.eslintrc.yml`
- `.prettierrc`, `.prettierrc.js`, `.prettierrc.json`
- `eslint.config.js`, `eslint.config.mjs`
- `tsconfig.json` (for strict mode or type checking options)

**Python:**

- `.flake8`, `setup.cfg` (flake8 section)
- `pyproject.toml` (tool.flake8, tool.pylint, tool.ruff sections)
- `.pylintrc`, `pylintrc`
- `ruff.toml`, `.ruff.toml`
- `mypy.ini`, `.mypy.ini`

**Ruby:**

- `.rubocop.yml`, `.rubocop_todo.yml`

**Go:**

- `.golangci.yml`, `.golangci.yaml`

**Rust:**

- `clippy.toml`, `.clippy.toml`
- `rustfmt.toml`, `.rustfmt.toml`

**Markdown:**

- `.markdownlint.json`, `.markdownlint.yaml`, `.markdownlint.yml`
- `.markdownlintrc`

**General:**

- `.editorconfig`
- Any file that defines linting rules or ignores

## Forbidden Patterns - NEVER Use

Do NOT add these patterns to bypass linting:

```text
# JavaScript/TypeScript
/* eslint-disable */
// eslint-disable-line
// eslint-disable-next-line
/* prettier-ignore */
// @ts-ignore
// @ts-nocheck

# Python
# noqa
# type: ignore
# pylint: disable
# ruff: noqa

# Go
//nolint
//nolint:all

# Ruby
# rubocop:disable

# Rust
#[allow(...)]
#![allow(...)]
```

If you encounter an issue that seems unfixable, explain the problem to the user and ask how they want to proceed.

## Shell Script Linting Rules (SL0001, SL0002)

When fixing shell script lint errors (e.g., from `shellcheck` or custom shell linters), apply these rules:

### SL0001: Variables must use braces

Always wrap shell variables in `${}` braces. This prevents ambiguity and word-splitting bugs.

```bash
# Bad
echo "$HOME/.local/bin:$PATH"
if [ "$CURRENT_BRANCH" != "$MASTER_BRANCH" ]; then

# Good
echo "${HOME}/.local/bin:${PATH}"
if [ "${CURRENT_BRANCH}" != "${MASTER_BRANCH}" ]; then
```

### SL0002: Use `==` instead of `=` for string comparison

In `[` and `[[` test expressions, use `==` for string equality, not `=`.

```bash
# Bad
if [ "${CONFIGURATION}" = "Debug" ]; then

# Good
if [ "${CONFIGURATION}" == "Debug" ]; then
```

### General Shell Script Fixes

- **Quote all variable expansions** — `"${VAR}"` not `$VAR`
- **Use `[[` over `[` when possible** — safer, supports `&&`, `||`, pattern matching
- **Use `$(command)` over backticks** — `` `command` `` is deprecated
