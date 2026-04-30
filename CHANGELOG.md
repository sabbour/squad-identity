# @sabbour/squad-identity

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
