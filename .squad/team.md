# Squad Team

> squad-identity

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| 🏗️ Morpheus | Lead | `.squad/agents/morpheus/charter.md` | active |
| 🔧 Tank | Backend Dev | `.squad/agents/tank/charter.md` | active |
| 🔒 Trinity | Security | `.squad/agents/trinity/charter.md` | active |
| 📝 Oracle | DevRel / Docs | `.squad/agents/oracle/charter.md` | active |
| 🧪 Switch | Tester | `.squad/agents/switch/charter.md` | active |
| 📋 Scribe | Session Logger | `.squad/agents/scribe/charter.md` | active |
| 🔄 Ralph | Work Monitor | — | active |

## Project Context

- **Owner:** Ahmed Sabbour
- **Project:** squad-identity — GitHub App bot-identity governance for Squad agents. Ensures every agent-authored GitHub write uses the correct `{app-slug}[bot]` identity, never the operator's personal token.
- **Stack:** Node.js (built-ins only — no npm dependencies), GitHub Apps API + JWT, `gh` CLI, Squad plugin architecture (extension + skill + scripts).
- **Universe:** The Matrix
- **Created:** 2026-04-28
