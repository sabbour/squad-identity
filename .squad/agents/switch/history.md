# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** squad-identity — GitHub App bot-identity governance for Squad agents. Verifies agent writes use `{app-slug}[bot]` and not the operator's `gh` session.
- **Stack:** Node.js (built-ins only), GitHub Apps API, `gh` CLI.
- **What I test:**
  - **`--doctor`** end-to-end: config exists, `agentNameMap` populated, PEM keys readable, `resolve-token.mjs` accessible, token resolution succeeds for the lead role.
  - **`--update-charters`** correctness: parses `## Members` table in `team.md`, infers role slug from keyword map (lead/frontend/backend/tester/security/codereview/devops/docs/scribe), excludes `Squad`/`Ralph`/`@copilot`/`Scribe`, falls back to config.json apps keys, warns on unmappable members.
  - **`resolve-token.mjs`** edge cases: missing config, missing PEM, role with no app, `--required` exit codes (1 vs 0).
  - **`post-flight-check.mjs`** kinds: review (dismissed via PUT), comment (DELETE), label (DELETE), pr-create, issue-edit, commit. Exit codes 0/1/2/3.
  - **`install.sh`** idempotency: re-runs don't clobber existing `config.json`, target-repo arg vs implicit-from-CWD, missing `.squad/` creates it.
  - **Worktree resolution:** `TEAM_ROOT` resolves correctly when running inside a git worktree.
- **Pass/fail criteria:**
  - Exit codes are asserted, not just stdout.
  - Token never appears in any captured output (chat, log, file).
  - `--doctor` green = all checks pass; any red blocks release.
- **Created:** 2026-04-28

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-04-28T14:01:29.939-07:00 — Install test surface for npm CLI
- The new install surface splits into global npm postinstall sync and explicit per-repo `squad-identity init`/`upgrade`; tests must prove local `npm install` never mutates `~/.copilot/extensions/`.
- Regression coverage must preserve legacy `install.sh` behavior: copy extension + skill, create config from template only when absent, and stay idempotent while announcing deprecation.
- High-risk cases are config/PEM preservation, CI detection, cross-platform path resolution via home/path APIs, deterministic exit codes, and no token/PEM leakage in wrapper output.
