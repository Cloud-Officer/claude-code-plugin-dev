---
name: review-ownership-map
description: Review, create, or update a code-ownership and knowledge-risk map (docs/ownership-map.md) from git history — compute bus factor, find single points of failure, flag sensitive files owned by one person, detect CODEOWNERS drift and stale security code. Use when the user wants an ownership map, bus factor / truck factor analysis, knowledge-risk audit, single-point-of-failure review, or ISO 27001 segregation-of-duties / competence evidence. Read-only on code; creates the doc if missing, updates it if present.
allowed-tools: Read, Grep, Glob, Write, Edit, Bash(git:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(xargs:*)
---

# Ownership Map

Build a **people ↔ files** picture from git history and turn it into a **knowledge-risk report**: where the bus factor is 1, which sensitive files (auth, crypto, payment, secrets, IaC) depend on a single person, where actual ownership has drifted away from `CODEOWNERS`, and which security-relevant code has gone stale. The output is `docs/ownership-map.md`.

Frame everything as **risk, not blame**. The bus factor is a conversation starter and a diagnostic — the cure is cultural (pairing, reviewer rotation, documentation, test coverage), not a performance verdict on any individual.

## When to Use

- Auditing knowledge concentration / single points of failure across a repo or fleet.
- ISO 27001 evidence for **segregation of duties** (A.5.3) and **competence/awareness** (knowledge-risk management).
- Due diligence, re-org planning, or before a key contributor leaves.
- When the user asks for "bus factor", "truck factor", "code ownership", "knowledge risk", "single point of failure", or "CODEOWNERS drift".

## Definitions (state these in the report)

- **Bus factor (truck factor):** the number of contributors who'd have to be lost before the project (or a file/directory) can't proceed — i.e. the minimum set of people covering **> 50%** of the knowledge. Lower = riskier; **1 = single point of failure**.
- **Ownership:** approximated from git history. Two signals, both imperfect:
  - **Commit share** — how many commits a contributor made to a file (cheap, over-counts churn).
  - **Blame share** — how many *current* lines `git blame` attributes to a contributor (closer to "who owns the code that exists now"). Prefer blame for the headline numbers; use commits for trend/recency.
- **Knowledge decay:** ownership erodes when others modify code you haven't touched, and when a file goes long untouched. Weight recent activity higher.

Say plainly in the output: **git blame shows who last touched a line, not who understands it best.** Pairing, reviews, and docs spread knowledge that git can't see. The 50% threshold is a configurable default, not truth.

## Step 1: Scope and gather git data

Work from the repo root on the default branch. Respect `--since` if the user gives a window (default: full history, but weight the last 12 months). Exclude vendored/generated paths (`node_modules`, `vendor`, `dist`, `build`, `Pods`, `.build`, generated protobufs, lockfiles) so ownership reflects authored code.

Useful primitives:

```bash
# Active contributors (last 12 months)
git log --since="12 months ago" --format='%aN <%aE>' | sort | uniq -c | sort -rn

# Per-file commit share (top author + how dominant)
git log --format='%aN' -- <path> | sort | uniq -c | sort -rn

# Blame-based line ownership for a file (current lines per author)
git blame --line-porcelain <path> | sed -n 's/^author //p' | sort | uniq -c | sort -rn

# Last time a file changed (staleness)
git log -1 --format='%ci' -- <path>

# Co-change: files that change together (commits touching multiple paths)
git log --name-only --format='%H' | awk 'NF' | ...   # group paths by commit, count co-occurrences
```

For a fleet or large repo, compute per-**directory/module** first (cheaper, more actionable), then drill into flagged files. Map identities: fold duplicate authors (same person, different name/email) via `.mailmap` if present, or by matching emails — note any merges you made.

## Step 2: Compute the risk signals

For each file/module of interest:

1. **Bus factor** — sort contributors by blame share descending; count how many are needed to exceed 50%. That count is the bus factor. Also record the **top owner's %** (a single owner > 75% is a knowledge silo even if bus factor rounds to 1).
2. **Sensitive-code ownership** — restrict the analysis to security-relevant files (table below) and flag any with **bus factor 1** or a single owner > 75%. These are the highest-priority findings.
3. **Ownership drift** — if `CODEOWNERS` exists, compare declared owners against actual blame owners; flag files where the real owner isn't the declared one (or the declared owner has left / stopped contributing).
4. **Stale sensitive code** — sensitive files not modified in N months (default 9) whose owner is inactive: nobody currently "owns" the risk.
5. **Co-change clusters** — files that repeatedly change together but have *different* owners reveal hidden coupling and shared-but-unclear responsibility.

## Step 3: Identify sensitive files (wide, stack-agnostic)

Bus-factor-1 matters most on security-critical code. Locate these across any stack (grep/glob by path and content):

| Category | Where it typically lives |
| --- | --- |
| **Auth / session / identity** | `*auth*`, `*session*`, `devise`/`warden` config, `*login*`, JWT/OAuth handlers, middleware, guards, `*permission*`, `*rbac*`, policy files |
| **Crypto / secrets** | `*crypto*`, `*cipher*`, `*encrypt*`, key management, `*.pem`/keystore handling, `credentials.yml.enc`, secrets loaders, signing/verification |
| **Payment / billing** | `*payment*`, `*billing*`, `*invoice*`, Stripe/PayPal/PSP integration, webhook verifiers |
| **Input boundaries** | parsers, file-upload handlers, deserialization, API controllers on the internet edge |
| **Infra / IaC** | Terraform/CloudFormation (`*.tf`, `*-vpc.yaml`, `*-instances.yaml`), k8s manifests, CI/CD workflows, `Dockerfile`, deploy scripts |
| **Data / migrations** | schema migrations, DB access layers, PII/PHI models |
| **Compliance-relevant** | audit-logging, consent, retention, access-control config |

Detect the stack (Ruby/Rails, PHP/Laravel, Python, JS/TS, Swift, Kotlin/Java, Go, C/C++, .NET) and adjust the globs — but the categories above are universal.

## Step 4: Write `docs/ownership-map.md`

Lead with the **risk matrix** (change frequency × ownership concentration) — most teams track churn but miss the concentration dimension, which is where the risk hides.

```text
# Ownership Map & Bus Factor — <repo>

**Date:** <ISO-8601>   **Window:** <full history, weighted last 12mo>   **Threshold:** 50% (bus factor), 75% (silo)
**Method:** git blame line-ownership + commit recency. Note: blame ≠ understanding (see Caveats).

## Headline risks
- Repo bus factor: <N>
- Sensitive files with bus factor 1: <count>  (auth/crypto/payment/IaC)
- CODEOWNERS drift: <count>   ·   Stale sensitive code: <count>

## Risk matrix
| File / module | Change freq | Top owner (%) | Bus factor | Sensitive? | Risk |

## Single points of failure (bus factor 1 on sensitive code)
| File | Owner | Owner active? | Last changed | Why it matters |

## CODEOWNERS drift
| File | Declared owner | Actual owner | Note |

## Stale sensitive code
| File | Owner | Last changed | Owner active? |

## Co-change clusters (hidden coupling)
| Cluster (files) | Owners | Note |

## Recommended actions (cultural, not just tooling)
- Pairing / mandatory reviewer rotation on the flagged files
- Document critical logic; raise test coverage on high-risk files
- Knowledge overlap (not role duplication) for single-owner sensitive code

## Caveats & method
- Blame shows last-touch, not understanding; knowledge spreads via reviews/pairing/docs
- 50%/75% thresholds are defaults; identities folded via .mailmap where possible
```

Optionally, when the user asks, also emit a **CSV** (`file,top_owner,top_owner_pct,bus_factor,sensitive,last_changed`) for import into a dashboard or graph tool.

Pass `markdownlint-cli2` defaults (blank lines around lists/tables/fences, fenced-block languages, single trailing newline).

## ISO 27001 angle

For orgs running ISO 27001:2022, this report is evidence for **knowledge-risk / segregation-of-duties** management:

- **A.5.3 Segregation of duties** — single-owner control over sensitive code (e.g. one person owns both auth *and* its review path) is a segregation gap.
- **Competence & awareness (Clause 7.2)** — documents where critical knowledge is concentrated and the plan to spread it.
- Feeds the risk assessment: bus-factor-1 on payment/crypto is a documented operational risk with a mitigation (pairing/rotation/docs).

## Integration with co-dev

- **`code-review-deep`** → its governance phase already reasons about `team_profile`; this skill gives the file-level ownership detail behind it.
- **`review-threat-model`** → cross-reference: a trust-boundary component with bus factor 1 is a compounded risk (critical *and* fragile).
- **`create-issue`** → offer to open issues for bus-factor-1 sensitive files (label `knowledge-risk` / `security`).

## Important Rules

- **Risk, not blame.** Never frame a person as the problem. Report concentration as an organizational risk with cultural remedies. Do not rank or shame individuals.
- **Read-only.** Analyze git history and write the report — never modify code or git history.
- **State the limitations every time.** Blame ≠ understanding; thresholds are defaults; the number is a conversation starter, not a verdict. A report without caveats is misleading.
- **Fold identities.** Use `.mailmap` / email matching so one person under two aliases isn't counted as two owners (which would hide a real bus-factor-1). Note the merges.
- **Prioritize sensitive code.** A bus factor of 1 on a README is noise; on `auth`/`crypto`/`payment`/IaC it's the headline. Lead with the latter.
- **Exclude vendored/generated paths** so ownership reflects authored code, and say what you excluded.
- **No silent scope cuts.** If you analyzed directories not every file, or a time window, state it.
- **Review-only mode.** When the invoker's args ask for review-only / findings-only (e.g. `code-review-deep` Step 3.5 folding this skill into a larger audit), run Steps 1-3 as normal but **do not write `docs/ownership-map.md`** (or the optional CSV) — return the same structure in the conversation instead, so the invoker can fold the single-points-of-failure into `OWN-*` findings. Create or modify **no** file. Keep the Caveats content in the returned text: blame is not understanding, and the thresholds are defaults, whether or not a file is written.
