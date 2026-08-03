---
name: review-design
description: Review, compare, audit, or check UI code against Figma designs. Use when the user wants to compare code to a Figma design, check design implementation, audit UI fidelity, verify design compliance, or review design-to-code accuracy. Supports Android (Jetpack Compose, XML layouts), iOS (SwiftUI, UIKit), and web (HTML/CSS, React, Vue, Angular) platforms.
allowed-tools: Bash(git:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*), Read, Glob, Grep, Skill, mcp__figma__get_design_context, mcp__figma__get_screenshot, mcp__figma__search_design_system, mcp__figma__get_metadata, mcp__figma__get_variable_defs, mcp__figma__get_code_connect_map, mcp__figma__get_code_connect_suggestions
---

# Review Design Implementation

Compare UI code against Figma designs to identify discrepancies in layout, styling, spacing, typography, colors, and component usage. Works for Android, iOS, and web platforms.

## MCP Tools with Fallbacks

This skill requires the Figma MCP server for design context. If Figma MCP is unavailable (not authenticated, tool not found), inform the user and stop — this skill cannot function without Figma access.

| Operation | MCP Tool |
| --- | --- |
| Get design context (layout, styles) | `mcp__figma__get_design_context` |
| Get visual screenshot | `mcp__figma__get_screenshot` |
| Get design system components | `mcp__figma__search_design_system` |
| Get design metadata | `mcp__figma__get_metadata` |
| Get variables and styles | `mcp__figma__get_variable_defs` |
| Get code-to-component mappings | `mcp__figma__get_code_connect_map` |
| Get component mapping suggestions | `mcp__figma__get_code_connect_suggestions` |

## Step 1: Gather Inputs

The user must provide:

1. **Figma URL** — a link to the design (frame, component, or page)
2. **Platform** (optional) — `android`, `ios`, or `web`. If not specified, auto-detect from the project.

### Auto-detect Platform

```bash
# Check for platform indicators
ls -la build.gradle build.gradle.kts app/build.gradle app/build.gradle.kts 2>/dev/null && echo "ANDROID"
ls -la *.xcodeproj *.xcworkspace Package.swift 2>/dev/null && echo "IOS"
ls -la package.json tsconfig.json angular.json next.config.* nuxt.config.* vite.config.* webpack.config.* 2>/dev/null && echo "WEB"
```

If multiple platforms are detected (monorepo), ask the user which platform to review.

## Step 2: Extract Design Context

1. **Get screenshot** — Use `mcp__figma__get_screenshot` to capture a visual reference of the target design
2. **Get design context** — Use `mcp__figma__get_design_context` to extract:
   - Layout structure (frames, groups, auto-layout)
   - Spacing (padding, gaps, margins)
   - Colors (fills, strokes, effects)
   - Typography (font family, size, weight, line height, letter spacing)
   - Corner radii
   - Sizing (width, height, constraints)
3. **Get variables** — Use `mcp__figma__get_variable_defs` to extract design tokens (color variables, spacing scales, typography tokens)
4. **Search design system** — Use `mcp__figma__search_design_system` to identify which design system components are used

Record all extracted values for comparison.

## Step 3: Identify Corresponding Code

Based on the platform, locate the UI code that implements the design:

### Android (Jetpack Compose)

Search for composable functions and XML layouts:

```bash
# Find Compose files
find . -name "*.kt" -path "*/ui/*" -o -name "*.kt" -path "*/compose/*" -o -name "*.kt" -path "*/screen/*" -o -name "*.kt" -path "*/component/*" | head -50
# Find XML layouts
find . -name "*.xml" -path "*/layout/*" | head -50
# Find theme/style files
find . -name "Theme.kt" -o -name "Color.kt" -o -name "Type.kt" -o -name "*.xml" -path "*/values/colors*" -o -name "*.xml" -path "*/values/dimens*" -o -name "*.xml" -path "*/values/styles*" | head -20
```

### iOS (SwiftUI / UIKit)

Search for view files:

```bash
# Find SwiftUI views
find . -name "*.swift" -path "*/View*" -o -name "*.swift" -path "*/Screen*" -o -name "*.swift" -path "*/UI/*" | head -50
# Find storyboards and XIBs
find . -name "*.storyboard" -o -name "*.xib" | head -20
# Find asset catalogs and style definitions
find . -name "*.xcassets" -o -name "Colors.swift" -o -name "Typography.swift" -o -name "Theme.swift" | head -20
```

### Web (HTML/CSS/React/Vue/Angular)

Search for component and style files:

