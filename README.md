# claude-code-plugin-dev [![Build](https://github.com/Cloud-Officer/claude-code-plugin-dev/actions/workflows/build.yml/badge.svg)](https://github.com/Cloud-Officer/claude-code-plugin-dev/actions/workflows/build.yml)

Claude Code plugin for development workflow automation.

## Table of Contents

* [Introduction](#introduction)
* [Installation](#installation)
* [Usage](#usage)
  * [Commands](#commands)
  * [Skills](#skills)
  * [Local Development](#local-development)
* [Contributing](#contributing)

## Introduction

This plugin provides development workflow automation for Claude Code, including issue tracking integration (GitHub Issues and Jira), automated code reviews, PR generation, and linting.

## Installation

```bash
/plugin marketplace add cloud-officer/claude-code-plugin-dev
/plugin install co-dev@cloud-officer
```

## Usage

### Commands

| Command                        | Description                                      |
| ------------------------------ | ------------------------------------------------ |
| `/co-dev:fix-issue <issue-id>` | Fix a GitHub or Jira issue with guided workflow  |
| `/co-dev:code-review-deep`     | Deep code review using parallel agent strategy   |

### Skills

These skills are automatically available to Claude:

| Skill                 | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `analyze-db`          | Generate .claude/DB.md with database schema docs        |
| `create-issue`        | Create GitHub or Jira issues with proper templates      |
| `create-pr`           | Generate commit message, PR title, and PR body          |
| `query-db`            | Query databases using natural language via CLI          |
| `review-architecture` | Review or create docs/architecture.md                   |
| `review-manual`       | Review or create docs/manual.md with user documentation |
| `review-readme`       | Review or create README.md to match standards           |
| `run-linters`         | Run linters and fix any issues found                    |

### Local Development

```bash
claude --plugin-dir /path/to/claude-code-plugin-dev
```

## Contributing

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

* Reporting a bug
* Discussing the current state of the code
* Submitting a fix
* Proposing new features
* Becoming a maintainer

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `master`.
2. If you've added code that should be tested, add tests. Ensure the test suite passes.
3. Update the documentation.
4. Make sure your code lints.
5. Issue that pull request!

When you submit code changes, your submissions are understood to be under the same [License](LICENSE) that covers the
project. Feel free to contact the maintainers if that's a concern.
