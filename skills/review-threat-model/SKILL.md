---
name: review-threat-model
description: Review, create, update, or audit a repo-specific security threat model (docs/threat-model.md) — map trust boundaries, assets, entry points, and attacker capabilities, then enumerate concrete abuse paths with likelihood and impact. Use when the user wants a threat model, STRIDE analysis, attack-surface review, security design review, abuse-case enumeration, or ISO 27001 secure-development (A.8.25 / A.8.27 / A.8.28) evidence. Grounds every threat in actual code; creates the doc if missing, updates it if present.
allowed-tools: Read, Grep, Glob, Write, Edit, Agent, WebSearch, WebFetch, Bash(git:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(xargs:*), mcp__context7__*
---

# Threat Model

Produce an **application-security-grade, repo-specific threat model** — not a generic checklist. Every threat is anchored to real code (a file, route, parser, or trust boundary), rated by likelihood × impact, and mapped to an existing or missing mitigation. The output is `docs/threat-model.md`, structured so it doubles as **ISO 27001 secure-development evidence**.

The mid-2026 pattern this skill follows: **LLM-assisted generation with a human reviewer who signs off** — the model drafts a credible first pass, prunes false positives, and rates risk, but a human owns the accept/mitigate decision. State that explicitly in the output.

When another skill invokes this one with a review-only instruction (e.g. code-review-deep's opt-in deep security pass), analyze and report findings only — do not create, write, or edit any file.

## When to Use

- Before building or reviewing a service, feature, or internet-exposed interface (design-phase threat modeling — ISO 27001 A.8.25 / A.8.27).
- To document attack surface for a pentest scope or a security/compliance audit.
- When the user asks for a "threat model", "STRIDE analysis", "attack surface", "abuse cases", or "security design review".

## Methodology: STRIDE first, layer as needed

Use a **maturity-based, layered** approach (the 2026 best practice) — don't force one framework:

- **STRIDE** (default, broad, developer-friendly) — classify threats per element as **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege.
- **LINDDUN** (layer in when the system handles **personal or regulated data** — GDPR / PIPEDA / HIPAA) — privacy threats: Linkability, Identifiability, Non-repudiation, Detectability, Disclosure, Unawareness, Non-compliance.
- **PASTA** (risk-centric, business-impact) — use for compliance-heavy or high-value systems where threats must tie to business objectives.
- **Attack trees** — reserve for a small number of **critical** components where the cost of enumeration pays off (auth, crypto, payment, key management).

Always decide *which* to apply from the system, and say so in the output. Keep it lightweight where possible — a focused model beats an exhaustive one nobody reads.

## Step 1: Understand the system (ground the model in code)

Detect the stack and map the architecture from the actual repo — never from assumptions. For large or multi-service repos, fan out `Agent` (`subagent_type: Explore`) per service/subsystem and read the files they surface yourself.

Find these four things per stack:

| Element | Where to look (by stack) |
| --- | --- |
| **Entry points** (attack surface) | Rails `config/routes.rb` + controllers; Laravel/Symfony `routes/*`, controllers; Flask/FastAPI/Django route decorators + `urls.py`; Express/Next.js `app/api/**`, `pages/api/**`, routers; Go `http.HandleFunc`/mux/gin routes; Swift/Kotlin API clients + deep links + URL schemes; gRPC/GraphQL schemas; CLI args; queue/webhook/cron consumers; file/upload handlers |
| **Trust boundaries** | Network edges (public vs internal), service-to-service calls, DB/cache/queue access, third-party SDK/API calls, auth/session layers, admin vs user surfaces, tenant isolation, browser↔server, mobile↔backend |
| **Assets** | Credentials/secrets, PII/PHI/payment data, tokens/sessions, crypto keys, business-critical records, audit logs, infra state (IaC), model artifacts |
| **Actors & capabilities** | Anonymous internet user, authenticated user, privileged/admin, tenant neighbor, insider, compromised dependency, network MITM, malicious file/input |

Also capture: authN/authZ mechanism, input validation approach, secrets handling, transport (TLS), and existing security controls (WAF, rate limiting, CSP, RBAC) — these become the "existing mitigations" column.

## Step 2: Enumerate threats (per element, grounded)

Walk each **entry point** and **trust boundary** and apply STRIDE (plus LINDDUN where personal data flows). For each threat, produce a concrete **abuse path** tied to code — e.g. "unauthenticated `POST /api/import` (`app/controllers/import_controller.rb:14`) parses user-supplied XML with `Nokogiri` defaults → XXE → file read / SSRF." Prefer real sinks over hypotheticals.

High-signal areas to always probe (wide, stack-agnostic):

- **Input sinks:** SQL/NoSQL (injection), OS/command exec, deserialization (pickle/Marshal/`unserialize`/Java), template engines (SSTI), XML parsers (XXE), path handling (traversal), redirects/SSRF, file uploads (type/where stored/executed).
- **AuthN/AuthZ:** missing/weak auth on a route, IDOR / missing object-level checks, tenant isolation, privilege escalation, JWT/session flaws, password/OTP handling.
- **Data exposure:** secrets in code/logs, over-broad API responses, PII in logs/errors, unencrypted data at rest/in transit.
- **Web:** CSRF, XSS (stored/reflected/DOM), CORS misconfig, missing security headers (CSP, HSTS, X-Content-Type-Options).
- **Supply chain:** untrusted dependencies, unpinned actions, model/artifact loading from untrusted sources.
- **DoS & abuse:** unbounded input, missing rate limits, expensive queries, ReDoS.

## Step 3: Rate likelihood × impact

Assign each threat a qualitative rating. Default rubric (state it in the output):

- **Impact:** Critical / High / Medium / Low — data loss, RCE, auth bypass, compliance breach → higher.
- **Likelihood:** High / Medium / Low — exposure (internet-facing?), attacker skill required, whether a control already blocks it.
- **Risk** — derived from Impact × Likelihood via this matrix (rows = Impact, columns = Likelihood); it orders the prioritized list:

  | Impact \ Likelihood | High | Medium | Low |
  | --- | --- | --- | --- |
  | Critical | Critical | Critical | High |
  | High | High | High | Medium |
  | Medium | Medium | Medium | Low |
  | Low | Low | Low | Low |

  Don't over-engineer scoring beyond the matrix; the point is to rank, not to compute a false-precision number.

## Step 4: Map mitigations (existing vs. missing)

For each meaningful threat, record: the **existing** control (cite the code that implements it), or that it's **missing/partial**, plus a concrete recommended mitigation grounded in the stack. Distinguish **residual risk** the org may accept — flag it, don't silently drop it. This accept/mitigate call is the human sign-off point.

## Step 5: ISO 27001 evidence mapping

Most target orgs run **ISO 27001:2022**. Tag the model so it serves as audit evidence:

| ISO 27001:2022 control | How this model provides evidence |
| --- | --- |
| **A.8.25** Secure development lifecycle | Threat modeling performed in design/planning; documented and repeatable |
| **A.8.27** Secure architecture & engineering principles | Trust boundaries + architecture-level threats identified and mitigated by design |
| **A.8.28** Secure coding | Code-level sinks (injection, deserialization, etc.) enumerated with fixes |
| **A.8.29** Security testing | Abuse paths become security test cases / pentest scope |
| **A.5.7** Threat intelligence | Note current, real-world threat classes relevant to the stack (use WebSearch for recent CVE-class trends when useful) |

Include a short "ISO 27001 mapping" section listing which controls the exercise supports and any gaps surfaced.

## Step 6: Write `docs/threat-model.md`

Structure (adjust to the system; skip empty sections):

```text
# Threat Model — <system/service>

**Date:** <ISO-8601>   **Scope:** <what was modeled>   **Method:** STRIDE (+ LINDDUN / PASTA as noted)
**Status:** DRAFT — requires human security sign-off

## System overview
- Architecture, components, and data flows (grounded in code)

## Assets
| Asset | Sensitivity | Where it lives |

## Trust boundaries & entry points
| # | Boundary / entry point | File / route | Actors reaching it |

## Threats (prioritized)
### T-01 — <title>  ·  Risk: <Critical/High/...>
- **STRIDE / LINDDUN category:** ...
- **Abuse path:** <concrete, cites file:line>
- **Likelihood × Impact:** ...
- **Existing control:** <code ref, or "none">
- **Recommended mitigation:** ...
- **Residual risk / decision:** <accept / mitigate — for human sign-off>

## ISO 27001:2022 mapping
- A.8.25 / A.8.27 / A.8.28 / A.8.29 / A.5.7 — coverage + gaps

## Assumptions & out of scope

## Sign-off
- Modeled by: AI (draft)  ·  Reviewed & accepted by: __________ (human)
```

Row order: sort the Assets table by Asset bytewise ascending; sort the Trust boundaries & entry points table by Boundary / entry point bytewise ascending, tie-broken by File / route bytewise ascending, and assign `#` sequentially in that order.

Pass `markdownlint-cli2` defaults: blank lines around lists/tables/fences, a language on every fence, one trailing newline.

## Integration with co-dev

- **`code-review-deep`** → the threat model tells its `A_SECURITY` agent where to look hardest; run this first for a design-level view, then `code-review-deep` for line-level findings.
- **`create-issue`** → for each High/Critical threat with a missing control, offer to open issues (label `security`).
- **`review-architecture`** → trust boundaries here should match the architecture doc; flag divergence.
- **`co-private:review-iso`** (if present) → this model is direct evidence for the A.8.25/8.27/8.28 procedures.

## Important Rules

- **Ground every threat in code.** No template threats — each must cite a real file/route/sink. If you can't tie it to the repo, drop it or mark it explicitly as a general/assumed risk.
- **Human signs off.** The output is a DRAFT; the accept-vs-mitigate decision and final risk acceptance belong to a person. Never present the model as an authoritative final artifact.
- **Rate honestly, prune false positives.** Better a short model of real, ranked threats than a long list of hypotheticals. Say what you did NOT cover.
- **Match the method to the system.** STRIDE by default; add LINDDUN only when personal/regulated data flows; PASTA/attack-trees only when the value justifies it. State which you used and why.
- **Don't leak secrets into the doc.** Reference where a secret lives, never paste its value.
- **Read-only on the codebase.** This skill analyzes and writes the report only — it does not change application code.
- **No silent scope cuts.** If you sampled (e.g. modeled 2 of 5 services), say so in Scope.
