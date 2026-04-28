#!/usr/bin/env bash
# install.sh — Install squad-identity into a Squad repo
#
# Usage (from within squad-identity repo):
#   bash install.sh [/path/to/target-repo]
#
# If no target repo is given, installs into the current git repo.

set -euo pipefail

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve target repo
if [ -n "${1:-}" ]; then
  TARGET_REPO="$(cd "$1" && pwd)"
else
  TARGET_REPO="$(git -C "$SOURCE" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"
fi

echo "🔧 Installing squad-identity into: $TARGET_REPO"
echo

# ── Extension ───────────────────────────────────────────────────────────────

EXT_DIR="$TARGET_REPO/.github/extensions/squad-identity"
EXT_LIB="$EXT_DIR/lib"

mkdir -p "$EXT_LIB"
cp "$SOURCE/extensions/squad-identity/extension.mjs" "$EXT_DIR/"
cp "$SOURCE/extensions/squad-identity/lib/"*.mjs "$EXT_LIB/"

echo "✅ Extension installed → $EXT_DIR"

# ── Skill ───────────────────────────────────────────────────────────────────

SKILL_DIR="$TARGET_REPO/.squad/skills/squad-identity"
mkdir -p "$SKILL_DIR"
cp "$SOURCE/squad-identity/SKILL.md" "$SKILL_DIR/SKILL.md"

echo "✅ Skill installed    → $SKILL_DIR/SKILL.md"

# ── Identity template (only if not already configured) ─────────────────────

IDENTITY_DIR="$TARGET_REPO/.squad/identity"
CONFIG_FILE="$IDENTITY_DIR/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
  mkdir -p "$IDENTITY_DIR"
  cp "$SOURCE/identity/config.json.template" "$CONFIG_FILE"
  echo "✅ Identity config    → $CONFIG_FILE (template — fill in your app details)"
else
  echo "✓  Identity config already exists — not overwritten"
fi

# Copy rotation runbook if not present
RUNBOOK="$IDENTITY_DIR/README.md"
if [ ! -f "$RUNBOOK" ]; then
  cp "$SOURCE/identity/README.md" "$RUNBOOK"
  echo "✅ Rotation runbook   → $RUNBOOK"
fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ squad-identity installed successfully."
echo
echo "Next steps:"
echo "  1. Restart Copilot CLI to load the extension"
echo "  2. Call: identity_setup_steps"
echo "     (for first-time setup with no GitHub Apps yet)"
echo "  3. Or if Apps already exist:"
echo "     identity_update_charters"
echo "     identity_doctor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
