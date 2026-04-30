# Squad Decisions

## Release & Distribution

### npm Package Shape & Distribution (2026-04-28)

**Status:** Implemented | **By:** Morpheus (Lead) + Ahmed Sabbour

One-liner install via npm — mirror Squad's shape. Distribute `@sabbour/squad-identity` (fallback: `sabbour-squad-identity` if scope unavailable) with CLI binary that mirrors Squad's own `@bradygaster/squad-cli` shape. Install via `npm install -g @sabbour/squad-identity` then `squad-identity init` in each target Squad repo. Postinstall hook syncs `extension.mjs + lib/` into `~/.copilot/extensions/squad-identity/` so Copilot CLI auto-loads tools globally.

**Why:** Copilot CLI extensions have no marketplace — distribution is purely file-based to `~/.copilot/extensions/` or `.github/extensions/`. npm gives a one-liner with semver, `npm update -g` lifecycle, and zero net cost (Copilot CLI already requires Node). Mirroring Squad's shape means users get the same install pattern. Plugin/MCP path rejected (no behavioral benefit).

**Scope:** `package.json` with `bin` entry `squad-identity`, CLI dispatcher (`bin/squad-identity.mjs`), postinstall script (`scripts/postinstall.mjs`), subcommands `init` / `upgrade` / `doctor` / `status` mirroring Squad. Existing `identity_*` Copilot CLI tools remain.

### Changesets for Release Management (2026-04-29)

**Status:** Implemented | **By:** Tank (Backend Dev)

Use `@changesets/cli` with GitHub Actions (`changesets/action@v1`). Contributors describe changes via `npx changeset`, merging to main triggers version-bump PR or npm publish.

**Requires:** `NPM_TOKEN` repo secret. Version in package.json is managed by changesets (don't bump manually). Every PR with user-facing changes should include a changeset file.

### Two-Channel Release Strategy (2026-04-29)

**Status:** Proposed | **By:** Tank (Backend Dev)

Adopt 2-channel model with changesets pre-release:

| Channel | Branch | npm dist-tag | Version format |
|---------|--------|-------------|----------------|
| Insider | `insider` | `@insider` | `1.1.0-insider.0` |
| Stable | `main` | `@latest` | `1.1.0` |

Work flows: feature branch → PR to `insider` → test → PR from `insider` to `main` → stable release.

**Implementation:** `.changeset/pre.json` on insider branch activates pre-release. `release.yml` triggers on both branches with conditional publish. `ci.yml` runs tests on both.

**Discipline:** `pre.json` must exist only on insider, not main.

### npm Package Name Fallback (2026-04-28)

**Status:** Implemented | **By:** Tank (Backend Dev)

Initial package: `sabbour-squad-identity` (unscoped). CLI binary remains `squad-identity`. `install.sh` points users at `npm install -g sabbour-squad-identity`. Ahmed can claim `@sabbour` npm scope later and switch package name in follow-up release.

**Why:** `@sabbour` scope was unavailable at time of implementation (404 from `npm org ls sabbour`). Fallback rule triggered.

---

## GitHub App Identity

### Default App Prefix & Custom App Derivation (2026-04-29)

**Status:** Implemented | **By:** Tank (Backend Dev)

Default app name prefix changed from "squad" to "sqd". Public apps (sqd-lead, sqd-backend, etc.) are shared; users can override with `--prefix` for private apps.

Manifest-based app creation now derives prefix from GitHub owner when `--prefix` is omitted, producing `{owner}-{role}` for custom apps. Public `sqd-*` apps are pre-created and installed by users; newly created custom apps use creator's alias unless explicitly overridden.

### Public vs. Custom Apps (2026-04-29)

**Status:** Finalized | **By:** Ahmed Sabbour (via Copilot)

Default `sqd-*` apps are public, pre-created by Ahmed — users only install them, never create them. When creating custom apps, the slug should include the user's GitHub alias (e.g., `{alias}-{role}`).

Separates public shared apps from user-specific custom apps.

---

## Documentation & Governance

### v1.1.0 Governance Docs Update (2026-04-29)

**Status:** Complete | **By:** Oracle (Docs Lead)

Updated all documentation to reflect squad-identity v1.1.0 governance infrastructure (Token Lease Protocol, Pre-Merge Governance, Attestation Audit Trail). All docs now accurately describe 11 available tools, updated agent protocol Steps (A–E), and new governance failure modes.

**Changes:**
- README.md: Architecture diagram (8 tools → 11), Layers (2 → 3), Protocol (A-C → A-E)
- squad-identity/SKILL.md: Tools table (+3 governance), Steps A-E, Anti-patterns (+6)
- identity/README.md (new): Key rotation runbook (8.4KB)
- Agents' history.md: v1.1.0 learnings + design decisions

**Files modified:** README.md, SKILL.md, identity/README.md (create), oracle/history.md

### Release Process Skills (2026-04-29)

**Status:** For Team Review | **By:** Oracle (Docs Lead)

Created two Copilot-level skills (`.copilot/skills/`) for insider → stable pipeline:
- `release-insider/SKILL.md` — Ship features to `@insider` npm tag
- `promote-to-stable/SKILL.md` — Promote validated insider to `@latest` tag

**Design:** Separation of concerns (shipping vs. governance). Different audience intent. Anti-patterns specific to 2-channel model (manual versioning, cherry-picking, pre.json leakage).

**Confidence:** Low (first observation). Upgrade to "medium" after first agent use.

---

## Testing & CI

### Autonomous Testing Strategy (2026-04-29)

**Status:** Proposed | **By:** Switch (Tester)

Replace placeholder CI workflows with real, autonomous testing pipeline that gates every PR, every publish, and self-heals when published package drifts.

**CI Testing layers:**
- `pull_request` / `push` on dev, preview, main, insider branches
- Matrix: Node 18/20/22 × ubuntu-latest/macos-latest (multi-OS for keychain integration)
- Weekly smoke on main catches environment drift
- Post-publish smoke test verifies installed registry package
- Daily heartbeat with issue auto-creation on failure

**Integration tests:** init-upgrade, package-export verification, zero-dep approach.

**Dependabot:** Auto-merge devDep updates if CI passes (zero runtime deps = all updates safe).

**Self-healing:** Heartbeat failure → Issue created → Copilot Coding Agent assigned → Fix PR → CI passes → Auto-merge.

**Verdict:** No human in loop for routine maintenance. Human reviews only for new features and security-sensitive changes.

### CI Global npm postinstall Behavior (2026-04-28)

**Status:** Proposed | **By:** Switch (Tester)

`CI=true npm install -g @sabbour/squad-identity` should exit 0 and **skip** syncing to `os.homedir()/.copilot/extensions/squad-identity`. Output clearly says sync was skipped because CI is set.

**Why:** CI runners often share cached homes or run under restricted service accounts. Deterministic skip-with-success keeps package installation usable in builds without hidden runner state mutations.

---

## User Directives

### Release Strategy: 2 Channels Exactly (2026-04-29)

**Status:** Finalized | **By:** Ahmed Sabbour (via Copilot)

Release strategy uses exactly 2 channels: `insider` (pre-release, @insider npm tag) and `main` (stable, @latest npm tag). No preview/beta/next channels.

**Why:** User request — captured for team memory.

### Changesets for Versioning & Changelogs (2026-04-29)

**Status:** Finalized | **By:** Ahmed Sabbour (via Copilot)

Project will use changesets (@changesets/cli) for versioning and changelogs.

**Why:** User request — captured for team memory.

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
