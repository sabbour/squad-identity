# squad-identity

> GitHub App bot-identity governance for [Squad](https://github.com/bradygaster/squad) agents.

Every agent-authored GitHub write — PRs, comments, labels, pushes — is attributed
to a dedicated `{app-slug}[bot]` account. The human operator's personal token is
never used.

## Why

Without `squad-identity`, all Squad agent writes (commits, PR reviews, issue
comments) appear under the human operator's GitHub account. This makes audit
trails useless and violates the principle of least privilege. With one GitHub App
per agent role, you get per-role attribution, fine-grained permissions, and
instant revocation if a credential leaks.

## Prerequisites

| Requirement | Check |
|-------------|-------|
| [Squad](https://github.com/bradygaster/squad) installed and initialized | `.squad/team.md` exists with agent roster |
| Node.js ≥ 18 | `node --version` |
| `gh` CLI, authenticated | `gh auth status` |
| OS keychain | macOS: built-in · Linux: `apt install libsecret-tools` · [WSL: see below](#wsl-ubuntu) |
| GitHub org/repo admin | Ability to create and install GitHub Apps |

---

## Quick start

### Step 0: Install and initialize Squad

[Squad](https://github.com/bradygaster/squad) is the AI team orchestrator that
`squad-identity` extends. Your repo must have Squad initialized before adding
identity governance.

```bash
# Install the Squad CLI globally
npm install -g @bradygaster/squad-cli

# In your project repo (must be a git repo)
cd /path/to/your-project
squad init
```

**✓ Validate:** `.squad/team.md` exists with your agent roster defined.

Then open a Copilot CLI session to cast and confirm your team:

```bash
copilot --agent squad
```

Tell Squad what you're building — it will propose a team. Confirm with "yes".
Once you have agents with roles in `.squad/team.md`, proceed to Step 1.

### Step 1: Install and configure squad-identity

```bash
# Install squad-identity
npm install -g @sabbour/squad-identity

# Init the identity layer in your Squad repo
squad-identity init

# Guided setup — creates or imports GitHub Apps, installs them, updates charters
squad-identity setup

# Restart Copilot CLI, then verify
squad-identity doctor
```

`squad-identity setup` walks you through everything:

1. Reads `.squad/team.md` to discover agent roles
2. Shows discovered roles and their status
3. For each role, offers three choices:
   - **Create** a new GitHub App (opens your browser for the manifest flow)
   - **Import** an existing GitHub App (provide app ID, slug, and PEM file)
   - **Skip** the role for now
4. Installs each app into the repository
5. Captures installation IDs
6. Injects `ROLE_SLUG` into each agent's charter

#### Importing an existing app directly

If you already have GitHub Apps created (e.g., from another repo or created
manually), you can register them without using the interactive setup:

```bash
squad-identity import-app \
  --role backend \
  --app-id 123456 \
  --app-slug my-squad-backend \
  --pem ~/Downloads/my-squad-backend.pem
```

The PEM is stored in the OS keychain and the local file is not kept. Run
`squad-identity setup` afterward to install the app into the repo and update
charters.

---

## How it works

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Copilot CLI Session                                     │
│                                                          │
│  Extension (.github/extensions/squad-identity/)          │
│  ├── extension.mjs          registers 8 tools            │
│  └── lib/                                                │
│      ├── configure-identity.mjs   charters, doctor       │
│      ├── create-app.mjs           manifest flow          │
│      ├── install-apps.mjs         install + capture ID   │
│      ├── resolve-token.mjs        JWT → install token    │
│      ├── keychain.mjs             OS keychain adapter    │
│      └── sync-secrets.mjs         keychain → GH secrets  │
│                                                          │
│  Skill (.squad/skills/squad-identity/SKILL.md)           │
│  └── Protocol agents read at spawn (Steps A-C)           │
└──────────────────────────────────────────────────────────┘
```

**Two layers, both upgrade-proof:**

1. **Extension** — registers `squad_identity_*` tools in every Copilot CLI
   session. Tools call `lib/*.mjs` directly.
2. **Skill** — protocol reference injected into every agent's context at spawn.
   Defines Steps A-C (environment setup → token resolution → inline usage) and
   lists anti-patterns that constitute governance failures.

Neither layer is in the Squad upgrade manifest — they survive all `squad upgrade`
runs.

### Token resolution flow

```
Agent reads charter → ROLE_SLUG
    │
    ▼
squad_identity_resolve_token
    │
    ├─ 1. Check env vars (CI/CD):  SQUAD_{ROLE}_APP_ID, _PRIVATE_KEY, _INSTALLATION_ID
    │
    ├─ 2. Check OS keychain:       service=squad-identity, account=app-{appId}
    │
    └─ 3. Sign JWT → POST /app/installations/{id}/access_tokens → short-lived token
```

The returned token is used **inline per-call** — never exported, never persisted.

### Enforcement across all GitHub write paths

This is protocol-based, not hook-based. Agents follow Steps A-C from `SKILL.md`:

**Step A** clears ambient credentials and redirects `GH_CONFIG_DIR` to a
throwaway path, so bare `gh` calls fail instead of silently using the human's
token.

**Step B** calls `squad_identity_resolve_token` to get the bot token.

**Step C** uses the token inline:

```bash
# gh CLI
GH_TOKEN="$TOKEN" gh pr create --title "..." --body "..."
GH_TOKEN="$TOKEN" gh api /repos/{owner}/{repo}/issues -f title="..."

# git push
git push "https://x-access-token:${TOKEN}@github.com/{owner}/{repo}.git" HEAD

# REST API (curl)
curl -H "Authorization: Bearer $TOKEN" https://api.github.com/repos/{owner}/{repo}/pulls
```

**Rules:**
- Always inline tokens per-call — `GH_TOKEN="$TOKEN" gh ...`
- Never `export GH_TOKEN` — persists in the environment, leaks via `set -x`
- Never echo/print tokens — they appear in logs
- Never store tokens in files — they're short-lived (1 hour)

---

## CLI commands

| Command | Description |
|---------|-------------|
| `squad-identity init [repo]` | Install extension, skill, and config template into a Squad repo |
| `squad-identity setup [repo]` | Guided setup: discover roles, create/import apps, install, update charters |
| `squad-identity import-app --role <r>` | Register an existing GitHub App for a role (provide app ID, slug, PEM) |
| `squad-identity upgrade [repo]` | Refresh extension files and copilot-instructions identity block |
| `squad-identity rotate-key --role <r>` | Rotate a GitHub App private key (two-step guided flow) |
| `squad-identity doctor` | Health check: config, keychain, token resolution |
| `squad-identity status` | Show identity configuration and registered apps |
| `squad-identity sync-secrets` | Upload keychain credentials to GitHub Actions repo secrets |

## Copilot CLI tools

After restarting Copilot CLI, these tools are available in every session:

**Admin tools:**

| Tool | What it does |
|------|-------------|
| `squad_identity_setup_steps` | Print step-by-step setup instructions |
| `squad_identity_setup_all` | Show current status and guide to full CLI setup |
| `squad_identity_status` | Show agentNameMap and registered apps |
| `squad_identity_doctor` | Health check (config, keychain, token resolution) |
| `squad_identity_update_charters` | Infer role slugs from `team.md`, inject `ROLE_SLUG` into charters |
| `squad_identity_update_copilot_instructions` | Restore identity block in `copilot-instructions.md` |

**Agent runtime tools:**

| Tool | What it does |
|------|-------------|
| `squad_identity_resolve_token` | Resolve bot token for the current agent's `ROLE_SLUG` |
| `squad_identity_rotate_key` | Rotate a GitHub App private key (guided browser + keychain flow) |

---

## Token Lease Protocol

Squad Identity uses a **token lease system** to enforce least-privilege access. Instead of agents resolving tokens directly, the coordinator issues time-bound, operation-counted leases.

### How It Works

1. **Coordinator issues lease** before spawning an agent:
   ```bash
   squad-identity lease-token --role backend --max-ops 5 --max-time 600
   # Returns: { "scopeId": "lease_abc123...", "deadlineUnix": ..., "remainingOps": 5 }
   ```

2. **Agent exchanges lease** for token when making GitHub API calls:
   ```bash
   node .squad/scripts/exchange-lease.mjs --scope-id lease_abc123... --role backend
   # Returns: { "token": "ghs_...", "remainingOps": 4 }
   ```

3. **Lease expires** automatically after time or ops exhaustion — agent must request a new one.

### Lease Properties

| Property | Default | Description |
|----------|---------|-------------|
| `maxOps` | 3 | Maximum token exchanges allowed |
| `maxTime` | 300s | Lease lifetime in seconds |

### Fail-Closed Design

- Expired lease → exchange throws error
- Exhausted ops → exchange throws error
- Role mismatch → exchange throws error
- Revoked lease → exchange throws error

Agents cannot bypass the lease system. Direct token resolution is blocked when governance mode is enabled.

---

## Pre-Merge Governance

Branch protection rules are enforced locally before PRs are opened.

### Configuration

In `.squad/identity/config.json`:
```json
{
  "branches": {
    "main": {
      "required_workflows": ["ci.yml", "lint.yml"],
      "required_labels": ["approved"]
    }
  }
}
```

### Usage

```bash
squad-identity premerge-check --target-branch main --repo-root .
# Returns: { "pass": true/false, "branch": "main", "missing": [...], "present": [...] }
```

Agents run this before opening PRs. If `pass` is false, the PR must not be opened.

---

## Credential storage

PEM private keys are stored in the **OS keychain** — never on the filesystem.

| Priority | Source | When |
|----------|--------|------|
| 1 | Environment variables | CI/CD: `SQUAD_{ROLE}_APP_ID`, `SQUAD_{ROLE}_PRIVATE_KEY`, `SQUAD_{ROLE}_INSTALLATION_ID` |
| 2 | OS keychain | Local: macOS Keychain (`security`) · Linux/WSL libsecret (`secret-tool`) |

When `squad-identity setup` or `create-app.mjs` creates an app, the PEM key goes
straight into the OS keychain (keyed by app ID). No `.pem` file is left on disk.

### Syncing to CI/CD

Upload keychain credentials to GitHub Actions secrets:

```bash
squad-identity sync-secrets          # upload all roles
squad-identity sync-secrets --check  # dry-run
```

---

## GitHub App creation details

`squad-identity setup` (or `create-app.mjs` for a single role) uses GitHub's
[app manifest flow](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest):

1. Starts a local HTTP server on `localhost:3456`
2. Opens your browser to `https://github.com/settings/apps/new` with a pre-filled manifest
3. You click **Create GitHub App** in the browser
4. GitHub redirects back to localhost with a temporary code
5. The CLI exchanges the code for app credentials (appId, slug, PEM key)
6. PEM is stored in the OS keychain; config written to `.squad/identity/apps/{role}.json`

### Permissions (set automatically by the manifest)

| Permission | Level | Used for |
|-----------|-------|----------|
| `contents` | Read & write | Commits, branches, push |
| `pull_requests` | Read & write | Create, review, comment on PRs |
| `issues` | Read & write | Comment, label, close issues |
| `metadata` | Read-only | Repository metadata |
| `statuses` | Read & write | Commit status checks |

### Repository access

After creation, `install-apps.mjs` installs the app into your repo and captures
the `installationId`. If you need to change this later:

GitHub org settings → Developer settings → GitHub Apps → your app → Install →
select repositories.

---

## Key rotation

GitHub does **not** provide an API to regenerate private keys — you must use
the GitHub UI.

**Via CLI:**

```bash
# Step 1: Open the app's settings page, generate a new key in the browser
squad-identity rotate-key --role backend

# Step 2: Import the downloaded PEM into the OS keychain
squad-identity rotate-key --role backend --pem ~/Downloads/squad-backend*.pem
```

**Via Copilot CLI tool:**

```
squad_identity_rotate_key  role=backend                   # Step 1: opens browser
squad_identity_rotate_key  role=backend pemPath=<path>    # Step 2: imports PEM
```

After importing, delete the old key from the GitHub App settings page and remove
the downloaded `.pem` file from disk. Run `squad-identity doctor` to verify.

### Credential leak response

> GitHub App private keys have **no expiry**. If a PEM key leaks, rotate immediately.

**Signs of a leak:**
- `-----BEGIN RSA PRIVATE KEY-----` in output, logs, or chat
- `ghs_` tokens in committed code
- Unexpected `[bot]` writes in the GitHub audit log

**Response:**

1. Go to `https://github.com/organizations/{org}/settings/apps/{app-slug}/advanced`
2. Delete the leaked private key
3. Generate a new key → download the `.pem`
4. `squad-identity rotate-key --role {role} --pem ~/Downloads/new-key.pem`
5. `rm ~/Downloads/new-key.pem`
6. `squad-identity sync-secrets` (if using CI/CD)
7. `squad-identity doctor`
8. File a post-mortem issue with label `governance:key-rotation`

---

## Role slug derivation

`squad-identity setup` (or `configure-identity.mjs --update-charters`) reads the
`| Name | Role |` table in `.squad/team.md`, matches each agent's role
description against a keyword map, and derives the role slug from registered app
names. The result is stored as `agentNameMap` in `.squad/identity/config.json`
and a `ROLE_SLUG="<slug>"` line is injected into each charter.

No hardcoded name tables — works with any Squad character set.

---

## Upgrading

```bash
npm install -g @sabbour/squad-identity@latest
squad-identity upgrade
```

`upgrade` refreshes extension files and reapplies the identity block in
`copilot-instructions.md`. It never touches `config.json` or keychain keys.

If roles or charters changed:

```bash
squad_identity_update_charters
squad_identity_update_copilot_instructions
```

---

## WSL (Ubuntu)

WSL uses the Linux keychain (`libsecret` + `secret-tool`), **not** the Windows
Credential Manager. This requires D-Bus and a secrets service inside WSL.

### Setup

```bash
# 1. Install dependencies
sudo apt update && sudo apt install libsecret-tools gnome-keyring dbus-x11

# 2. Add to ~/.bashrc or ~/.zshrc
if [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
  eval "$(dbus-launch --sh-syntax)"
fi

# 3. Unlock the keyring (once per terminal session)
echo "" | gnome-keyring-daemon --unlock --components=secrets

# 4. Verify
echo "test" | secret-tool store --label="test" service test-svc account test-acct
secret-tool lookup service test-svc account test-acct   # → "test"
secret-tool clear service test-svc account test-acct    # clean up
```

> **Tip:** Add the keyring unlock to your shell profile for automatic startup.

### Browser in WSL

`squad-identity setup` opens your browser for the manifest flow. In WSL:
- If the browser doesn't open automatically, copy the URL from terminal output
  and open it in your Windows browser
- The `localhost:3456` callback works because WSL shares the network stack with
  Windows

### WSL troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot autolaunch D-Bus` | Add `eval "$(dbus-launch --sh-syntax)"` to shell profile, restart terminal |
| `No such interface` on secret-tool | Run `gnome-keyring-daemon --unlock --components=secrets` |
| `keychain not available` | Verify D-Bus and keyring are both running (test with `secret-tool store`/`lookup`) |
| Browser doesn't open | Copy the URL and paste into Windows browser |
| `gh auth status` fails | Run `gh auth login` inside WSL (separate from Windows `gh`) |

### Alternative: environment variables

If keychain setup is impractical, bypass it with env vars:

```bash
export SQUAD_BACKEND_APP_ID="123456"
export SQUAD_BACKEND_PRIVATE_KEY="$(cat /path/to/key.pem)"
export SQUAD_BACKEND_INSTALLATION_ID="789012"
```

Environment variables take priority over the keychain.

---

## Troubleshooting

### "You don't have permission to create apps"

You need "Organization Owner" or "App Manager" role. Contact your org admin.

### "Invalid Redirect URL" during app creation

The local server on `localhost:3456` handles the redirect. Ensure no other
process is using that port.

### "Token resolution failed"

1. `squad_identity_status` — check that the role is registered
2. `squad_identity_doctor` — check PEM is in keychain and token resolves
3. Verify app is installed in the repo

### "Keychain not available"

- **macOS:** Built-in — should work out of the box
- **Linux:** `apt install libsecret-tools`
- **WSL:** See [WSL setup](#wsl-ubuntu) above

### "PEM import failed"

1. Validate the PEM: `openssl rsa -in key.pem -check`
2. Re-download from GitHub App settings → Private keys → Generate
3. `squad-identity rotate-key --role {role} --pem /path/to/key.pem`

---

## File layout (after init)

```
.squad/
  identity/
    config.json                  # Agent name ↔ role slug ↔ app ID mapping
    apps/{role}.json             # Per-role app registration (appId, slug, installationId)
  skills/
    squad-identity/SKILL.md      # Protocol reference (read by agents at spawn)
  agents/{name}/
    charter.md                   # Contains ROLE_SLUG="<slug>"

.github/
  extensions/squad-identity/
    extension.mjs                # Tool registration
    lib/*.mjs                    # Lib scripts (called by tools directly)

OS Keychain
  service: squad-identity
  account: app-{appId}           # PEM private key per GitHub App
```

---

## Attestation Audit Trail

Every bot-authored GitHub write is recorded in an append-only audit log for compliance and debugging.

### What Gets Recorded

After any GitHub write (PR creation, comment, push, label), agents record:

```json
{
  "attestation_id": "attest_abc123...",
  "timestamp": 1714400000,
  "write_type": "pr-create",
  "owner": "myorg",
  "repo": "myrepo",
  "write_ref": "42",
  "role_slug": "backend",
  "expected_actor": "squad-identity-backend[bot]",
  "actual_actor": "squad-identity-backend[bot]",
  "actor_match": true
}
```

### Usage

**Record + verify (recommended):**
```bash
squad-identity attest-write \
  --owner myorg --repo myrepo \
  --write-type pr-create --write-ref 42 \
  --role-slug backend \
  --expected-actor "squad-identity-backend[bot]" \
  --token ghs_xxx
```

**Record without verification:**
```bash
squad-identity attest-write --no-verify ...
```

**Query attestations:**
```bash
# List today's attestations
squad-identity attest-list --date today

# Filter by role
squad-identity attest-list --role-slug backend

# Verify a specific attestation
squad-identity attest-verify --attestation-id attest_abc123
```

### Log Storage

- Location: `.squad/attestation/log-YYYYMMDD.jsonl`
- Rotation: Daily (one file per UTC day)
- Format: Newline-delimited JSON (append-only)
- **Not committed to git** — add `.squad/attestation/` to `.gitignore`

### Actor Verification

When `--no-verify` is not set, the tool calls the GitHub API to confirm the actual author of the write matches the expected bot identity. Mismatches are flagged in the log with `"actor_match": false`.

---

## Development

```bash
npm test                   # 163 tests (node --test)
npm run test:watch         # watch mode
node --check bin/squad-identity.mjs   # syntax check
```

---

## License

MIT
