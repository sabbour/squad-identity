# Key Rotation Runbook

> Rotate GitHub App private keys before leaks, periodically for audit compliance, and always after emergency response.

## Why Rotation Matters

GitHub App private keys have **no expiry**. A leaked key is valid indefinitely unless you rotate it and delete the old one. The private key is the single credential that enables all bot-authored writes — rotations are critical security incidents.

---

## When to Rotate

| Trigger | Response | Urgency |
|---------|----------|---------|
| Suspected leak (key appears in logs/chat) | Rotate immediately → verify new → delete old → audit logs | P0 |
| Quarterly audit requirement | Planned rotation during maintenance window | P2 |
| Security incident response (bot account compromise) | Rotate all roles → verify → sync to CI/CD → file post-mortem | P0 |
| Keychain access error ("PEM not readable") | Regenerate key → import new PEM → remove old from GitHub | P1 |
| Prep for staff departure | Rotate keys for roles that person managed | P1 |

---

## Rotation Process

### Prerequisites

- `squad-identity` installed: `npm install -g @sabbour/squad-identity`
- Authenticated with GitHub: `gh auth status`
- OS keychain set up (macOS: built-in · Linux: `libsecret-tools` · WSL: see below)
- Organization or repo admin permissions

### Step 1: Generate a New Key in GitHub

**Option A: CLI (guided):**
```bash
squad-identity rotate-key --role backend
# Opens browser → GitHub App settings page
```

**Option B: Manual:**
1. Go to `https://github.com/organizations/{org}/settings/apps/{app-slug}/advanced`
2. Under "Private keys", click **Generate a private key**
3. Download the `.pem` file → save to `~/Downloads/`

### Step 2: Import the PEM into OS Keychain

**Option A: CLI (guided):**
```bash
squad-identity rotate-key --role backend --pem ~/Downloads/squad-backend*.pem
# Stores key in OS keychain automatically
```

**Option B: Verify manually:**
```bash
# macOS
security find-generic-password -s squad-identity -a app-{appId} | head -5

# Linux/WSL
secret-tool search service squad-identity account app-{appId}
```

### Step 3: Delete the Old Key

1. Go to `https://github.com/organizations/{org}/settings/apps/{app-slug}/advanced`
2. Find the old key in the "Private keys" list
3. Click the trash icon to delete it
4. **Verify deletion** — refresh the page to confirm it's gone

### Step 4: Verify the Rotation

```bash
squad-identity doctor
# Output: ✅ All checks passed
#   - config.json found
#   - agentNameMap populated (N agents)
#   - All PEM keys readable from keychain
#   - Token resolution succeeds for lead role
```

If any check fails, retry Step 2 with the downloaded PEM.

### Step 5: Update CI/CD (if using GitHub Actions)

If you use GitHub Actions with bot-authored workflows:

```bash
squad-identity sync-secrets           # upload all roles
# Or check first:
squad-identity sync-secrets --check
```

This uploads the new keys to repository secrets: `SQUAD_{ROLE}_PRIVATE_KEY`.

### Step 6: Clean Up

```bash
# Remove the downloaded PEM file (never keep on disk)
rm ~/Downloads/squad-backend*.pem

# Verify keychain still has the key
squad-identity status   # shows all registered roles ✓
```

---

## Failure Cases & Recovery

### "PEM import failed"

**Symptoms:** `squad-identity doctor` reports "PEM not readable" for a role.

**Recovery:**
```bash
# Re-download the PEM from GitHub
# (Step 1 in the process above)

squad-identity rotate-key --role backend --pem ~/Downloads/squad-backend*.pem

# Verify
squad-identity doctor
```

### "Invalid PEM format"

**Symptoms:** `Could not import PEM` error.

**Recovery:**
1. Validate the PEM file: `openssl rsa -in key.pem -check`
2. If invalid, download a fresh PEM from GitHub (delete the old one first)
3. Retry import

### "Token resolution fails after rotation"

**Symptoms:** `squad_identity_resolve_token` returns an error.

**Recovery:**
```bash
squad-identity doctor
# Check the output — likely causes:
# 1. Old key still in keychain (delete and re-import)
# 2. New key not installed in repo (run squad-identity setup or refresh app)
# 3. Role name mismatch (verify via squad-identity status)
```

### Keychain is locked (Linux/WSL)

**Symptoms:** `secret-tool` commands hang or error with "D-Bus not available".

