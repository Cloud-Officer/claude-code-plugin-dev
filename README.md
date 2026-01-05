# claude-code-plugin-dev [![Build](https://github.com/Cloud-Officer/claude-code-plugin-dev/actions/workflows/build.yml/badge.svg)](https://github.com/Cloud-Officer/claude-code-plugin-dev/actions/workflows/build.yml)

Claude Code plugin for development workflow automation.

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Usage](#usage)
  - [Commands](#commands)
  - [Skills](#skills)
  - [Local Development](#local-development)
- [Contributing](#contributing)

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

| Skill          | Description                                        |
| -------------- | -------------------------------------------------- |
| `create-pr`    | Generate commit message, PR title, and PR body     |
| `create-issue` | Create GitHub or Jira issues with proper templates |
| `run-linters`  | Run linters and fix any issues found               |

### Local Development

```bash
claude --plugin-dir /path/to/claude-code-plugin-dev
```

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.
