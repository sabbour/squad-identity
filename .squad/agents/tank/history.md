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

### 2026-04-29T20:04:47-07:00 — granular doctor per-role health

Upgraded `extensions/squad-identity/lib/configure-identity.mjs --doctor` to verify every registered role individually instead of probing only the lead role. Doctor now cross-checks `config.json` roles against `.squad/identity/apps/*.json`, validates keychain presence and installation IDs per role, and runs token resolution per role with actionable remediation commands when anything is missing.

### 2026-04-29T20:04:47-07:00 — detailed install verification output

Expanded the post-install verification in `extensions/squad-identity/lib/install-apps.mjs` to print step-by-step ✅/❌ checks for registration presence, private key availability, installation ID discovery, and token resolution. The verification now reuses shared discovery logic and can surface whether the failure is missing registration, missing key material, missing installation, or a GitHub token exchange error.

### 2026-04-29T20:04:47-07:00 — resolve-token project root from cwd

Fixed `extensions/squad-identity/lib/resolve-token.mjs` so CLI execution walks up from `process.cwd()` to the nearest `.squad` directory instead of overriding the caller's repo with a script-relative path. This unblocks `install-apps` health checks and direct `squad-identity resolve-token --role <role>` calls when the package is installed globally and the real project lives elsewhere.

### 2026-04-29T20:04:47-07:00 — install-apps project root from cwd

Fixed `extensions/squad-identity/lib/install-apps.mjs` so `getProjectRoot()` walks up from `process.cwd()` to the nearest `.squad` directory instead of deriving a repo path from the installed script location. This makes `squad-identity install-apps` work from user repositories when the lib is executed out of the global npm package, matching the project-root discovery pattern already used by `create-app.mjs`.

### 2026-04-29T20:04:47-07:00 — resolve-token CLI command

Added `resolve-token` to `bin/squad-identity.mjs` as a direct wrapper around `extensions/squad-identity/lib/resolve-token.mjs`, requiring `--role <role>` and writing only the resolved token to stdout so shell capture works cleanly. I also aligned batch CLI behavior so `install-apps` exits 0 with a clear "Nothing to install" message when no registrations exist, matching the new non-interactive command contract.

### 2026-04-29T20:04:47-07:00 — batch create/install CLI commands

Added `create-apps` and `install-apps` to `bin/squad-identity.mjs` as direct-execution CLI commands that reuse shared role discovery and app registration loading instead of generating scripts. `create-apps` batch-runs `create-app.mjs --role <role> --icon` for missing roles then runs doctor, while `install-apps` filters registrations missing `installationId`, delegates to `install-apps.mjs`, and finishes with `--update-charters`; both support comma-separated `--roles` filters.

### 2026-04-29T20:04:47-07:00 — generated create/install scripts in extension

Added two extension-only tools in `extensions/squad-identity/extension.mjs` that read `.squad/team.md` and `.squad/identity/apps/*.json` directly, then return reviewable bash scripts instead of executing browser-driven setup. The create script tool filters missing roles, checks `node --version` + `gh auth status`, emits sequential `squad-identity create-app --role <role>` commands, and ends with `squad-identity doctor`; the install script tool filters apps missing `installationId`, opens each install URL with `gh browse`, waits for confirmation, and finishes with `squad-identity setup`.

### 2026-04-29T18:51:47.406-07:00 — Linux keychain availability probe

Fixed `keychainAvailable()` in `extensions/squad-identity/lib/keychain.mjs` to stop using `secret-tool --version`, which always exits non-zero on Linux. The availability probe now uses `secret-tool lookup` against a guaranteed-miss key and treats exit 1 with no stderr as healthy, so libsecret/D-Bus environments are recognized correctly.

### 2026-04-30T10:30:00Z — idempotent phased setup flow

Reworked `bin/squad-identity.mjs` so `squad-identity setup` now runs as a six-phase guided flow: initialize, discover, app creation/import, install, configure, and health check. It classifies each discovered role as `fully_configured`, `needs_creation`, `needs_pem`, or `needs_install`, skips already-complete work by default, supports `--force`/`--reconfigure` to re-prompt every role, and only runs repo installation for roles still missing `installationId`; the README now documents `setup` as the primary idempotent workflow.

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

---

## Team Updates

### 2026-04-30T01:43:07Z — Scribe archived decision entries

Scribe merged Tank's 2 inbox entries into the unified `.squad/decisions.md`:
- `tank-sqd-prefix.md` — Default prefix changed from "squad" to "sqd"; custom apps derive prefix from owner alias
- `tank-two-channel-release.md` — 2-channel release strategy (insider/stable) with changesets pre-release mode

Created orchestration log: `.squad/orchestration-log/2026-04-30T01:43:07Z-Tank.md` summarizing this session's work (135/135 tests pass, 3 files modified, multi-OS/Node validation).

Tank's work is now documented in the team decision ledger for future agent reference.
