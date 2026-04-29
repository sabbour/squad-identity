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

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-04-28T17:43:51.758-07:00 — npm publication verified

Published `@sabbour/squad-identity@1.0.0` to npm registry successfully. Tested fresh global install from registry (not local files): `npm install -g @sabbour/squad-identity` works, `squad-identity --help` displays CLI usage, `squad-identity status` returns exit code 1 as expected (no config found). Package size: 1 package, tarball via npm.pkg.github.com, published 2 minutes before test. CLI bin entry resolves correctly from global installation context.

### 2026-04-28T14:01:29.939-07:00 — npm CLI package shape

Implemented the package as a zero-dependency Node ESM CLI with `bin/squad-identity.mjs` resolving its package root from `import.meta.url` via `fileURLToPath()` and `dirname()`, so global and `npx` executions do not depend on CWD. The CLI mirrors Squad shape with `init`, `upgrade`, `doctor`, and `status`; `init`/`upgrade` sync extension files into `.github/extensions/squad-identity/`, the skill into `.squad/skills/squad-identity/`, and identity templates under `.squad/identity/` without overwriting existing config. `postinstall` detects global installs with `npm_config_global === 'true'`, skips CI via `CI === 'true'`, and syncs the extension into `~/.copilot/extensions/squad-identity/` only for global installs.
