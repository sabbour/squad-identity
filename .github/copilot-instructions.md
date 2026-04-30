# Copilot Instructions for squad-identity

This is a GitHub App identity governance tool for Squad agents. It ensures that every agent-authored write (PR, comment, label, push) uses the correct bot identity token — never the human operator's personal token.

## Quick Reference

**Latest version:** Check `package.json` for semver.
**Package name:** `@sabbour/squad-identity` (npm scoped package)
**Installation:** `npm install -g @sabbour/squad-identity`
**Entry point:** `bin/squad-identity.mjs` (Node 18+)

## Architecture Overview

Two independent layers (both survive npm upgrades):

1. **Extension** (`.github/extensions/squad-identity/`) — CLI tools registered at startup; tools call `lib/*.mjs` directly
2. **Skill** (`.squad/skills/squad-identity/SKILL.md`) — Protocol reference agents read before spawning; defines role slug derivation and agent anti-patterns

Each layer is upgrade-proof and independent. Agents use `squad_identity_*` tools exclusively.

## Key File Reference

| File | Purpose |
|------|---------|
| `bin/squad-identity.mjs` | CLI dispatcher; entry point for `squad-identity init/setup/create-app/find-app/import-app/upgrade/rotate-key/doctor/status` |
| `extensions/squad-identity/extension.mjs` | Registers 8 tools; tools call lib scripts directly |
| `extensions/squad-identity/lib/*.mjs` | 6 lib scripts: configure-identity, create-app, install-apps, resolve-token, keychain, sync-secrets |
| `squad-identity/SKILL.md` | Agent protocol; read by agents at spawn time (Steps A–C, anti-patterns) |
| `identity/config.json.template` | Template copied to `.squad/identity/config.json` on init |

## Critical Concepts for Agents

### Role Slugs

Agents derive their identity by:
1. Looking up their name in `.squad/identity/config.json` → `agentNameMap`
2. Finding their GitHub App ID for that role slug
3. Resolving the PEM key from OS keychain (keyed by app ID) or environment variables

The role slug is injected into each agent's charter by `configure-identity.mjs --update-charters` during setup. Example: an agent named "Tank" with role "Backend Dev" might map to role slug `backend`, using app `sqd-backend[bot]` (public) or `myteam-backend[bot]` (custom).

### GitHub Apps: public vs. custom

**Public apps (default):** `sqd-<role>[bot]` — pre-created, shared, just install during setup.

**Custom apps (optional):** `{your-alias}-<role>[bot]` — create your own via `squad-identity create-app --role <role>` if you want isolation.

### Installation

**npm (recommended):** `npm install -g @sabbour/squad-identity` → `squad-identity init` in your Squad repo → restart Copilot
  - Installs extension, skill, config template
  - Agents get `squad_identity_*` tools available immediately

**Upgrade:** `npm install -g @sabbour/squad-identity@latest` → `squad-identity upgrade`
  - Refreshes extension files and reapplies identity block in copilot-instructions.md
  - Does NOT touch config.json or keychain keys (preserved across upgrades)

## Development & Testing

Run `npm test` to execute the test suite.

Manual validation:
- `npm install -g` followed by `squad-identity --version`
- `squad-identity init /tmp/test-repo` (creates `.github/extensions/` and `.squad/` blocks)
- `squad-identity doctor` (health check for config, PEM readability, token resolution)

## Common Agent Tasks

### Full setup (new repo)

```bash
squad-identity setup    # guided: reads team.md, creates apps, installs, updates charters
```

### Adding a new GitHub App identity

1. Run `squad_identity_setup_steps` (shows setup instructions)
2. Run `squad_identity_doctor` (verifies config and PEM keys are readable)
3. Run `squad_identity_update_charters` (infers role slugs from team.md, writes ROLE_SLUG to charters)

### Checking identity configuration

```bash
squad_identity_status        # Show agentNameMap + registered apps
squad_identity_doctor        # Health check (config presence, PEM readability, token resolution)
```

### After squad upgrade

```bash
npm install -g @sabbour/squad-identity@latest
squad-identity upgrade
squad_identity_update_charters          # if roles changed
squad_identity_update_copilot_instructions   # if instructions were lost
```

## Credential Storage

PEM keys are stored in the **OS keychain** — never on the filesystem:

**Resolution order** (resolve-token.mjs):
1. **Environment variables** (CI/CD): `SQUAD_{ROLE}_APP_ID`, `SQUAD_{ROLE}_PRIVATE_KEY`, `SQUAD_{ROLE}_INSTALLATION_ID`
2. **OS keychain** (local): macOS Keychain, Linux libsecret (keyed by app ID)

**No filesystem PEM storage.** Keys are stored in the keychain when created via `squad-identity create-app`.

## Expected File Locations (After Init)

```
.squad/
  identity/
    config.json                    # Agent name ↔ role slug ↔ GitHub App ID mapping
    config.json.template           # Template (copied on first init)
    apps/
      {role}.json                  # App registration (appId, slug, clientId, installationId)
  skills/
    squad-identity/
      SKILL.md                     # Protocol reference (read-only)
  agents/
    {name}/
      charter.md                   # Contains injected ROLE_SLUG="<slug>"

OS Keychain:
  macOS Keychain / Linux libsecret
    service: squad-identity
    account: app-{appId}           # PEM private key per GitHub App

.github/
  extensions/
    squad-identity/
      extension.mjs                # CLI tool registration
      lib/                         # Lib scripts (called by tools directly)
        *.mjs
```

## Anti-Patterns to Avoid

- **Do NOT store PEM keys on the filesystem.** Keys live in the OS keychain only.
- **Do NOT hardcode role slugs or app IDs in code.** Always derive from config.json via `squad_identity_resolve_token`.
- **Do NOT re-init in the same repo twice.** The extension and skill are already present; run `upgrade` instead.
- **Do NOT export tokens.** Use inline `GH_TOKEN="$TOKEN" gh ...` per-call.

## Integration Points

- **Squad:** squad-identity is a Squad-ecosystem plugin; agents spawn with the skill in their context
- **GitHub Copilot CLI:** Registers extension + tools at session start
- **GitHub Apps:** Creates and installs GitHub Apps for each agent role
- **GitHub CLI (`gh`):** Used during app installation to verify repo access and create secrets
