# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** squad-identity — GitHub App bot-identity governance for Squad agents. Every agent-authored GitHub write must verify `{app-slug}[bot]` identity in the same subshell, synchronously, before claiming success.
- **Stack:** Node.js (built-ins only), GitHub Apps API, JWT, `gh` CLI. No npm dependencies — supply-chain surface is zero.
- **Security policy (mine to enforce):**
  - **Steps A–D** in `squad-identity/SKILL.md`: fail-closed env, token capture with `$(...)`, inline use, synchronous post-flight check.
  - **`--required` semantics:** `resolve-token.mjs --required <role>` exits 1 with stderr reason if no app is configured. Never silently fall back to another role.
  - **Post-flight policy:** verify both `login` AND `user.type === "Bot"` (defends against human-login collision). Mismatch → revoke. Revoke success → exit 1, governance fail recorded. Revoke failure → exit 2, halt, P1.
  - **Bot-login normalization:** `squad-<role>[bot]` ≡ `sabbour-squad-<role>[bot]`. Strip `sabbour-` prefix before comparison.
  - **Anti-patterns** (each is a P1 governance failure): bare `node resolve-token.mjs` (token leaks to chat), `echo "$TOKEN"`, `export GH_TOKEN`, bare `gh` calls, committing `*.pem`, async post-flight, `/tmp` for `GH_CONFIG_DIR`, reusing `GH_CONFIG_DIR` across sessions.
- **Files I gate:**
  - `extensions/squad-identity/lib/post-flight-check.mjs` — policy lives here
  - `squad-identity/SKILL.md` — protocol; anti-pattern table
  - `identity/README.md` — rotation runbook
  - `.gitignore` enforcement on `identity/keys/` and `apps/*.json`
- **Created:** 2026-04-28

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
