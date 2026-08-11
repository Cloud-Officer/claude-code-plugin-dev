---
name: review-seo
description: Review, audit, or check SEO, GEO (AI answer-engine / generative-engine optimization), and front-end web quality (performance, Core Web Vitals, accessibility). Use when the user wants an SEO audit, technical SEO check, GEO/AEO audit, AI-search optimization, llms.txt review, structured-data/schema check, meta-tag/Open-Graph audit, sitemap or robots.txt review, crawlability analysis, a Lighthouse or web-quality audit, a performance or Core Web Vitals (LCP/INP/CLS) review, or an accessibility (WCAG) audit. Audits a codebase and/or a live site URL (usually production) and writes docs/seo-audit.md.
allowed-tools: Bash(curl:*), Bash(gh:*), Bash(git:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(mkdir:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*), Read, Write, Edit, Glob, Grep, TodoWrite, WebSearch, WebFetch, AskUserQuestion, Skill, mcp__fetch__fetch, mcp__github__get_file_contents, mcp__chrome-devtools__*
---

# Review SEO & GEO

Audit a web project for **SEO** (traditional search-engine optimization), **GEO/AEO** (generative-engine / AI answer-engine optimization — being found and cited by ChatGPT, Perplexity, Google AI Overviews, Claude, and similar), and **front-end web quality** — the remaining Lighthouse pillars beyond SEO: **performance, Core Web Vitals, and accessibility** (Phase 7), audited via the bundled `chrome-devtools` MCP. Produce `docs/seo-audit.md` with evidence-backed findings and, on approval, apply the fixes.

Works against a **codebase**, a **live URL** (usually production), or **both** — the user chooses in Phase 1.

## Phase Tracking

Use `TodoWrite` to track each phase. Mark `in_progress` on entry, `completed` when results are recorded. Do NOT include the task list in the final output.

**Required phases:**

1. Scan scope & inputs determined
2. Exemption check (skip-or-proceed decision)
3. Web stack detected (where meta/sitemap/robots live)
4. Technical SEO audited
5. GEO / AI answer-engine audited
6. Content & on-page audited
7. Performance, Core Web Vitals, accessibility & best practices (chrome-devtools MCP)
8. Report generated
9. Fixes applied (if approved)
10. Linters run (if files changed)

**Evidence rule:** every check must record (a) what was expected, (b) what was found with a source reference (`file:line`, or `URL` + the exact tag/line), and (c) PASS / FAIL / MISSING / N/A. A bare "PASS" without a quoted source is invalid.

## Phase 1: Scan Scope & Inputs

Ask the user (via `AskUserQuestion`) which scan mode to run, unless they already specified:

- **Codebase** — audit source (templates/views, `config/`, `public/`). Works offline; best for pre-deploy checks and for fixing issues at the source.
- **Live URL** — audit a deployed site (usually production). Catches what's actually served (rendered HTML, real headers, real status codes, redirects).
- **Both** — reconcile source vs. live; flag drift (e.g. a meta tag in a template that isn't in the served HTML).

If **Live URL** or **Both**, get the base URL (e.g. `https://example.com`). Confirm it's the intended environment before hitting it. Record `scan_mode` and `base_url`.

## MCP Tools with Fallbacks

Prefer MCP tools when available; fall back on errors. Never let one tool failure block the audit.

| Operation | Preferred | Fallback |
| --- | --- | --- |
| Fetch a live page (rendered) | `mcp__fetch__fetch` | `WebFetch` → `curl -sL` |
| Raw headers / status / redirects | `curl -sSIL` | n/a |
| Read source file | `Read` / `cat` | `mcp__github__get_file_contents` |
| Verify a current standard | `WebSearch` | `mcp__fetch__fetch` |
| Core Web Vitals / Lighthouse / a11y | `mcp__chrome-devtools__*` (bundled: `lighthouse_audit`, perf traces, a11y snapshot) | note as not-run + recommend Lighthouse in Chrome DevTools |

## Phase 2: Exemption Check

SEO/GEO only applies to **publicly indexable** pages. Stop early (write a short exemption report and STOP) if any of:

| Exempt case | Signal | Reason |
| --- | --- | --- |
| Authed-only app | Every route behind login; no public marketing/content pages | Nothing to index; SEO/GEO N/A |
| Internal tool / API-only | No HTML UI, or intranet-only | Not crawlable by design |
| Library / CLI / package repo | No web frontend | No pages to optimize |
| Non-web repo | Dotfiles, IaC, docs-only, plugin | No site |

If a project has **both** an authed app and a public marketing site, scope the audit to the public surface and say so in the report.

## Phase 3: Detect Web Stack

Identify where SEO artifacts live, so checks target the right files. Detect the framework and record `stack`:

- **Rails** — `app/views/**/*.erb|haml|slim`, layout in `app/views/layouts/`, `config/routes.rb`, `public/robots.txt`, `public/sitemap.xml` (or `sitemap_generator` gem).
- **Next.js** — `app/` (Metadata API) or `pages/`, `next-seo`/`next-sitemap`, `app/robots.ts`/`sitemap.ts`, `public/`.
- **Astro / static / Hugo / Jekyll** — layout templates, `public/`/`static/`, generated `sitemap.xml`.
- **SPA (React/Vue/Angular, Vite)** — client-rendered; flag SSR/crawlability risk in Phase 5.

For **codebase** mode, resolve the concrete files. For **live** mode, this is informational.

## Phase 4: Technical SEO Audit

For each item, gather evidence per the Evidence rule. In **codebase** mode, read templates/config; in **live** mode, fetch the **page sample** below and inspect served HTML/headers.

**Page sample** (fixed — every later phase that inspects a subset of pages uses this same set): the homepage, plus the first **5** `sitemap.xml` URLs in document order, deduplicated by path template (`/blog/:slug` counts once); if there is no sitemap, the first 5 internal links on the homepage in document order. Record the sampled URLs in the report header.

### 4.1 Meta & titles

- Unique `<title>` per page, ~50–60 chars.
- Unique `<meta name="description">`, ~120–155 chars.
- `<link rel="canonical">` present and absolute (avoids duplicate content).
- `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- No unintended `<meta name="robots" content="noindex">` on pages that should be indexed.
- `<html lang>` set.

### 4.2 Open Graph & social

- `og:title`, `og:description`, `og:image` (1200×630), `og:url`, `og:type`.
- `twitter:card` (`summary_large_image` when an image exists).

### 4.3 Structured data (JSON-LD)

- `<script type="application/ld+json">` present where relevant (`Organization`, `WebSite`, `BreadcrumbList`, plus `Article`/`Product`/`FAQPage`/`SoftwareApplication` as applicable).
- Valid JSON, `@context`/`@type` correct, fields match visible content. Recommend validating with Google Rich Results.

### 4.4 Sitemap

- `sitemap.xml` exists, lists indexable pages, includes `<lastmod>`, excludes `noindex` pages, under 50MB / 50k URLs per file, and is referenced in `robots.txt`.

### 4.5 robots.txt

- Exists, does not block CSS/JS (crawlers need them to render), does not block pages meant to be indexed, and includes a `Sitemap:` line.

### 4.6 Crawlability & delivery (mostly live mode)

- Correct HTTP status codes (200 for real pages; genuine 404s return `404`, not `200`).
- No redirect chains (A→B→C should be A→C); prefer a single 301.
- HTTPS enforced; canonical host (www vs apex) consistent.
- `hreflang` present and reciprocal for i18n/multi-locale sites.

### 4.7 Mobile-first & page experience

- Google indexes the **mobile** version — verify **content and link parity** between mobile and desktop (nothing important hidden or dropped on mobile), adequate tap-target sizing, and **no intrusive interstitials** (full-page popups) covering content.
- Real-device testing beats emulators; recommend Search Console URL Inspection and mobile-specific CWV.

### 4.8 Instant indexing (IndexNow) & Bing

- **IndexNow** — check whether the site pings IndexNow (often a one-click CDN toggle on Cloudflare/Akamai) so Bing/Yandex — and, downstream, **ChatGPT** (whose web search has relied on Bing's index) — pick up new/changed URLs within minutes. Note: **Google does not support IndexNow**.
- **Bing indexing** — because AI answer engines lean on Bing, confirm the site is submitted to **Bing Webmaster Tools** with a sitemap (teams routinely skip this). Verify current engine→index mappings against vendor docs, as they shift.

## Phase 5: GEO / AI Answer-Engine Audit

The forward-looking half — being surfaced and cited by AI answer engines (ChatGPT, Perplexity, Google AI Overviews/Gemini, Claude), not just ranked by Google. **These standards move fast** — the file formats and crawler names below are a baseline; confirm the current state with `WebSearch`/official vendor docs (OpenAI, Anthropic, Perplexity, Google bot docs, `llmstxt.org`, the `ai-robots-txt` project) rather than trusting memory.

### 5.1 llms.txt (curated index)

Check `/llms.txt` against the llmstxt.org spec. Expected structure:

- Optional BOM, then a single **H1** = site/project name (the only strictly required element).
- A **blockquote** summary carrying the key context.
- Optional freeform prose/lists (no headings).
- **H2** file-list sections whose links use `[name](url): optional note`.
- A special **`## Optional`** H2 whose links may be skipped when a shorter context is needed.

Validate: the file exists, parses to that shape, links resolve, and it points at the site's genuinely important pages (not autogenerated noise). Missing on a content/docs-heavy site → High.

### 5.2 llms-full.txt and expanded context (the detailed file)

- Check `/llms-full.txt` — the **full-content** file (actual page text inlined, not just links) for one-shot LLM ingestion. Also look for the FastHTML-style variants `llms-ctx.txt` (links unexpanded) and `llms-ctx-full.txt` (expanded).
- Validate it is real content (not a stub or a duplicate of `llms.txt`), reasonably complete vs. the site's key pages, and **fresh** — regenerated after content changes (compare against source/build date). A stale or truncated full file is worse than none: flag it.

### 5.3 Per-page Markdown versions

- Spec convention: a clean Markdown twin of each HTML page reachable by appending `.md` (or `index.html.md` for directory URLs) — an LLM-readable version of the page. Across the Phase 4 page sample, check whether a `.md` version is served (200 + Markdown) and matches the page's real content. Absent → Info/Low opportunity; recommend generating them at build time.

### 5.4 AI-crawler policy (robots.txt + headers + WAF)

AI crawlers split into **three categories that each need a separate decision** — one robots.txt rule cannot make all three correctly (verify names against vendor docs; they change often):

- **Training** (block = privacy/IP opt-out; does NOT affect Google Search rank): `GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended` (token), `Applebot-Extended` (token), `Bytespider`, `Amazonbot`, `Meta-ExternalAgent`.
- **Search / retrieval** (allow = AI-answer visibility): `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `Bingbot`.
- **User-triggered fetch** (block = access decision): `ChatGPT-User`, `Claude-User`, `Perplexity-User`, `Google-NotebookLM`, `Gemini-Deep-Research`, `DuckAssistBot`, `MistralAI-User`.

Audit steps:

- Fetch `robots.txt`; for each category report which agents are Allowed/Disallowed and whether that matches the site's **intent** — a site that wants citations must NOT block `OAI-SearchBot`/`Claude-SearchBot`/`PerplexityBot`; blocking `GPTBot`/`ClaudeBot`/`CCBot`/`Google-Extended` opts out of training without hurting Google rank.
- Flag **exact-spelling errors** (e.g. `GPT-Bot` vs `GPTBot`) — a typo silently fails.
- Note the limits: robots.txt is **voluntary**; `Perplexity-User` and `Bytespider` are documented to ignore it, so real enforcement needs **server/WAF/CDN** rules (e.g. Cloudflare AI-bot controls). Check for such controls if visible, and recommend them where the intent is to actually block.
- Optional: if server access logs are available, grep for these tokens to see which AI bots actually visit.

### 5.5 AI/agent JSON manifests & structured data (the json file)

- **`/.well-known/ai-plugin.json`** — if present, validate it is well-formed JSON, its fields (`name_for_model`, `description_for_model`, `auth`, `api.url`) are correct, and the referenced OpenAPI spec resolves. (Legacy ChatGPT-plugin manifest; note if deprecated for the site's use.)
- **JSON-LD structured data as an AI signal** — beyond Phase 4.3's presence check, assess *entity depth* for GEO: an `Organization`/`WebSite` graph with `sameAs` to authoritative profiles, `FAQPage`/`QAPage` for liftable answers, `Article` with `author` + `datePublished`/`dateModified`. Answer engines rely on this to attribute and cite. **2026 caveat:** Google is retiring FAQ **rich results** (SERP treatment ended ~May 2026; Rich Results Test / Search Console API sunset mid-2026) — still ship `FAQPage` JSON-LD for machine-readability and AI parsing, just don't expect SERP rich snippets from it.
- **`manifest.json`** (PWA) and any emerging **`/.well-known/` agent descriptors** (e.g. MCP/agent manifests) — check presence and validity as forward-looking signals.
- If the user has a **specific JSON file** in mind (a custom AI/agent manifest for their stack), audit it explicitly against its schema.

### 5.6 Answer-first content structure (highest-leverage GEO)

- **Lead with the answer.** Every page and major section should open with a **direct 40–60 word answer** to its core question (the answer-first / inverted-pyramid pattern) — the single highest-impact GEO change. Self-test: the opening paragraph of a section should summarize cleanly in one sentence.
- **Question-form H2s.** Phrase 3–5 section headings as real user questions ("How does X work?", "When should you Y?"), each followed by a short, self-contained answer block.
- **Citation-friendly formats.** Bullet lists, comparison tables, and definition blocks are lifted most; keep key facts in extractable text, not trapped in images or interactive widgets.
- **Semantic HTML & headings.** `<main>`/`<article>`/`<section>`/`<nav>`, exactly one `<h1>`, ordered `<h2>`/`<h3>`.

### 5.7 Fact density & objective phrasing

- **Statistics, citations, quotations.** Peer-reviewed GEO research (Princeton et al., 2023) measured the largest citation lifts from adding **quotations (~+41%), statistics (~+32%), and cited sources (~+30%)** — not keyword stuffing, which underperforms. Recommend ~2–3 quantified, attributed data points per 300-word section, with the most compelling stat in the **first ~200 words**. Flag thin, claim-only pages.
- **Objective, declarative tone.** Recommend removing hedging ("I think", "we believe"); lower-uncertainty ("perplexity") wording is more likely to be lifted. Content recommendation, not a code fix.

### 5.8 SSR / crawlability for AI (and cloaking)

- Most AI crawlers do **not** run JavaScript. Compare the **raw** HTML (`curl -sL` / `mcp__fetch__fetch`) against the rendered page — content that only appears after JS runs is invisible to them → **Critical** for client-rendered sites; recommend SSR/SSG/prerendering (island/partial hydration where interactivity is needed).
- **Cloaking is a Critical finding, never a recommendation.** Serving different content to AI bots (e.g. GPTBot) than to real users is a black-hat tactic; flag it if detected and never suggest it.

### 5.9 E-E-A-T, freshness & cross-web authority

- **E-E-A-T** (Experience, Expertise, Authoritativeness, Trust) applies directly to AI citation: a named author with a real bio/credentials, visible `datePublished`/`dateModified`, and inline references to primary sources. **Never fabricate** authors or credentials — fake E-E-A-T is a documented black-hat tactic.
- **Freshness (quantified).** AI engines strongly favor recent content (pages updated within ~30 days are cited materially more; unrefreshed pages lose citations over time). Recommend a **quarterly refresh** of high-value pages with updated data and a bumped `dateModified` in both content and JSON-LD.
- **Cross-web authority (advisory, off-site).** AI citation correlates with third-party corroboration (authoritative sites, community platforms, reference sources) and overall domain authority — this is off-site and cannot be fixed in the codebase, so flag it as a recommendation, not a code finding. Note platform tendencies to guide investment: ChatGPT leans encyclopedic / Bing-indexed sources; Perplexity weights freshness and community content; Google AI Overviews lean on FAQ/HowTo structure. Verify these tendencies against current data — they change.

## Phase 6: Content & On-Page

- Heading hierarchy correct (no skipped levels).
- All meaningful images have descriptive `alt`.
- Links use descriptive text (not "click here").
- Internal linking: important pages reachable; flag orphan pages (zero internal links).
- No broken internal links.

## Phase 7: Performance, Core Web Vitals, Accessibility & Best Practices

Beyond SEO, audit the remaining **Lighthouse web-quality pillars** using the **bundled `chrome-devtools` MCP** (`co-dev` ships it — no separate install; the tools are `mcp__chrome-devtools__*`). Run against the live URL; in **codebase-only** mode do the static checks below and mark the live-metric parts **N/A**.

Engine: `mcp__chrome-devtools__lighthouse_audit` for the category scores (Performance, Accessibility, Best Practices, SEO), plus `performance_start_trace` / `performance_analyze_insight` for CWV detail and `take_snapshot` for the accessibility tree. Prefer **field data** (CrUX / Search Console real-user data) over lab data for ranking-relevant CWV. Record the four Lighthouse category scores (0–100) and back each issue with evidence.

### 7.1 Core Web Vitals (2026 thresholds)

- **LCP < 2.5s** — identify the LCP element; check TTFB/server response, render-blocking CSS/JS, a `preload` for the LCP image or font, and that the LCP image is **not** lazy-loaded.
- **INP < 200ms** — the **most commonly failed** metric in 2026 (main-thread / JS bound). Check long tasks, heavy event handlers, hydration cost, and input delay. CWV is now a ranking filter, not just a tiebreaker.
- **CLS < 0.1** — images/video/ads/embeds need explicit `width`/`height` or `aspect-ratio`; check `font-display` swap shift and content injected above existing content.

### 7.2 Performance

- Render-blocking CSS/JS; unused JS/CSS (coverage); code-splitting and lazy-loading of non-critical bundles.
- Images: modern formats (AVIF/WebP), correct sizing + `srcset`, below-the-fold lazy-loading, no oversized assets.
- Text compression (gzip/brotli), long-cache headers on static assets, HTTP/2 or /3.
- Font loading (`font-display`, `preconnect` to font origins, subsetting).
- Third-party script weight and its main-thread impact; total transfer size and request count.

### 7.3 Accessibility (WCAG 2.2)

- Color contrast ≥ 4.5:1 body text / 3:1 large text and UI components.
- Meaningful `alt` on informative images (decorative → empty `alt`); every form control has a label; buttons/links have accessible names.
- Landmarks (`<main>`/`<nav>`/`<header>`), exactly one `<h1>`, ordered headings; logical focus order, visible focus states, full keyboard operability (no traps).
- Valid ARIA (correct roles/attributes, no redundant/broken ARIA); tap targets ≥ 24×24 CSS px (WCAG 2.2), ~44px comfortable.
- Honors `prefers-reduced-motion`; content reflows at 320px width and 200% zoom without loss.

### 7.4 Best practices

- HTTPS everywhere, no mixed content; no browser console errors; no deprecated or broken web APIs.
- CSP present (cross-reference Phase 4 headers); images served at their correct aspect ratio; no known-vulnerable front-end libraries.

Fold results into the report's **Performance, CWV & Accessibility** section, tagging each finding to its pillar. If the MCP is genuinely unavailable (or codebase-only mode), mark the live-metric checks **not run** and recommend Lighthouse in Chrome DevTools — **never guess CWV numbers**.

## Phase 8: Generate Report

Pre-report verification: every applicable phase task is complete and each finding has quoted evidence. Assign severity:

| Severity | Criteria |
| --- | --- |
| 🔴 Critical | Blocks indexing or AI visibility: `noindex`/robots blocking indexable pages, broken/missing sitemap, JS-only content invisible to non-JS crawlers, site returns wrong status codes |
| 🟠 High | Missing titles/descriptions/canonical, no structured data, no Open Graph, redirect chains, no llms.txt on a content-heavy site |
| 🟡 Medium | Weak/duplicate meta, thin schema coverage, heading-hierarchy issues, missing hreflang on i18n sites |
| 🔵 Low | Alt-text gaps, non-descriptive link text, minor polish |
| ⚪ Info | Observations, GEO opportunities, FYI |

Sort findings by severity (Critical → High → Medium → Low → Info), then by Area in the order the finding template lists (Technical SEO, GEO, Content, Performance, CWV, Accessibility, Best Practices), then by evidence path bytewise ascending; assign the `SEO-001…` ids only after sorting.

Write `docs/seo-audit.md` (`mkdir -p docs` first). Structure:

```markdown
# SEO & GEO Audit

**Project:** [name]
**Scan mode:** codebase | live | both
**Target:** [base_url and/or repo]
**Pages sampled:** [the page sample URLs, or N/A in codebase mode]
**Date:** [ISO-8601]

## Summary

| Severity | Count |
| --- | --- |
| 🔴 Critical | X |
| 🟠 High | X |
| 🟡 Medium | X |
| 🔵 Low | X |
| ⚪ Info | X |

## Technical SEO

[Per-check: expected / found (with file:line or URL+tag) / PASS·FAIL·MISSING]

## GEO / AI Answer-Engine

[llms.txt (spec-valid), llms-full.txt/expanded context, per-page .md, AI-crawler policy (training/search/user-fetch decisions + spelling), ai-plugin.json/JSON-LD entity depth, extractability, SSR/crawlability, entity & freshness]

## Content & On-Page

[headings, alt text, links, orphans, broken links]

## Performance, CWV & Accessibility

[Lighthouse category scores (Performance / Accessibility / Best Practices / SEO), Core Web Vitals (LCP / INP / CLS), and per-pillar findings — or "not run" + recommendation]

## Findings

### [SEO-001] SEVERITY: Title

**Area:** Technical SEO | GEO | Content | Performance | CWV | Accessibility | Best Practices (closed set — assign by originating phase: 4 → Technical SEO, 5 → GEO, 6 → Content, 7 → the pillar of its sub-section)
**Evidence:** `path/file.erb:42` or `https://…` → `<quoted tag/line>`
**Issue:** What's wrong.
**Impact:** Why it matters (ranking / indexing / AI citation).
**Fix:** Concrete change.

## Measurement Recommendations

[Ongoing tracking the audit can't do in one pass: **Share of Citation / Share of Model** — pick 10–20 buyer-intent queries, ask ChatGPT / Perplexity / Gemini / Copilot monthly, and record whether/how the brand is cited. Add Bing Webmaster + AI-referral tracking alongside Google Search Console.]

## Positive Observations

[What's already done well.]
```

Then ask before changing anything: "I found the issues above. Want me to apply the fixes?"

## Phase 9: Apply Fixes (on approval)

Only after approval, and only for findings the user accepts. Make source changes in the right place for the detected stack (layout/head partial for meta/OG, a sitemap generator or `public/sitemap.xml`, `public/robots.txt`, a new `public/llms.txt`, JSON-LD partial, `alt`/heading fixes in templates). Prefer template/layout-level fixes over per-page duplication. Never invent facts for meta/schema — derive from real page content. Re-run the relevant check to confirm each fix.

## Phase 10: Run Linters

If any files changed, run `/co-dev:run-linters` and fix any errors (including markdownlint on `docs/seo-audit.md`).

## Validation Checklist

- [ ] Scan mode and target recorded; live URL confirmed before fetching
- [ ] Exemption check run (authed-only/API/library correctly skipped)
- [ ] Every finding has quoted evidence (`file:line` or URL + tag)
- [ ] Titles, descriptions, canonical, viewport, `lang` checked
- [ ] Open Graph / Twitter cards checked
- [ ] JSON-LD structured data checked and validated
- [ ] sitemap.xml and robots.txt checked (and cross-referenced)
- [ ] Status codes / redirects / HTTPS / hreflang checked (live mode)
- [ ] Technical: mobile-first content/link parity, tap targets, no intrusive interstitials checked
- [ ] Technical: IndexNow + Bing Webmaster indexing checked (feeds ChatGPT retrieval)
- [ ] GEO: llms.txt (spec-valid) + llms-full.txt/expanded-context + per-page `.md` checked
- [ ] GEO: AI-crawler policy audited by category (training / search / user-fetch), exact spelling verified, voluntary-compliance + WAF caveat noted
- [ ] GEO: ai-plugin.json (if any) + JSON-LD entity depth + FAQ-rich-results 2026 caveat + any custom AI/agent JSON manifest checked
- [ ] GEO: answer-first 40–60 word blocks + question-form H2s checked
- [ ] GEO: statistic/citation/quotation density + objective phrasing checked
- [ ] GEO: E-E-A-T (author/bio/dates/references) + quantified freshness (quarterly/`dateModified`) + cross-web authority (advisory) checked
- [ ] GEO: cloaking ruled out; no fabricated E-E-A-T
- [ ] GEO: extractability + SSR/crawlability checked
- [ ] Performance: field data (CrUX/Search Console) preferred; INP checked specifically
- [ ] Headings, alt text, link text, orphans, broken links checked
- [ ] Web quality via bundled chrome-devtools MCP: performance, CWV (LCP·INP·CLS), accessibility (WCAG), best-practices audited — or marked not-run
- [ ] Page sample listed in the report header; findings sorted before `SEO-00N` ids assigned
- [ ] `docs/seo-audit.md` written; approval requested before fixes

## Important Rules

1. **Never fabricate.** Meta descriptions, titles, and schema must come from real page content — never invent claims.
2. **Confirm the environment** before hitting a live URL; production is the usual target but say so.
3. **Reconcile in "both" mode** — a tag present in source but absent in served HTML is a real finding (build/render drift).
4. **Audit web quality via the bundled `chrome-devtools` MCP** — run `lighthouse_audit` + performance traces + the a11y snapshot for performance / CWV / accessibility / best-practices (Phase 7); mark not-run rather than guessing numbers.
5. **Fix at the source** — layout/partials over per-page copies; a sitemap generator over a hand-maintained file when the stack supports it.
6. **Respect deliberate choices** — an intentional `noindex` (staging, thin pages) or a deliberate AI-crawler block is a decision to confirm, not auto-"fix".
7. **Verify standards, don't trust memory** — llms.txt conventions and schema types evolve; confirm with WebSearch/official docs rather than training data.
8. **Ask before modifying.** Show findings; get approval; then apply.
9. **GEO is first-class** — do not skip Phase 5; AI-answer visibility is a primary goal, not an afterthought.
10. **No black-hat GEO.** Cloaking (serving AI crawlers different content than users) is a Critical finding; never fabricate authors, credentials, or any E-E-A-T signal.
11. **Verify the fast-moving landscape** — engine↔index mappings (e.g. ChatGPT↔Bing), AI-crawler names, llms.txt conventions, and schema/rich-result support change monthly; confirm against current vendor/official docs before asserting or fixing.
