# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** squad-identity — GitHub App bot-identity governance for Squad agents. The plugin installs into any Squad-using repo and ensures agent writes use `{app-slug}[bot]` identities.
- **Stack:** Node.js (built-ins only), GitHub Apps, `gh` CLI. Plugin architecture: extension + skill + scripts.
- **Docs surface I maintain:**
  - `README.md` (root) — what the plugin is, install path, available tools after CLI restart, role-slug inference explanation, `squad upgrade` survival
  - `squad-identity/SKILL.md` — agent-facing protocol (Steps A–D, anti-patterns, post-flight semantics)
  - `identity/README.md` — key rotation runbook
  - `install.sh` user-visible messages and "next steps" output
  - The identity block injected into `.github/copilot-instructions.md` of target repos (text owned here, write logic in Tank's `configure-identity.mjs --update-copilot-instructions`)
  - The `identity_setup_steps` tool's response text in `extensions/squad-identity/extension.mjs`
- **Two install paths:**
  1. `bash install.sh /path/to/target-squad-repo` — full install (extension + skill + identity template)
  2. `squad plugin marketplace add Sabbour/squad-identity` — skill only
- **Upgrade-proof claim:** none of the paths the plugin owns are in Squad's upgrade manifest, so `squad upgrade` never overwrites identity config, keys, the extension, or the skill. Only `.github/copilot-instructions.md` and `.github/agents/squad.agent.md` get rewritten — both are restored by post-upgrade tools.
- **Created:** 2026-04-28

## Learnings

### 2026-04-28T14:01:29-07:00: README install section mirror Squad's Quick Start format

**Pattern:** Numbered steps with one-liner intent, command block, and ✓ Validate checklist. "Why before how" — each section explains the step's purpose in one sentence before the command.

**Key structure:**
1. **Install the CLI** — Global npm binary install
2. **Initialize in your Squad repo** — Per-repo state setup (extension, skill, config template)
3. **Restart Copilot CLI and configure** — Tool appearance + first-time auth
4. **Upgrading** — Two-step: npm update + squad-identity upgrade (preserves config + keys)
5. **Health check** — Doctor tool validates setup
6. **Marketplace alternative** — Skill-only path noted as secondary

**Why this structure:** Separates CLI binary lifecycle (global, npm-managed) from per-repo state (config, keys, extension sync). Mirrors Squad's own upgrade pattern — keeps config across CLI updates. Validates at every step so users know success.

**For future docs:** All install / upgrade sections should follow this cadence — validate explicitly, preserve user state across version boundaries, and clarify the two install paths (full vs. skill-only).
