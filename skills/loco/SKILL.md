---
name: loco
description: Manage Loco (localise.biz) translation assets. Use when the user wants to create a translation key, delete a translation key, translate text, manage localization, add a Loco asset, remove unused translations, scan for unused tokens, or manage i18n keys. Supports create, delete, and scan commands with multi-project support and auto-translation.
allowed-tools: Bash(curl:*), Bash(env:*), Bash(awk:*), Bash(basename:*), Bash(cat:*), Bash(cut:*), Bash(comm:*), Bash(date:*), Bash(diff:*), Bash(dirname:*), Bash(echo:*), Bash(find:*), Bash(grep:*), Bash(head:*), Bash(jq:*), Bash(ls:*), Bash(sed:*), Bash(sort:*), Bash(tail:*), Bash(tee:*), Bash(tr:*), Bash(uniq:*), Bash(wc:*), Bash(which:*), Bash(xargs:*), Read, Glob, Grep
---

## Purpose

Manage translation assets on Loco (localise.biz) from the CLI. Supports three commands:

- **create** — Create a new translation key, auto-translate to all project locales, and tag for review
- **delete** — Delete an existing translation key after confirmation
- **scan** — Scan the codebase for unused translation keys

## Environment Variables

This skill uses Loco API keys set as environment variables. The naming convention supports multiple projects:

- `LOCO_API_KEY_<PROJECT>` — Per-project key (e.g., `LOCO_API_KEY_IOS`, `LOCO_API_KEY_ANDROID`, `LOCO_API_KEY_WEB`)
- `LOCO_API_KEY` — Single-project fallback when only one project exists

## API Reference

All API calls use the `Authorization` header. **Never pass the API key as a query parameter.**

### Authentication Header

```text
Authorization: Loco $LOCO_API_KEY
```

Every example below writes `$LOCO_API_KEY`. If Step 1 resolved a per-project variable, substitute that name (e.g. `$LOCO_API_KEY_IOS`) everywhere `$LOCO_API_KEY` appears. Always reference the environment variable itself: each command runs in a fresh shell, so a variable assigned by an earlier command is empty in the next one.

### Verify Credentials

```bash
curl -s -f -H "Authorization: Loco $LOCO_API_KEY" https://localise.biz/api/auth/verify
```

### List All Assets

```bash
curl -s -f -H "Authorization: Loco $LOCO_API_KEY" https://localise.biz/api/assets
```

### Get Single Asset

```bash
curl -s -f -H "Authorization: Loco $LOCO_API_KEY" "https://localise.biz/api/assets/$ASSET_ID"
```

### Create Asset

```bash
curl -s -f -X POST -H "Authorization: Loco $LOCO_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "id=$KEY&text=$TEXT&type=text&context=$CONTEXT" \
  https://localise.biz/api/assets
```

### Delete Asset

```bash
curl -s -f -X DELETE -H "Authorization: Loco $LOCO_API_KEY" \
  "https://localise.biz/api/assets/$ASSET_ID"
```

### Set Translation for a Locale

```bash
curl -s -f -X POST -H "Authorization: Loco $LOCO_API_KEY" \
  -H "Content-Type: text/plain" \
  --data-raw "$TRANSLATION_TEXT" \
  "https://localise.biz/api/translations/$ASSET_ID/$LOCALE"
```

### Tag an Asset

```bash
curl -s -f -X POST -H "Authorization: Loco $LOCO_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=$TAG_NAME" \
  "https://localise.biz/api/assets/$ASSET_ID/tags"
```

### List Project Locales

```bash
curl -s -f -H "Authorization: Loco $LOCO_API_KEY" https://localise.biz/api/locales
```

## Steps

### Step 1: Detect Project

Detect which Loco project(s) are configured by scanning environment variables.

```bash
env | grep -o '^LOCO_API_KEY[^=]*'
```

> Use `grep -o` to print **only the variable names**, never the values. The keys themselves must never appear in transcripts or logs.

**If no variables found:**

- Tell the user: "No Loco API key found. Set `LOCO_API_KEY` (single project) or `LOCO_API_KEY_<PROJECT>` (multi-project) as an environment variable. You can find your API key at <https://localise.biz> under Project > API Keys."
- Stop here.

**If exactly one variable found:**

- Use that key. Extract the project name from the variable suffix (e.g., `LOCO_API_KEY_IOS` → project "IOS"), or "default" if using `LOCO_API_KEY`.

**If multiple variables found:**

- List the available projects and ask the user which one to use.
- If the user specified a project in their command (e.g., `/loco create --project ios "key" "text"`), use that directly.

**Verify the key works:**

