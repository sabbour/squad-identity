# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Architecture & scope | 🏗️ Morpheus | Plugin layer boundaries, what survives `squad upgrade`, public CLI surface, decision ledger |
| Node implementation | 🔧 Tank | `lib/*.mjs` changes, GitHub API calls, JWT signing, install.sh, extension.mjs |
| Token resolution & install scripts | 🔧 Tank | `resolve-token.mjs`, `create-app.mjs`, `install-apps.mjs`, `sync-secrets.mjs`, `configure-identity.mjs` |
| Security policy & post-flight | 🔒 Trinity | Post-flight semantics, anti-patterns, `--required` semantics, key handling, leak response |
| Key rotation & runbooks | 🔒 Trinity | `identity/README.md`, rotation steps, governance escalation |
| SKILL.md & docs | 📝 Oracle | Protocol prose, README, install messaging, copilot-instructions identity block, tool descriptions |
| Test design & doctor checks | 🧪 Switch | `--doctor` coverage, role-slug inference tests, post-flight kind coverage, install idempotency, exit-code assertions |
| Code review (security-sensitive) | 🔒 Trinity | Anything touching `post-flight-check.mjs`, token handling, key paths, `.gitignore` of secrets |
| Code review (architecture/surface) | 🏗️ Morpheus | Public CLI surface, config schema, charter injection format, layer boundaries |
| Test sign-off | 🧪 Switch | PR test verification before merge |
| Session logging | 📋 Scribe | Automatic — never needs routing |
| Work monitoring | 🔄 Ralph | "Ralph, go" — keeps the queue moving |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | 🏗️ Morpheus |
| `squad:morpheus` | Architecture, scope, decisions | Morpheus |
| `squad:tank` | Implementation work in `lib/*.mjs`, `extension.mjs`, `install.sh` | Tank |
| `squad:trinity` | Security policy, post-flight, key handling, rotation | Trinity |
| `squad:oracle` | Docs, README, SKILL.md, runbook, install messaging | Oracle |
| `squad:switch` | Tests, doctor coverage, edge-case verification | Switch |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, **Morpheus** triages it — analyzes content, assigns the right `squad:{member}` label, and comments with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Morpheus's review.

## Reviewer Pairings

This project is security-forward. Most PRs need TWO reviewers:

| PR Type | Required reviewers |
|---------|-------------------|
| Touches `post-flight-check.mjs` or anti-pattern enforcement | Trinity (mandatory) + Morpheus |
| Touches `resolve-token.mjs`, `create-app.mjs`, key handling | Trinity (mandatory) + Tank |
| Touches public CLI surface or config schema | Morpheus (mandatory) + Switch (test impact) |
| Docs only | Oracle |
| Tests only | Switch + relevant domain owner |

**Reviewer rejection lockout** (per `squad.agent.md`): on rejection, the original author is locked out of the revision. A different agent must own the next attempt.

## Rules

1. **Eager by default** — spawn all agents who could usefully start, including anticipatory work (Switch can write tests from spec while Tank implements).
2. **Scribe always runs** after substantial work, always `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn for "what tools does the extension register?"
4. **Security PRs are never solo-author/solo-reviewer.** Trinity reviews any auth-touching change.
5. **"Team, ..." → fan-out.** All relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** Implementation in flight → spawn Switch for test cases simultaneously, Oracle for doc updates.
7. **Issue-labeled work** — `squad:{member}` routes directly; bare `squad` goes to Morpheus for triage.
