# Identity Rotation Runbook

Use this runbook when a credential leak is detected or suspected.

> **Rule:** GitHub's scanner automatic revocation is a safety net — not the
> primary control. The GitHub App private key has **no expiry**. If a PEM key
> leaks, rotate it immediately regardless of scanner status.

---

## Leak Detection Signals

- `ghs_`, `ghp_`, `gho_`, `ghu_`, `ghr_`, `ghe_`, `github_pat_` in any output
- `-----BEGIN RSA PRIVATE KEY-----` or `-----BEGIN EC PRIVATE KEY-----` in any output
- `Authorization: Bearer ...` in logs or chat
- Post-flight check exits 2 (mismatch, revoke failed)
- Unexpected `[bot]` writes in GitHub audit log

---

## Step 1 — Determine scope

```bash
# Which role's key leaked?
# Check git log, chat history, CI logs for the token prefix
# ghs_ = installation access token (short-lived, GitHub may auto-revoke)
# PEM fragment = private key (long-lived — MUST manually rotate)
```

---

## Step 2 — Revoke the App private key immediately

1. Go to: `https://github.com/organizations/{org}/settings/apps/{app-slug}/advanced`
   or for personal: `https://github.com/settings/apps/{app-slug}/advanced`
2. Under **Private keys**, delete the leaked key
3. Generate a new private key — download the `.pem` file

---

## Step 3 — Replace the key on disk

```bash
# Old key location (from config.json keysDir)
KEYS_DIR=$(node .squad/scripts/configure-identity.mjs --status | grep keysDir | awk '{print $2}')
# or check .squad/identity/config.json directly

# Replace the .pem file
cp ~/Downloads/your-app-slug.YYYY-MM-DD.private-key.pem "$KEYS_DIR/{role-slug}.pem"
chmod 600 "$KEYS_DIR/{role-slug}.pem"
```

---

## Step 4 — Rotate GitHub Actions secrets

```bash
node .squad/scripts/sync-secrets.mjs
```

This re-uploads the PEM and app metadata as repo secrets.

---

## Step 5 — Verify

```bash
node .squad/scripts/configure-identity.mjs --doctor
```

Confirm token resolution succeeds for the rotated role.

---

## Step 6 — File a post-mortem

Open an issue in this repo with label `governance:key-rotation`:
- What leaked (role slug, token type)
- Where it appeared
- When detected vs when it was created
- Remediation taken

---

## Prevention

- **Never commit** `.squad/identity/keys/*.pem` — add to `.gitignore`
- **Never `echo "$TOKEN"`** or print token values in any context
- **Never use `export GH_TOKEN`** — use inline `GH_TOKEN="$TOKEN" gh ...`
- See `.squad/skills/squad-identity/SKILL.md` Anti-Patterns section
