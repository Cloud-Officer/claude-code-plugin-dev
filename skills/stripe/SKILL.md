---
name: stripe
description: Manage Stripe payments, customers, or financial data. Use when the user wants to check payments, payment intents, charges, refunds, list customers, view invoices, manage subscriptions, check balance, manage products, prices, coupons, webhooks, disputes, payouts, or look up any Stripe data.
allowed-tools: Bash(stripe:*), Bash(curl:*), Bash(jq:*), Bash(echo:*), mcp__stripe__*
---

# Stripe

Manage Stripe payments, customers, and subscriptions.

## MCP Tools with Fallbacks

**Prefer MCP tools** (`mcp__stripe__*`) when available. If MCP tools are not available (tool not found errors), **fall back to the `stripe` CLI**.

| Operation | MCP Tool | CLI Fallback |
| --- | --- | --- |
| Get account info | `mcp__stripe__get_stripe_account_info` | `stripe account` |
| Get balance | `mcp__stripe__retrieve_balance` | `stripe balance retrieve` |
| List customers | `mcp__stripe__list_customers` | `stripe customers list` |
| Create customer | `mcp__stripe__create_customer` | `stripe customers create --email "..."` |
| List invoices | `mcp__stripe__list_invoices` | `stripe invoices list` |
| List subscriptions | `mcp__stripe__list_subscriptions` | `stripe subscriptions list` |
| List products | `mcp__stripe__list_products` | `stripe products list` |
| List coupons | `mcp__stripe__list_coupons` | `stripe coupons list` |

**Note:** The `stripe` CLI requires authentication via `stripe login`. If neither the MCP nor CLI is available, inform the user and stop.

## Usage

1. **Understand the request** — What does the user want? (look up customer, check payment, list invoices)
2. **Execute** — Use MCP tools (preferred) or CLI fallback
3. **Present results** — Format financial data clearly with amounts, currencies, and dates

## Important Rules

- **Never create charges or modify subscriptions without user confirmation**
- **Format currency properly** — Stripe stores amounts in cents; divide by 100 for display
- **Mask sensitive data** — Do not display full card numbers or bank account details
