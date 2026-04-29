---
name: "promote-to-stable"
description: "Promote validated insider features to the stable @latest npm channel"
domain: "release"
confidence: "low"
source: "manual"
---

## Context

When the `insider` branch has been validated and is ready for general release, promote it to `main` (the stable channel). The promotion is a 5-step process that keeps both branches clean:

1. Exit pre-release mode on `insider` (removes `.changeset/pre.json`)
2. Create PR from `insider` → `main`
3. Merge the PR (now `main` has changesets but no pre-release marker)
4. On `main`, merge the "Version Packages" PR (publishes stable version to `@latest`)
5. Re-enter pre-release mode on `insider` (for future insider work)

**Why this process:** The `pre.json` file must never reach `main`. It exists only on `insider` to mark pre-release versioning. Removing it before promotion ensures `main` publishes stable versions only.

## Pre-Promotion Checklist

Before starting the promotion, verify:
- ✓ All CI checks on `insider` are green
- ✓ No known regressions reported from early adopters
- ✓ The feature has soaked on `insider` for at least 24–48 hours
- ✓ You have the latest changesets merged into `insider`

## Promotion Steps

### Step 1: Exit Pre-Release on `insider`

This removes `.changeset/pre.json` from the `insider` branch:

```bash
git checkout insider
git pull origin insider

npx changeset pre exit
```

The command removes `.changeset/pre.json` and commits the change automatically (or you may need to commit manually — check git status).

Verify the change:

```bash
git log --oneline -5
# Should show a commit like "chore: remove pre-release marker" or "chore: version packages"

git status
# Should show no changes to .changeset/pre.json — it's deleted
```

Commit if needed:

```bash
git add -A
git commit -m "chore: exit pre-release mode"
```

Push to `insider`:

```bash
git push origin insider
```

### Step 2: Create PR from `insider` → `main`

```bash
gh pr create \
  --base main \
  --head insider \
  --title "chore: promote insider to stable" \
  --body "Promotes validated insider features to main.

Removes pre-release marker so main publishes stable versions.
All changesets included in this PR will bump the stable version on merge."
```

### Step 3: Merge the PR

Review the PR to confirm:
- `.changeset/pre.json` is deleted (no longer present)
- All pending changesets are present in `.changeset/`
- No other unexpected files are changed

Merge when ready:

```bash
gh pr merge {pr-number} --merge  # Use standard merge, not rebase
```

Once merged, `main` now has all the changesets but no pre-release marker.

### Step 4: Wait for and Merge the "Version Packages" PR

The release workflow on `main` automatically detects the changesets and creates a "Version Packages" PR (titled `chore: version packages`). This PR:
- Bumps the package version (e.g., `1.1.0-insider.5` → `1.1.0`)
- Updates `CHANGELOG.md` with all changes
- Removes all `.changeset/*.md` files

Review the PR and merge:

```bash
gh pr list --base main --state open
# Find the "chore: version packages" PR

gh pr merge {pr-number} --merge
```

After merge, CI automatically publishes the stable version to npm under the `@latest` tag.

Verify publication:

```bash
npm view @sabbour/squad-identity@latest version
# Should show the new stable version (e.g., 1.1.0)
```

### Step 5: Re-Enter Pre-Release Mode on `insider`

Now that `main` is at a stable version, reset `insider` to pre-release mode for future work:

```bash
git checkout insider
git pull origin insider

npx changeset pre enter insider
```

This recreates `.changeset/pre.json` on `insider`. Commit and push:

```bash
git add .changeset/pre.json
git commit -m "chore: enter pre-release mode for next insider cycle"
git push origin insider
```

## Examples

**Example: Complete promotion flow**

```bash
# Step 1: Exit pre-release on insider
git checkout insider && git pull origin insider
npx changeset pre exit
git push origin insider

# Step 2: Create PR insider → main
gh pr create --base main --head insider --title "chore: promote insider to stable"

# Step 3: Merge the PR (once approved)
gh pr merge {pr-number} --merge

# Step 4: Wait for and merge "Version Packages" PR
# (Usually appears within seconds of Step 3)
# Review version bump and changelog, then merge

# Step 5: Re-enter pre-release on insider
git checkout insider && git pull origin insider
npx changeset pre enter insider
git add .changeset/pre.json && git commit -m "chore: enter pre-release mode"
git push origin insider
```

## Anti-Patterns

- ❌ **Cherry-picking individual changesets from insider to main** — Use full PR merge instead. Cherry-picking loses changeset metadata and breaks CI.
- ❌ **Merging with `.changeset/pre.json` still present** — The pre-release marker must be removed before main merge; otherwise, main will publish pre-release versions.
- ❌ **Forgetting to re-enter pre-release on insider** — After promoting to main, re-enter pre-release mode immediately so insider stays in pre-release for future work. Forgetting causes insider to publish stable versions.
- ❌ **Manually editing version in `package.json`** — Never bump versions by hand. Let changesets and CI handle all versioning.
- ❌ **Promoting without validating on insider** — Always run the pre-promotion checklist; rushing a promotion can ship regressions.
- ❌ **Bypassing the "Version Packages" PR** — Merging insider changesets directly to main without the automated versioning PR breaks the release pipeline. Wait for CI to create it.
