# squad-identity

GitHub App bot-identity governance for [Squad](https://github.com/bradygaster/squad) agents.

Ensures every agent-authored GitHub write (PR, comment, label, push) uses the correct
`{app-slug}[bot]` identity — never the human operator's personal token.

---

## What's in here

| Path | Purpose |
|------|---------|
| `squad-identity/SKILL.md` | Protocol — agents read this at spawn (Steps A-D, anti-patterns) |
| `extensions/squad-identity/extension.mjs` | Copilot CLI extension — registers 5 tools, syncs scripts on session start |
| `extensions/squad-identity/lib/configure-identity.mjs` | CLI script — infers role slugs, updates charters, health checks |
| `extensions/squad-identity/lib/create-app.mjs` | Interactive GitHub App creation (browser OAuth) |
| `extensions/squad-identity/lib/install-apps.mjs` | Installs Apps into org/repo |
| `extensions/squad-identity/lib/sync-secrets.mjs` | Uploads PEM keys + app metadata as repo secrets |
| `extensions/squad-identity/lib/resolve-token.mjs` | Token resolver called by agents |
| `extensions/squad-identity/lib/post-flight-check.mjs` | Post-write identity verifier |
| `identity/config.json.template` | Template for `.squad/identity/config.json` |
| `identity/README.md` | Key rotation runbook |
| `squad-plugin.json` | Squad marketplace metadata |

---

## Install

```bash
git clone https://github.com/Sabbour/squad-identity
bash squad-identity/install.sh /path/to/your-squad-repo
```

Or from within your Squad repo:

```bash
bash /path/to/squad-identity/install.sh
```

Then restart Copilot CLI and call `identity_setup_steps`.

### Squad marketplace (skill only)

```bash
squad plugin marketplace add Sabbour/squad-identity
```

This installs the skill (`squad-identity/SKILL.md`) but not the extension or scripts.
Use `install.sh` for the full installation.

---

## Available tools (after CLI restart)

| Tool | Description |
|------|-------------|
| `identity_setup_steps` | Step-by-step setup for first-time configuration |
| `identity_status` | Show agentNameMap + registered apps |
| `identity_doctor` | Health check |
| `identity_update_charters` | Infer role slugs from `team.md`, update charters |
| `identity_update_copilot_instructions` | Restore identity block in `copilot-instructions.md` |

---

## How it works

**Three layers — all upgrade-proof:**

1. **Extension** (`.github/extensions/squad-identity/`) — registered tools available in every
   CLI session; `onSessionStart` syncs `lib/*.mjs` → `.squad/scripts/` for Squad bot agents
2. **Skill** (`.squad/skills/squad-identity/SKILL.md`) — protocol agents read at spawn;
   explains role slug derivation, Steps A-D, anti-patterns
3. **Scripts** (`.squad/scripts/` after sync) — called by bot agents during writes

None of these paths are in the Squad upgrade manifest — they survive all `squad upgrade` runs.

---

## Role slug inference

`configure-identity.mjs --update-charters` parses your `.squad/team.md` members table,
matches each agent's role description against a keyword map, and derives the role slug
from your existing `config.json.apps` keys. The result is stored as `agentNameMap` in
`config.json` and a concrete `ROLE_SLUG="<slug>"` line is injected into each charter.

No hardcoded name tables — works with any Squad character set.

---

## After a `squad upgrade`

Run:
```bash
identity_update_charters
identity_update_copilot_instructions
```

That's it. Keys, config, extension, and skill survive the upgrade automatically.

---

## License

MIT