```bash
curl -s -f -H "Authorization: Loco $LOCO_API_KEY" https://localise.biz/api/auth/verify
```

If verification fails, tell the user the API key is invalid and stop.

**Important:** Record the resolved *variable name* (e.g. `LOCO_API_KEY_IOS`) and substitute it for `$LOCO_API_KEY` in every subsequent command. Do not assign the key to a shell variable — shell state does not survive between commands. Never echo or log the key value; expanding it inside a `-H` argument does not print it.

---

### Command: Create

Use this flow when the user wants to create a new translation key.

#### Step 2: Parse Arguments

Extract from the user's request:

- **KEY** (required) — The translation key identifier (e.g., `settings.notifications.title`)
- **TEXT** (required) — The English source text (e.g., `"Notification Settings"`)
- **--context** (optional) — Context hint for translators (e.g., `"Title of the notifications settings page"`)
- **--tags** (optional) — Comma-separated tags to apply (e.g., `"settings,v2.1"`)
- **--no-translate** (optional) — Skip auto-translation, only create the asset with English text

#### Step 3: Validate Key Does Not Exist

Fetch existing assets and check if the key already exists. Capture the HTTP status separately so we can distinguish "not found" (good — we can create) from a real error:

```bash
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Loco $LOCO_API_KEY" \
  "https://localise.biz/api/assets/$(echo -n "$KEY" | jq -sRr @uri)")
```

- `STATUS == 200` → key already exists. Tell the user: "Key `$KEY` already exists. Use a different key or delete the existing one first." Stop.
- `STATUS == 404` → key does not exist; proceed to Step 4.
- Anything else (401/403/5xx/000) → real error. Show the status to the user and stop.

Do **not** use `curl -f` here — `-f` collapses 404 into a generic non-zero exit and hides the case we actually want to detect.

#### Step 4: Analyze Naming Conventions

Fetch a sample of existing keys to detect the project's naming patterns:

```bash
curl -s -f -H "Authorization: Loco $LOCO_API_KEY" https://localise.biz/api/assets | jq -r '.[0:50] | .[].id'
```

Analyze the sample for:

- **Separator**: dots (`settings.title`), underscores (`settings_title`), or camelCase (`settingsTitle`)
- **Hierarchy depth**: flat (`login_button`) vs nested (`auth.login.button`)
- **Prefix patterns**: common prefixes like `screen.`, `feature.`, `error.`
- **Casing**: lowercase, UPPER_CASE, Title_Case

If the proposed KEY deviates from detected conventions, warn the user. For example:

> "Existing keys use dot-separated lowercase (e.g., `settings.notifications.enabled`). Your key `Settings_Notifications_Title` doesn't match. Suggested: `settings.notifications.title`. Proceed anyway?"

If the user confirms or the key matches conventions, continue.

#### Step 5: Create the Asset

```bash
curl -s -f -X POST -H "Authorization: Loco $LOCO_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "id=$KEY" \
  --data-urlencode "text=$TEXT" \
  -d "type=text" \
  --data-urlencode "context=$CONTEXT" \
  https://localise.biz/api/assets
```

If the creation fails, report the error and stop.

#### Step 6: Set English Translation

```bash
curl -s -f -X POST -H "Authorization: Loco $LOCO_API_KEY" \
  -H "Content-Type: text/plain" \
  --data-raw "$TEXT" \
  "https://localise.biz/api/translations/$(echo -n "$KEY" | jq -sRr @uri)/en"
```

#### Step 7: Auto-Translate to All Locales

**If `--no-translate` was specified, skip this step.**

Fetch all project locales:

```bash
curl -s -f -H "Authorization: Loco $LOCO_API_KEY" https://localise.biz/api/locales | jq -r '.[].code'
```

Filter out English locales (any starting with `en`).

For each remaining locale:

1. **Translate** the English text using Claude. Provide the locale code, source text, any context, and placeholder preservation rules (see Placeholder Preservation Rules below).

2. **Validate placeholders** — Extract all placeholders from the source text and verify they appear identically in the translation. If validation fails, skip this locale and include it in the error report.

3. **Push the translation:**

```bash
curl -s -f -X POST -H "Authorization: Loco $LOCO_API_KEY" \
  -H "Content-Type: text/plain" \
  --data-raw "$TRANSLATED_TEXT" \
  "https://localise.biz/api/translations/$(echo -n "$KEY" | jq -sRr @uri)/$LOCALE"
```

#### Step 8: Tag the Asset

Always tag with `needs-review`:

```bash
curl -s -f -X POST -H "Authorization: Loco $LOCO_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=needs-review" \
  "https://localise.biz/api/assets/$(echo -n "$KEY" | jq -sRr @uri)/tags"
```

