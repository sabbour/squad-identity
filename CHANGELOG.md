# @sabbour/squad-identity

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
