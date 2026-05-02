# @sabbour/squad-identity

## 1.5.1

### Patch Changes

- a8d8c4b: fix: guard publish step against premature version from changeset workspace mutation; align bundled SKILL.md with extension.mjs tool surface

  **Pipeline fix:** The `changesets/action@v1` step runs `changeset version` locally when pending
  changesets exist, rewriting `package.json` to the next version in the runner workspace. The
  subsequent "Publish to npmjs" step was reading that mutated version and publishing an unreleased
  tarball off a non-release commit. Added `steps.changesets.outputs.hasChangesets == 'false'`
  guard so publishing only happens after the version-bump PR is merged. Also adds `--provenance`
  to `npm publish` to explicitly opt into OIDC trusted publishing, and adds `continue-on-error`
  to the GitHub Packages mirror step so a Packages 403 does not abort the entire release.

  **SKILL.md alignment (Path A from forensic report):** The bundled `squad-identity/SKILL.md`
  described a consolidated `squad_identity_setup` / `squad_identity_configure` API that does not
  exist in `extensions/squad-identity/extension.mjs`. The extension still exports the v1.1.0 tool
  surface (`squad_identity_status`, `squad_identity_update_charters`,
  `squad_identity_update_copilot_instructions`, `squad_identity_setup_steps`,
  `squad_identity_setup_all`). Updated SKILL.md to match the real extension, so agents get
  accurate tool docs instead of calling non-existent tools.

  **TTL cleanup backport (from kickstart/origin/dev):** Moved expired-lease eviction into
  `readStore()` as lazy cleanup on every read. `cleanupExpired()` now delegates to `readStore()`,
  and `listLeases()` drops the redundant inline filter since `readStore()` already removes
  expired/exhausted/revoked entries. This prevents stale lease accumulation in long-running
  sessions without requiring explicit cleanup calls.

## 1.5.0

### Minor Changes

- 43a8609: Improve upgrade and doctor experience:

  - `upgrade` now displays a clear `from → to` version transition and detects no-op upgrades (already on latest).
  - Managed identity block in `.github/copilot-instructions.md` is now stamped with the installed version, enabling drift detection.
  - `doctor` expanded to verify all injected artifacts: copilot-instructions identity block, per-agent charter `ROLE_SLUG` injection, and per-agent skill pointer (warn-only — never hard-fails on a missing optional injection).

## 1.4.4

### Patch Changes

- f737979: Fix extension test expectations for declarative tools refactor (7→10 tools) and fix token-lease-store TTL cleanup removing entries before status checks could run.

## 1.4.3

### Patch Changes

- fix(extension): use tools array pattern instead of session.registerTool() and fix lease store TTL cleanup

## 1.4.0

### Minor Changes

- a5358e0: `squad_identity_resolve_token` now returns a confirmation message with lease metadata instead of the raw token. The token is stored in the lease system and auto-resolved by other squad extensions internally. `squad_identity_attest_write` no longer requires a `token` parameter — it auto-resolves from `roleSlug`.

## 1.3.1

### Patch Changes

- d3d8166: Fix extension tool permissions and node binary resolution

  - Add `skipPermission: true` to all tool definitions to prevent "Permission denied" errors in Copilot CLI
  - Replace `process.execPath` with resolved `node` binary path — `process.execPath` returns the copilot binary in extension context, breaking all child process spawns

## 1.3.0

### Minor Changes

- 69d4bee: Refactor extension to use declarative `tools[]` registration and add experimental warning to README.

### Patch Changes

- a8f9d0f: Fix GitHub App registrations so key rotation works for newly created apps and older slug-only app files.

## 1.2.0

### Minor Changes

- 3e7be42: ### Features

  - **CLI consolidation:** Reduced from 12 to 7 commands with batch operations (`create-app`, `install-apps`, `setup`)
  - **`--json` flag:** All CLI commands support `--json` for machine-readable output with `log()` stderr pattern
  - **Changeset automation skill:** New `.copilot/skills/changeset-automation/SKILL.md` teaches agents to create changeset files directly
  - **`create-app` standalone command:** Available as a top-level CLI subcommand
  - **Fallback icon:** Unknown role slugs get a default app icon
  - **Branch alignment:** Main-only branching model (no insider channel)

  ### Fixes

  - **Keychain probe:** Use probe-based check on Linux (`secret-tool` has no `--version` flag) — fixes WSL detection
  - **Doctor:** Only shows roles used by the current team
  - **install-apps:** Accepts multiple roles, bypasses team roster check when `--role` is explicit, setup opens all install pages at once
  - **Role slug inference:** Handles more roles with slugify fallback

  ### Docs

  - Harmonized README with squad-reviews (badges, prerequisites table, deduplicated sections)
  - Documented `--json` flag, role inference, slugify fallback, and app icons
  - Updated app naming and quick-start to match actual CLI output

## 1.1.0

### Minor Changes

- c970dc1: feat: initial insider release with bot identity governance, token resolution, and OS keychain storage