If `--tags` was provided, also apply each custom tag:

```bash
curl -s -f -X POST -H "Authorization: Loco $LOCO_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=$TAG" \
  "https://localise.biz/api/assets/$(echo -n "$KEY" | jq -sRr @uri)/tags"
```

#### Step 9: Report Summary

Display a summary table:

```text
Key:       settings.notifications.title
Text:      Notification Settings
Project:   IOS

Translations:
| Locale | Translation              | Status |
|--------|--------------------------|--------|
| en     | Notification Settings    | Set    |
| fr     | Paramètres de notification | Auto   |
| de     | Benachrichtigungseinstellungen | Auto |
| es     | Configuración de notificaciones | Auto |
| ja     | 通知設定                   | Auto   |

Tags: needs-review, settings
```

If any locales failed placeholder validation, include a warnings section:

```text
Warnings:
- ar: Skipped — placeholder mismatch (expected %d, got none)
```

---

### Command: Delete

Use this flow when the user wants to delete a translation key.

#### Step 2: Find the Asset

Capture the body and the HTTP status together — the status is the last line of the output:

```bash
curl -s -w '\n%{http_code}' -H "Authorization: Loco $LOCO_API_KEY" "https://localise.biz/api/assets/$(echo -n "$KEY" | jq -sRr @uri)"
```

- `200` → asset found; proceed to Step 3 with the body.
- `404` → tell the user: "Key `$KEY` not found." and stop.
- Anything else (401/403/5xx/000) → real error. Show the status to the user and stop.

Do **not** use `curl -f` here — `-f` collapses 404 into a generic non-zero exit and hides the case we actually want to detect.

#### Step 3: Show Details

Display the asset details to the user:

- Key ID
- Source text
- Number of translations
- Tags

#### Step 4: Confirm Deletion

**This confirmation is mandatory. Never skip it.**

Ask the user: "Are you sure you want to delete `$KEY`? This will remove the asset and all its translations. This cannot be undone."

If the user does not confirm, stop here.

#### Step 5: Delete and Report

```bash
curl -s -f -X DELETE -H "Authorization: Loco $LOCO_API_KEY" \
  "https://localise.biz/api/assets/$(echo -n "$KEY" | jq -sRr @uri)"
```

Report: "Deleted `$KEY` and all its translations."

If the deletion fails, report the error.

---

### Command: Scan

Use this flow when the user wants to find unused translation keys in the codebase.

#### Step 2: Fetch All Asset Keys

```bash
curl -s -f -H "Authorization: Loco $LOCO_API_KEY" https://localise.biz/api/assets | jq -r '.[].id' | sort -u | tee /tmp/loco-keys.txt
```

Write the full list to a file — later commands run in a fresh shell and cannot read it from a variable.

#### Step 3: Detect Platform(s)

Auto-detect which platforms exist in the repository by checking for indicator files:

| Platform    | Indicator Files                                                               |
|-------------|-------------------------------------------------------------------------------|
| iOS/macOS   | `*.xcodeproj`, `*.xcworkspace`, `Package.swift`, `*.strings`, `*.stringsdict` |
| Android     | `AndroidManifest.xml`, `build.gradle`, `build.gradle.kts`, `strings.xml`      |
| Rails       | `Gemfile` with `rails`, `config/locales/`, `*.yml` locale files               |
| Web (JS/TS) | `package.json`, `i18n/`, `locales/`, `*.vue`, `*.tsx`, `*.jsx`                |
| Flutter     | `pubspec.yaml`, `*.dart`, `*.arb`                                             |
| .NET        | `*.csproj`, `*.resx`                                                          |
| Go          | `go.mod`                                                                      |
| Python      | `requirements.txt`, `pyproject.toml`, `django`, `gettext`                     |

#### Step 4: Search Codebase for Key Usage

For each detected platform, search the codebase using platform-appropriate patterns:

**iOS/macOS:**

```text
NSLocalizedString("KEY"
String(localized: "KEY"
"KEY" = "  (in .strings files)
```

**Android:**

```text
R.string.KEY
@string/KEY
<string name="KEY"
```

**Rails:**

```text
I18n.t("KEY"
I18n.t('KEY'
t("KEY"
t('KEY'
t(:KEY
```

**Web (JS/TS/Vue):**

```text
$t("KEY"
$t('KEY'
t("KEY"
t('KEY'
i18n.t("KEY"
i18n.t('KEY'
```

**Flutter:**

```text
AppLocalizations.of(context).KEY
"KEY" (in .arb files)
```

**Efficient batch approach:**

1. Search the codebase for every key in `/tmp/loco-keys.txt`.
2. Collect the set of keys that were found.
3. Compute the difference: keys in Loco but not found in code = potentially unused.

