---
name: "release-insider"
description: "Ship features to early adopters via the insider pre-release channel"
domain: "release"
confidence: "low"
source: "manual"
---

## Context

The `insider` branch publishes pre-release versions to the `@insider` npm tag. Use this channel when:
- A new feature or fix is ready for early adopters to validate
- The code has passed local tests and CI is green
- You want feedback before shipping to stable (`@latest`)

The insider workflow is fully automated: push commits, add changesets, and the CI publishes a pre-release package (e.g., `1.1.0-insider.0`). No manual version bumping.

## Patterns

### 1. Prepare Work on `insider` Branch

All feature work for insider starts on `insider`, not `main`:

```bash
git checkout insider
git pull origin insider
git checkout -b squad/{issue-number}-{slug}
```

### 2. Add a Changeset for Your Changes

Before pushing, run:

```bash
npx changeset
```

This opens a prompt:
- **Select packages:** Choose the affected package (usually `@sabbour/squad-identity`)
- **Bump type:** Select `minor` (new feature) or `patch` (fix)
- **Summary:** Describe the change in one sentence

The changeset file is created in `.changeset/{generated-id}.md`. Commit it:

```bash
git add .changeset/{generated-id}.md
git commit -m "changeset: describe your change"
```

### 3. Push and Create PR

```bash
git push -u origin squad/{issue-number}-{slug}
gh pr create --base insider --title "feat: your feature" --body "Closes #{issue-number}"
```

### 4. The "Version Packages (insider)" PR

Once your PR merges to `insider`, the release workflow automatically:
1. Collects all pending changesets
2. Creates a "Version Packages (insider)" PR
3. Updates `package.json` version to the next pre-release (e.g., `1.1.0-insider.0`)
4. Updates `CHANGELOG.md` with all changes since the last version

**What to do:** Review the PR to ensure the version bump and changelog entries look correct. Then merge it. CI will automatically publish the new version to npm under the `@insider` tag.

### 5. Confirm Publication

After the "Version Packages (insider)" PR is merged, GitHub Actions publishes the package:

```bash
# Install and test the insider version locally
npm install @sabbour/squad-identity@insider
squad-identity --version
```

You should see the new pre-release version (e.g., `1.1.0-insider.0`).

## Examples

**Example: Shipping a bug fix to insider**

```bash
git checkout insider && git pull origin insider
git checkout -b squad/123-fix-token-resolution

# Make your changes
npx changeset
# → select package, patch bump, enter "fix: token resolution for leased identities"

git add -A && git commit -m "fix: token resolution for leased identities"
git push -u origin squad/123-fix-token-resolution

gh pr create --base insider --title "fix: token resolution" --body "Closes #123"
# → Wait for review, merge to insider

# CI creates "Version Packages (insider)" PR → review & merge
# → npm automatically publishes 1.1.0-insider.1
```

## Anti-Patterns

- ❌ **Manual version bumping** — Never edit `package.json` version directly. Changesets handles all versioning.
- ❌ **Skipping changesets** — Every user-visible change needs a changeset entry; CI will fail if missing.
- ❌ **Publishing from local machine** — Never run `npm publish` manually. Let CI do it after PR merge.
- ❌ **Branching from `main` for insider work** — Always branch from `insider`; changes to `main` are for stable only.
- ❌ **Forgetting the changeset commit** — The changeset file must be committed and pushed; CI won't see it otherwise.
- ❌ **Merging "Version Packages (insider)" PRs without review** — Always verify the version bump and changelog entries match your expectations.
