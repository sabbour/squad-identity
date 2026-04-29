# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** squad-identity — GitHub App bot-identity governance for Squad agents. Ensures every agent-authored GitHub write uses the correct `{app-slug}[bot]` identity rather than the human operator's token.
- **Stack:** Node.js ESM (`.mjs`), built-ins only (`node:crypto`, `node:fs`, `node:path`, `node:child_process`, `fetch`). No npm dependencies. GitHub Apps API + JWT. `gh` CLI for auth-bearing operations.
- **My surface area:**
  - `extensions/squad-identity/lib/configure-identity.mjs` — `--status`, `--doctor`, `--update-charters`, `--update-copilot-instructions`
  - `extensions/squad-identity/lib/resolve-token.mjs` — JWT mint → installation access token
  - `extensions/squad-identity/lib/post-flight-check.mjs` — synchronous actor verification (Trinity owns the policy)
  - `extensions/squad-identity/lib/create-app.mjs` — interactive GitHub App creation (browser OAuth)
  - `extensions/squad-identity/lib/install-apps.mjs` — install Apps into org/repo
  - `extensions/squad-identity/lib/sync-secrets.mjs` — upload PEM keys + app metadata as repo Actions secrets
  - `extensions/squad-identity/extension.mjs` — Copilot CLI extension; registers tools and syncs lib → `.squad/scripts/`
  - `install.sh` — copies extension + skill + identity template into a target Squad repo
- **Conventions:**
  - Zero npm deps. Imports use `node:`-prefix exclusively.
  - Tokens captured with `$(...)`, used inline (`GH_TOKEN="$TOKEN" gh ...`), never `export`ed, never logged.
  - `GH_CONFIG_DIR` is PID-suffixed (`$$`) per session so concurrent sessions don't share `gh` state.
  - Scripts are idempotent — `--update-charters` can run repeatedly safely.
- **Created:** 2026-04-28

### 2026-04-29T13:18:54.453-07:00 — find-app command added

Added `squad-identity find-app --name <name> [--org <org>] [--role <role>] [--pem <path>]` command.

Lib: `extensions/squad-identity/lib/find-app.mjs`. CLI dispatch in `bin/squad-identity.mjs` delegates to the lib via `spawnSync` (same pattern as `create-app` and `configure-identity`).

Search order: (1) `gh api /apps/{slug}` public lookup, (2) `gh api /user/installations --paginate`, (3) `gh api /orgs/{org}/installations` if `--org` provided. On match, opens browser to `https://github.com/apps/{slug}/installations/new`, prompts for installation ID, saves `.squad/identity/apps/{role}.json`, optionally imports PEM via existing `create-app.mjs --import-key` path. Browser open uses the same cross-platform helper (WSL → `cmd.exe /c start`, macOS → `open`, Linux → `xdg-open`) from `install-apps.mjs`.


### 2026-04-28T17:43:51.758-07:00 — npm publication verified

Published `@sabbour/squad-identity@1.0.0` to npm registry successfully. Tested fresh global install from registry (not local files): `npm install -g @sabbour/squad-identity` works, `squad-identity --help` displays CLI usage, `squad-identity status` returns exit code 1 as expected (no config found). Package size: 1 package, tarball via npm.pkg.github.com, published 2 minutes before test. CLI bin entry resolves correctly from global installation context.

### 2026-04-28T14:01:29.939-07:00 — npm CLI package shape

Implemented the package as a zero-dependency Node ESM CLI with `bin/squad-identity.mjs` resolving its package root from `import.meta.url` via `fileURLToPath()` and `dirname()`, so global and `npx` executions do not depend on CWD. The CLI mirrors Squad shape with `init`, `upgrade`, `doctor`, and `status`; `init`/`upgrade` sync extension files into `.github/extensions/squad-identity/`, the skill into `.squad/skills/squad-identity/`, and identity templates under `.squad/identity/` without overwriting existing config. `postinstall` detects global installs with `npm_config_global === 'true'`, skips CI via `CI === 'true'`, and syncs the extension into `~/.copilot/extensions/squad-identity/` only for global installs.

## Learnings

### 2026-04-29T13:44:24-07:00 — changesets + CI/CD release pipeline

Set up `@changesets/cli` for automated version management and npm publishing. Key files added:
- `.changeset/config.json` — configured for single public-scoped package, commit: false, access: public
- `.github/workflows/release.yml` — on push to main, runs tests then `changesets/action@v1` which either opens a "Version Packages" PR or publishes to npm (needs `NPM_TOKEN` secret)
- `.github/workflows/ci.yml` — matrix test on Node 18/20/22 for all pushes and PRs to main
- Added `changeset`, `version`, `release` npm scripts

Workflow: contributors add changesets via `npx changeset` describing their change. On merge to main, the action opens a PR that bumps version + CHANGELOG. Merging that PR triggers publish.

### 2026-04-29T13:51:55-07:00 — 2-channel release strategy (insider/stable)

Configured a dual-channel release pipeline using changesets pre-release mode:
- `.changeset/pre.json` — enables pre-release tagging on the `insider` branch (tag: `insider`)
- `.github/workflows/release.yml` — triggers on both `main` and `insider`; uses conditional steps to publish `@latest` from main and `@insider` from insider
- `.github/workflows/ci.yml` — PR triggers now include `insider` branch
- `README.md` — added "Install channels" table documenting stable vs insider install commands

The insider branch uses changesets' built-in pre-release mode: when `pre.json` exists, `changeset version` appends `-insider.N` suffixes to versions. The `changesets/action` automatically publishes with the correct dist-tag because pre-release packages get their tag from the pre.json config.
