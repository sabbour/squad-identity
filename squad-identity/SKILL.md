<!-- squad-identity v1.0.0 | Source: github.com/Sabbour/squad-identity -->

# Squad Identity Protocol

This skill governs how Squad agents authenticate when writing to GitHub. Every
agent-authored write (PR, comment, label, push) MUST use the project's GitHub
App bot identity — never the human operator's ambient `gh` session.

---

## Available Tools (via squad-identity extension)

| Tool | Purpose |
|------|---------|
| `identity_status` | Show agentNameMap + registered apps |
| `identity_doctor` | Health check (config, keys, token resolution) |
| `identity_update_charters` | Infer mapping from `team.md`, update charters + `config.json` |
| `identity_update_copilot_instructions` | Replace/append identity block in `.github/copilot-instructions.md` |
| `identity_setup_steps` | Get initial setup instructions (browser-interactive steps) |

---

## Your Role Slug

Your `ROLE_SLUG` is injected into your charter by `--update-charters`. Look for:

```
ROLE_SLUG="<slug>"  # injected by configure-identity --update-charters; do not edit
```

**If this line is absent from your charter:**
1. Call `identity_status` — it prints the full `agentNameMap` from `config.json`
2. Or: `node "$TEAM_ROOT/.squad/scripts/configure-identity.mjs" --status`
3. If `config.json` is missing: call `identity_update_charters` to infer and populate it

The mapping is stored in `.squad/identity/config.json` under `agentNameMap`.
It is inferred from `.squad/team.md` (the `| Name | Role |` table) during setup.

---

## GIT IDENTITY Steps — Before Any GitHub Write

Follow these steps in order. Each step is a hard requirement, not advisory.

### Step A — Fail-closed environment setup

```bash
TEAM_ROOT=$(git rev-parse --show-toplevel)
ROLE_SLUG="<from your charter>"   # the injected line above

unset GH_TOKEN GITHUB_TOKEN
export GH_CONFIG_DIR="$TEAM_ROOT/.squad/runtime/gh-config/$$"
mkdir -p "$GH_CONFIG_DIR"
```

This prevents any bare `gh` call from silently falling back to the human
operator's `~/.config/gh/hosts.yml`. Use `$$` (current PID) as the directory
suffix so concurrent sessions don't share state.

### Step B — Resolve the bot token

```bash
TOKEN=$(node "$TEAM_ROOT/.squad/scripts/resolve-token.mjs" --required "$ROLE_SLUG") || exit 1
[ -n "$TOKEN" ] || exit 1
```

Always capture with `$(...)`. **Never run as a bare command** — the token would
appear in chat context and tool-call stdout.

`--required` exits non-zero with a reason on stderr if the role has no
configured app. This is intentional — fail closed instead of falling back to
another bot.

### Step C — Use the token inline, never export

```bash
# PR create
GH_TOKEN="$TOKEN" gh pr create --title "..." --body "🤖 Created by [app-slug](https://github.com/apps/app-slug)"

# Push
git push "https://x-access-token:${TOKEN}@github.com/{owner}/{repo}.git" HEAD

# Review / comment / label
GH_TOKEN="$TOKEN" gh pr review $PR_NUMBER --approve
GH_TOKEN="$TOKEN" gh issue comment $ISSUE_NUMBER --body "..."

# Commit with bot identity
git -c user.name="{app_slug}[bot]" \
    -c user.email="{app_slug}[bot]@users.noreply.github.com" \
    commit -m "..."
```

`export GH_TOKEN; gh ...` is **forbidden**: the token persists across subsequent
commands, `set -x` dumps it, and tool-call stdout capture bleeds it into logs.

### Step D — Post-flight identity check (synchronous, blocking)

After **every** bot-authored write, verify the actor in the same subshell:

```bash
GH_TOKEN="$TOKEN" node "$TEAM_ROOT/.squad/scripts/post-flight-check.mjs" \
  --kind <review|comment|label|pr-create|issue-edit|commit> \
  --owner {owner} --repo {repo} \
  [--pr N | --issue N | --sha SHA] \
  [--id ID] \
  --expected-login {app_slug}[bot]
```

Exit codes:
- `0` — OK, actor matches
- `1` — Mismatch, auto-revoked (comment deleted, label removed, review dismissed)
- `2` — Mismatch, revoke failed — **HALT**, file a P1 issue, do not retry

Do not declare ceremony success until this check passes. Async post-flight
leaves a governance-failed artifact live in the public record — forbidden.

---

## Anti-Patterns

Each of these is a P1 governance failure:

| ❌ Anti-pattern | Why |
|----------------|-----|
| `node resolve-token.mjs --required <role>` as a bare command | Token leaks to chat/log |
| `echo "$TOKEN"` or any print of the token value | Leaks token |
| `export GH_TOKEN; gh ...` | Token persists, bleeds into `set -x` |
| A bare `gh` call without `GH_TOKEN=...` in the same subshell | Falls back to `hosts.yml` (human account) |
| Pasting `ghs_` / `ghp_` / PEM material into any output | Leaks credential |
| Skipping the post-flight check | Governance gap — wrong identity may persist |
| Re-using `GH_CONFIG_DIR` across sessions | Cross-session token contamination |
| Using `/tmp` for `GH_CONFIG_DIR` | Violates repo runtime policy |
| `tmux capture-pane`, `history`, `/proc/*/environ` reads | Environment leak vector |
| Committing `.squad/identity/keys/*.pem` or `apps/*.json` | Credential commit |

---

## After a `squad upgrade`

The upgrade overwrites `.github/copilot-instructions.md` and `.github/agents/squad.agent.md`.
Your identity setup in `.squad/identity/` and `.github/extensions/` is **never touched**.

To restore the identity references:
1. Run `identity_update_copilot_instructions` tool (or `--update-copilot-instructions`)
2. Optionally run `identity_update_charters` if charters were regenerated

Everything else (config.json, keys, scripts) survives automatically.

---

## Rotation on Leak

If any credential leaks (token appears in output, chat, logs, commit), treat the
private key as compromised — GitHub's scanner revocation is a safety net, not
the primary control. The App private key has no expiry.

Runbook: `.squad/identity/README.md`
