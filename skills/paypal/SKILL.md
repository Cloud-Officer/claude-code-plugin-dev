---
name: paypal
description: Manage PayPal payments, invoices, or financial data. Use when the user wants to check payments, orders, refunds, create or view invoices, manage disputes, subscriptions, catalog products, shipment tracking, or look up any PayPal transaction data.
allowed-tools: Bash(curl:*), Bash(jq:*), Bash(echo:*), mcp__paypal__*
---

# PayPal

Manage PayPal invoices, payments, and disputes.

## MCP Tools (no CLI fallback)

Use MCP tools (`mcp__paypal__*`) for all PayPal operations. **There is no PayPal CLI.** If MCP tools are not available, inform the user and stop.

| Operation | MCP Tool |
| --- | --- |
| Create invoice | `mcp__paypal__create_invoice` |
| List invoices | `mcp__paypal__list_invoices` |
| Get payment details | `mcp__paypal__get_payment` |
| List disputes | `mcp__paypal__list_disputes` |
| List subscriptions | `mcp__paypal__list_subscriptions` |
| Track shipment | `mcp__paypal__track_shipment` |

## Usage

1. **Understand the request** — What does the user want? (check payment, create invoice, view disputes)
2. **Execute** — Use MCP tools
3. **Present results** — Format financial data clearly with amounts, currencies, and dates

## Important Rules

- **Never create invoices or send payments without user confirmation**
- **Format currency properly** — Display amounts with proper decimal places and currency codes
- **Mask sensitive data** — Do not display full account numbers or personal details
- **MCP required** — This skill cannot function without PayPal MCP access. If unavailable, inform the user.
