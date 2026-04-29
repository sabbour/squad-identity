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

### 2026-04-29T13:06:05-07:00: v1.1.0 governance docs (Token Leases, Pre-Merge, Attestation)

**Changes made:**
1. **README.md** — Updated Architecture diagram: 8 tools → 11, added 5 new lib files (token-lease.mjs, exchange-lease.mjs, premerge-check.mjs, attest-write.mjs, attestation-store.mjs, identity-context-builder.mjs), changed "Two layers" to "Three layers" (added Config layer), updated Steps A-C to Steps A-E
2. **SKILL.md** — Expanded Available Tools table with 3 new Governance Tools section, rewrote Steps to include B (pre-merge check) and E (attestation), added 6 governance-specific anti-patterns (premerge bypass, lease expiry bypass, attestation skip, audit trail tampering, etc.), updated version tag to v1.1.0
3. **identity/README.md** — Created new runbook for key rotation: when/why/how, emergency response, verification, CI/CD sync, failure recovery, quarterly process, troubleshooting, glossary
4. **Copilot CLI tools table** — Broke into 3 categories (Admin/Runtime/Governance), updated descriptions for all 11 tools with v1.1.0 governance tools

**Verification done:**
- Confirmed all 11 tools in extension.mjs: status, doctor, update_charters, update_copilot_instructions, setup_steps, setup_all, resolve_token, rotate_key, lease_token, premerge_check, attest_write
- Tool descriptions in extension.mjs match docs ✓
- config.json.template has branches + attestation sections ✓
- Architecture now accurately reflects lib/ structure
- Steps A-E in SKILL.md match the governance workflow: fail-closed setup → premerge validation → token resolution (direct/leased) → inline use → attestation recording

**Key design principle:** The docs now clearly separate the two token resolution paths:
- **Standard agents** (direct): `squad_identity_resolve_token` → immediate token → Step C
- **Coordinator-gated agents** (leased): Coordinator issues lease (Step B) → agent exchanges lease (Step C) → coordinator validates remaining ops

Attestation is now Step E (post-write), not optional — protocol requires it for audit trail compliance.

**For future docs:** When adding new governance features, update docs in this order: SKILL.md protocol (agent-facing), README architecture + tool table, runbook (admin/operator-facing). Anti-patterns table is now the place to flag new failure modes — update it when Trinity adds new post-flight rules.

### 2026-04-29T13:56:08-07:00: Created two Copilot-level release process skills

**Skills created:**
1. `.copilot/skills/release-insider/SKILL.md` — "Release to Insider" (confidence: low, source: manual)
2. `.copilot/skills/promote-to-stable/SKILL.md` — "Promote Insider to Stable" (confidence: low, source: manual)

**Design rationale:**
- **Skill 1 (Release to Insider):** Covers the operational flow for shipping features to the `@insider` npm tag. Emphasizes the role of changesets, the automatic "Version Packages (insider)" PR, and validation steps. Anti-patterns flag manual versioning, local publishing, and branching from main.
- **Skill 2 (Promote to Stable):** Explains the 5-step promotion pipeline (exit pre-release → PR → merge → Version Packages PR → re-enter pre-release). Clarifies why `.changeset/pre.json` must not reach main and what happens if skipped. Anti-patterns include cherry-picking, forgetting pre-release re-entry, and bypassing the automated "Version Packages" PR.

**Key insight:** Both skills follow the "why before how" principle. Each section explains intent (when to use, what happens next) before showing git commands. The promotion skill emphasizes **process clarity over speed** — the 5-step approach prevents pre-release markers leaking to stable and ensures both branches remain clean for future work.

**Skills follow the template:** Both use the `.squad/templates/skill.md` format (frontmatter with metadata, Context, Patterns, Examples, Anti-Patterns). Examples show real workflows; anti-patterns are specific failure modes tied to the 2-channel release model.
