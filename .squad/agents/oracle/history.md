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

---

## Team Updates

### 2026-04-30T01:43:07Z — Scribe archived decision entries & generated release process skills documentation

Scribe merged Oracle's 3 inbox entries into the unified `.squad/decisions.md`:
- `oracle-v1.1.0-governance-docs.md` — v1.1.0 docs refresh (11 tools, Steps A-E, 3-layer architecture)
- `oracle-release-skill-design.md` — Release process skills (release-insider, promote-to-stable) with low confidence, source: manual

Created orchestration log: `.squad/orchestration-log/2026-04-30T01:43:07Z-Oracle.md` summarizing this session's documentation work (4 files modified, design decisions embedded, v1.1.0 consistency verified).

Oracle's work is now part of the team decision ledger. Skills are ready for first agent use — confidence will upgrade to "medium" after successful first use and anti-pattern collection.

### 2026-04-29T19:58:43-07:00: Flipped GitHub Apps recommendation — custom now primary

**Directive:** Ahmed discovered that shared public GitHub Apps (`sqd-*`) are architecturally impossible. PEM keys belong to the app owner only; there's no secure way to share them without a central token broker service. Squad-identity provides no broker, so the "just install sqd-* apps" promise was false.

**Solution:** Flip the docs to make custom apps (`{your-github-username}-<role>[bot]`) the PRIMARY recommendation and demote `sqd-*` to a "future possibility if a broker is built."

**Changes made:**
1. **README.md**
   - Swapped Tier 1/Tier 2 language → "Primary: Custom apps" + "Optional: Public apps (future)"
   - Line 98: Setup flow now offers custom as first choice
   - Line 116: Replaced "use sqd-* by default" note with WHY explanation (PEM ownership)
   - Lines 154–177: Full "GitHub Apps" section rewritten with new rationale

2. **SKILL.md** (agent-facing protocol)
   - Lines 55–66: Updated "GitHub Apps" section — custom is "recommended", public is "future possibility"
   - Explained WHY: "GitHub App PEM keys belong to the app owner and cannot be shared without a central token broker service"

3. **.github/copilot-instructions.md** (Copilot-level instructions)
   - Line 40: Updated example to show custom app as primary option
   - Lines 42–46: Rewrote "GitHub Apps: custom vs. public" section with WHY explanation

**Key message (threaded through all three files):**
> "GitHub App PEM private keys belong to the app owner only — they are never shared. Without a central token broker service (which squad-identity does not provide), there is no secure way for multiple teams to use the same shared PEM. Each user creates their own GitHub Apps to ensure they own and control the PEM keys."

**Naming clarity:**
- Custom apps use pattern: `{your-github-username}-<role>[bot]` (derived from `create-app.mjs` line 988)
- Public apps (reserved for future): `sqd-<role>[bot]`

**Architectural principle enforced:** The docs now reflect the actual constraint of GitHub Apps — ownership of credentials determines distribution model.

### 2026-04-30T20:15:34-07:00: v1.2.0 batch operations docs — create-apps, install-apps, resolve-token

**Changes made:**
1. **README.md**
   - Updated Quick start (Step 1) to feature `create-apps` → `install-apps` → `doctor` as the recommended flow (after `init`)
   - Kept `setup` as the guided interactive alternative
   - Updated CLI commands table: added 3 new commands, renumbered tool count from 10 to 12
   - Updated Copilot CLI tools table: split "Agent runtime tools" and added new "Batch operation tools" section with `squad_identity_generate_create_script` and `squad_identity_generate_install_script`
   - Updated Architecture mermaid diagram: changed "10 CLI Tools" to "12 CLI Tools"

2. **SKILL.md** (agent-facing protocol)
   - Updated Available Tools table: added "Batch Operation Tools (v1.2.0+)" section with `squad_identity_generate_create_script` and `squad_identity_generate_install_script`
   - Updated Step B token resolution: added Option 1b for CLI use case — `squad-identity resolve-token --role <role>` with shell capture pattern

3. **.github/copilot-instructions.md** (Copilot-level instructions)
   - Updated Key File Reference: noted entry point includes new CLI commands (create-apps, install-apps, resolve-token)
   - Updated tool count in description: 8 tools → 12 tools
   - Updated Common Agent Tasks: added full section for batch setup flow, split guided alternative, added resolve-token usage section with shell capture pattern

**Design principles applied:**
- **CLI vs. tool split:** `squad-identity resolve-token --role <role>` for CLI use; `squad_identity_resolve_token roleSlug=...` for agent-in-context use
- **Batch vs. single:** `create-apps` / `install-apps` batch commands reduce setup friction; single commands (`create-app`, `find-app`, `import-app`) remain for fine-grained control
- **Flow hierarchy:** Docs now surface recommended flow first (batch), then alternatives (guided setup, single commands)
- **Agent scripts:** Batch operation tools generate bash scripts for agent review before execution — agents can inspect and approve before running

**Verification done:**
- Confirmed all 12 tools in extension.mjs match the docs
- Batch operation tools generate scripts, not execute directly (align with agent review requirement)
- All three doc surfaces (README, SKILL, copilot-instructions) now consistently reference the three new commands

**For future docs:** When adding new agent-facing tools, clearly distinguish:
- CLI commands (user-facing, `squad-identity ...`)
- Extension tools (Copilot session, `squad_identity_...`)
- Script generators vs. direct executors (agent approval gates)

---