```bash
# Find component files
find . -name "*.tsx" -o -name "*.jsx" -o -name "*.vue" -o -name "*.svelte" -path "*/components/*" -o -path "*/pages/*" -o -path "*/views/*" | head -50
# Find style files
find . -name "*.css" -o -name "*.scss" -o -name "*.less" -o -name "*.styled.*" -o -name "tailwind.config.*" | head -30
# Find design token files
find . -name "tokens.*" -o -name "theme.*" -o -name "variables.*" -path "*/styles/*" -o -path "*/design/*" | head -20
```

Ask the user to confirm which files correspond to the design if the mapping is not obvious.

## Step 4: Compare Design vs Code

For each aspect below, compare the Figma design values against the code implementation. Record findings as MATCH, MISMATCH, or MISSING.

### 4.1 Layout Structure

- **Figma:** Frame hierarchy, auto-layout direction (horizontal/vertical), alignment
- **Code:** Component hierarchy, flex/stack direction, alignment properties
- Check: Does the component tree match the frame structure?

### 4.2 Spacing

- **Figma:** Padding (top, right, bottom, left), item spacing (gap), margins
- **Code:** Padding, margin, gap values
- Check: Do values match? Account for platform-specific units:
  - Android: `dp` (Figma px ≈ dp at 1x)
  - iOS: `points` (Figma px ≈ points at 1x)
  - Web: `px`, `rem`, `em` (check if using a spacing scale)

### 4.3 Colors

- **Figma:** Fill colors, stroke colors, opacity, gradients
- **Code:** Background colors, border colors, text colors, opacity
- Check: Do hex/rgba values match? Are design tokens used consistently?

### 4.4 Typography

- **Figma:** Font family, font size, font weight, line height, letter spacing, text alignment
- **Code:** Font properties in styles/theme
- Check: Do all typography properties match?

### 4.5 Corner Radius

- **Figma:** Border radius per corner
- **Code:** Border radius values
- Check: Do values match, including per-corner overrides?

### 4.6 Sizing

- **Figma:** Fixed width/height, fill container, hug contents, min/max constraints
- **Code:** Width/height, flex-grow, intrinsic sizing, constraints
- Check: Does sizing behavior match? (fixed vs flexible)

### 4.7 Component Usage

- **Figma:** Design system components used (buttons, inputs, cards, etc.)
- **Code:** UI components/widgets used
- Check: Are the correct design system components used in code? Are custom implementations used where a standard component exists?

### 4.8 Responsive Behavior

- **Figma:** Constraints, auto-layout resizing behavior
- **Code:** Responsive styles, breakpoints, flex behavior
- Check: Does the code handle different screen sizes as the design intends?

## Step 5: Generate Report

```text
## Design Review Report

### Design
- **Figma URL:** {url}
- **Platform:** {android/ios/web}
- **Files reviewed:** {list of code files}

### Design System
- **Tokens used:** {list of design tokens found in Figma}
- **Components used:** {list of design system components}

### Findings

| # | Aspect | Status | Figma Value | Code Value | File:Line | Severity |
|---|--------|--------|-------------|------------|-----------|----------|
| 1 | {aspect} | MATCH/MISMATCH/MISSING | {value} | {value} | {file:line} | {LOW/MEDIUM/HIGH} |

### Severity Guide
- **HIGH** — Visually noticeable difference (wrong color, missing component, broken layout)
- **MEDIUM** — Subtle difference (off by a few pixels, wrong font weight, missing hover state)
- **LOW** — Minor inconsistency (spacing off by 1-2px, slightly different corner radius)

### Summary
- **Total checks:** {count}
- **Matches:** {count}
- **Mismatches:** {count}
- **Missing:** {count}
- **Fidelity score:** {matches / total * 100}%

### Recommended Fixes
{For each MISMATCH/MISSING with HIGH or MEDIUM severity, provide the specific code change needed}
```

**Ask the user before making changes:**

> "I found {N} discrepancies between the design and code. Would you like me to fix them?"

## Step 6: Apply Fixes (if user approves)

Apply fixes in order of severity (HIGH first). For each fix:

1. Make the code change
2. Note which design value was applied

After all fixes, run the linters skill:

```text
/co-dev:run-linters
```

## Important Rules

1. **Never guess design values** — Only compare against values extracted from Figma MCP tools
2. **Account for platform conventions** — Android uses dp, iOS uses points, web uses px/rem. 1 Figma px = 1 dp = 1 point = 1 CSS px at 1x density
3. **Respect design tokens** — If the project uses a design system/token file, flag values that should use a token but are hardcoded
4. **Check both directions** — Flag code that doesn't match design AND design system components that exist but aren't used
5. **Ask before modifying** — Always show the report and get user approval before changing code
6. **Run linters after changes** — Always run `/co-dev:run-linters` after modifying code
7. **Figma MCP is required** — If Figma tools are unavailable, inform the user and stop. This skill cannot function without Figma access.