For small key sets (<100 keys), use the Grep tool once per key. For larger sets, one batch pass emits the matched keys directly — `-o` prints each matching key, `-h` suppresses the filename prefix:

```bash
grep -F -o -h -r -f /tmp/loco-keys.txt --include="*.swift" --include="*.m" --include="*.strings" --include="*.xml" --include="*.rb" --include="*.yml" --include="*.js" --include="*.ts" --include="*.vue" --include="*.jsx" --include="*.tsx" --include="*.dart" --include="*.arb" --include="*.resx" --include="*.go" --include="*.py" . | sort -u > /tmp/loco-found.txt
```

The unused keys are then the keys present in Loco but absent from the matched set:

```bash
comm -23 /tmp/loco-keys.txt /tmp/loco-found.txt
```

#### Step 5: Report Results

Display a summary:

```text
Loco Scan Report
================
Project:      IOS
Total assets: 342
Referenced:   318
Unused:       24

Potentially Unused Keys:
| # | Key                           | Source Text              |
|---|-------------------------------|--------------------------|
| 1 | legacy.old_feature.title      | Old Feature              |
| 2 | deprecated.screen.description | This screen is deprecated|
| ...                                                         |

Caveats:
- Dynamic keys (e.g., `t("error.#{code}")`) cannot be detected by static analysis.
- Keys used in configuration files, backend templates, or external services may not appear in the codebase.
- Review this list manually before deleting any keys.
```

---

## Placeholder Preservation Rules

When translating text, all placeholders must be preserved exactly as they appear in the source. The following placeholder formats must be detected and validated:

### Apple (iOS/macOS)

- `%@` — Object (string)
- `%d` — Integer
- `%f` — Float
- `%ld`, `%lld` — Long/long long
- `%1$@`, `%2$d` — Positional arguments

### Ruby / Rails

- `%{name}` — Named interpolation
- `%<name>s` — Formatted named interpolation

### Android

- `%1$s`, `%2$d` — Positional arguments
- `%s`, `%d` — Sequential arguments

### ICU Message Format

- `{name}` — Simple replacement
- `{count, plural, one {# item} other {# items}}` — Plural rules
- `{gender, select, male {He} female {She} other {They}}` — Select rules

### HTML

- HTML tags (`<b>`, `<a href="...">`, `<br/>`, etc.) — preserve exactly

### Validation

After generating a translation, extract all placeholders from both source and translation using regex patterns:

- Apple: `%(\d+\$)?[@ dfsld]+` and `%%` (escaped percent)
- Ruby: `%\{[^}]+\}` and `%<[^>]+>[sdfi]`
- Android: `%(\d+\$)?[sd]`
- ICU: `\{[^}]+\}`
- HTML: `<[^>]+>`

Compare the sets. If any placeholder is missing or added in the translation, the validation fails. Skip that locale and report it.

## Safety Guardrails

1. **Always confirm before delete** — Never delete an asset without explicit user confirmation.
2. **Never echo API key values** — Reference the environment variable in commands but never print its value. If debugging, show `LOCO_API_KEY_*** is set` instead.
3. **Always use Authorization header** — Never pass the API key as a query parameter (`?key=...`). Always use `Authorization: Loco $LOCO_API_KEY`.
4. **Tag all auto-translations** — Every asset with auto-translated text gets the `needs-review` tag.
5. **Skip on placeholder failure** — If placeholder validation fails for a locale, skip it and report the failure rather than pushing a broken translation.

## Rules

1. **English is always the source language.** All translations are generated from the English text. Never translate from a non-English locale.
2. **Locales are dynamic.** Always fetch the project's locales from the API. Never hardcode a locale list.
3. **Preserve all placeholders exactly.** Placeholders must appear identically in every translation. See Placeholder Preservation Rules.
4. **Always confirm before destructive actions.** Delete operations require explicit user confirmation. This is not optional.
5. **Analyze naming conventions before creating.** Fetch existing keys, detect patterns, and warn if the proposed key deviates.
6. **Tag every auto-translated asset.** Apply `needs-review` to all assets that receive auto-translations.
7. **Support multi-project setups.** Check for multiple `LOCO_API_KEY_*` variables and prompt the user to select one if needed.
8. **URL-encode asset IDs in API paths.** Keys containing dots, slashes, or special characters must be URL-encoded in API URLs.
9. **Scan caveats are mandatory.** Always include the caveats section in scan reports. Dynamic keys, backend-only keys, and config-file keys cannot be detected by static analysis.
10. **Never expose secrets.** Do not echo, log, or display API key values in output or error messages.