**Recovery:**
```bash
# Unlock the keyring
echo "" | gnome-keyring-daemon --unlock --components=secrets

# Add to shell profile for auto-startup:
# if [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
#   eval "$(dbus-launch --sh-syntax)"
# fi
```

---

## Emergency: Compromised Key

A leaked key is a **P0 security incident**. Treat it like an account breach.

### Immediate Actions (within 15 minutes)

1. **Confirm the leak:**
   - Check GitHub audit log for unexpected writes
   - Search logs/chat for `-----BEGIN RSA PRIVATE KEY-----` or `ghs_` tokens
   - Check `git log` for suspicious commits

2. **Rotate the key immediately:**
   ```bash
   squad-identity rotate-key --role backend
   # Generate new key in browser → download → import
   ```

3. **Delete the old key:**
   - Go to GitHub App settings → Private keys
   - Delete the leaked key
   - Verify deletion (refresh page)

4. **Verify token resolution:**
   ```bash
   squad-identity doctor
   ```

### Follow-up (within 1 hour)

5. **Audit recent writes:**
   ```bash
   # Check .squad/attestation/log-*.jsonl for unexpected writes
   # Each entry has: role_slug, expected_actor, actual_actor, actor_match
   ```

6. **Sync to CI/CD:**
   ```bash
   squad-identity sync-secrets
   # Pushes new key to GitHub Actions secrets
   ```

7. **Notify the team:**
   - File a `governance:key-rotation` issue with:
     - Role(s) affected
     - Suspected leak source
     - Time of rotation
     - New app ID (if rotated)
   - Post-mortem due within 48 hours

### Audit Trail

All bot-authored writes are recorded in `.squad/attestation/`:

```bash
# List today's attestations
ls -l .squad/attestation/log-$(date +%Y%m%d).jsonl

# Inspect an entry
cat .squad/attestation/log-20260429.jsonl | jq '.[] | select(.role_slug == "backend")'
```

Each record includes `actor_match: true/false` — if false, the actual author didn't match the expected bot, which could indicate a compromised key or role mismatch.

---

## Periodic (Quarterly) Rotation

For compliance or audit requirements, rotate all keys on a regular schedule.

### Batch Rotation

```bash
# Get list of roles
squad-identity status | grep -E 'role_slug|appSlug'

# For each role, rotate:
for role in backend frontend lead; do
  echo "Rotating $role..."
  squad-identity rotate-key --role $role
  sleep 5
done

# Verify all
squad-identity doctor
squad-identity sync-secrets
```

### Schedule

- **First Monday of every quarter** at 10 AM (off-peak)
- Post rotation notes to team channel
- File `maintenance:quarterly-rotation` issue

---

## Troubleshooting

### `gh auth status` fails

You need to authenticate with GitHub first (separate from Copilot CLI):
```bash
gh auth login
# Select: GitHub.com, SSH, authenticate
```

### `Cannot autolaunch D-Bus` (Linux/WSL)

Add to `~/.bashrc` or `~/.zshrc`:
```bash
if [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
  eval "$(dbus-launch --sh-syntax)"
fi
```

### Keychain service name mismatch

If you imported a key with a different service name, squad-identity won't find it:

```bash
# List all stored keys
security dump-keychain | grep -i squad

# If service is not "squad-identity", re-import:
squad-identity rotate-key --role backend --pem ~/Downloads/squad-backend*.pem
```

---

## References

- **Main docs:** `../README.md` — full setup and token resolution flow
- **Agent protocol:** `.squad/skills/squad-identity/SKILL.md` — Steps A-E
- **Config:** `.squad/identity/config.json` — role ↔ app mapping
- **Audit log:** `.squad/attestation/log-YYYYMMDD.jsonl` — every bot write

---

## Glossary

| Term | Definition |
|------|-----------|
| **PEM** | Private key file format (`-----BEGIN RSA PRIVATE KEY-----`) |
| **Keychain** | OS credential storage (macOS: Security.framework · Linux: libsecret · WSL: GNOME Keyring) |
| **Role slug** | Short name for an agent role (e.g., "backend", "frontend") mapped in `config.json` |
| **App ID** | GitHub App internal ID (e.g., 123456) used to key credentials |
| **Installation ID** | ID for the app installation in a specific repository |
| **Attestation** | Record of a bot-authored write for audit trail (`.squad/attestation/log-*.jsonl`) |
