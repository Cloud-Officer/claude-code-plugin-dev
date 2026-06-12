---
name: monday
description: Manage monday.com boards, items, and work management data. Use when the user wants to look up or create items, search a board, update item status or column values, add an update/comment, move items between groups, create boards, groups, or columns, inspect a board's schema, look up users or teams, or create and read WorkForms in monday.com.
allowed-tools: mcp__monday__*, Bash(jq:*), Bash(echo:*)
---

# monday.com

Manage monday.com boards, items, groups, columns, and updates via the official
monday MCP server.

## Authentication

This skill uses the **monday MCP server only** — there is no monday CLI fallback.
The server (`mcp__monday__*`) reads a **personal access token** from the
`MONDAY_TOKEN` environment variable.

To get a token: in monday.com, click your **avatar → Developers → My access
tokens**, and copy your personal token. Export it before launching Claude Code:

```bash
export MONDAY_TOKEN="your_monday_api_token"
```

All tool calls execute as that user and are subject to that user's monday.com
permissions. If `mcp__monday__*` tools are not available (tool not found errors),
the token is missing or the MCP server failed to start — inform the user and stop.

## MCP Tools

| Operation | Tool |
| --- | --- |
| **Search items by name** | `mcp__monday__get_board_items_by_name` |
| **Create item** | `mcp__monday__create_item` |
| **Update column values** | `mcp__monday__change_item_column_values` |
| **Move item to group** | `mcp__monday__move_item_to_group` |
| **Delete item** | `mcp__monday__delete_item` |
| **Add update / comment** | `mcp__monday__create_update` |
| **Get board schema** (columns + groups) | `mcp__monday__get_board_schema` |
| **Create board** | `mcp__monday__create_board` |
| **Create group** | `mcp__monday__create_group` |
| **Create column** | `mcp__monday__create_column` |
| **Delete column** | `mcp__monday__delete_column` |
| **List users and teams** | `mcp__monday__list_users_and_teams` |
| **Create form** | `mcp__monday__create_form` |
| **Get form** | `mcp__monday__get_form` |

**Dynamic API tools** (`mcp__monday__all_monday_api`, `get_graphql_schema`,
`get_type_details`) expose the full GraphQL API but are **disabled by default**.
They require launching the server with `--enable-dynamic-api-tools true` and are
not compatible with read-only mode.

## Usage

1. **Understand the request** — which board, item, or field? If the board or
   column IDs are unknown, call `get_board_schema` (or
   `get_board_items_by_name`) first to discover them.
2. **Resolve before mutating** — column values must match the board's column
   types and IDs; fetch the schema before `create_item` or
   `change_item_column_values` rather than guessing.
3. **Execute** the appropriate MCP tool.
4. **Present results** clearly — show item names with their IDs, board name, and
   the relevant column values.

## Important Rules

- **Never create, modify, move, or delete boards, items, columns, or updates
  without explicit user confirmation** — these write to live workspace data.
- **`delete_item` and `delete_column` are permanent** — always confirm the exact
  target (by name *and* ID) before deleting.
- **Always show IDs** alongside names when presenting results, so the user can
  act on the right object.
- **Respect permissions** — calls run as the token's user; if a call fails with a
  permission error, report it rather than retrying with a different approach.
