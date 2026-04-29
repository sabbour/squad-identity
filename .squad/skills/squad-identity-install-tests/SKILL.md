---
name: "squad-identity-install-tests"
description: "Reusable manual test plan for the squad-identity npm package, postinstall sync, CLI init/upgrade/doctor/status behavior, and legacy install shim."
domain: "testing"
confidence: "low"
source: "first observation — designed ahead of Tank's npm CLI implementation on 2026-04-28T14:01:29.939-07:00"
---

# Squad Identity Install Test Plan

Confidence: **low — first observation**.

## When to use

Use this skill before accepting changes to the `@sabbour/squad-identity` npm package, `squad-identity` CLI, global postinstall sync, per-repo `init`/`upgrade`, or the legacy `install.sh` shim. Pass/fail requires asserted exit codes, filesystem checks, and secret-hygiene checks — not just “looks right.”

## Assumptions for reproducible runs

- Prefer a disposable clone of this repository and a project-local sandbox such as `.sandbox/squad-identity-install/`; do **not** use system temp directories.
- For pre-publish PR verification, replace registry installs with `npm pack` plus `npm install -g ./sabbour-squad-identity-*.tgz --prefix "$PREFIX"` where `$PREFIX` and `$HOME` point into `.sandbox/`.
- For published-package verification, use `PKG=@sabbour/squad-identity`; if the package is temporarily unscoped, rerun the same cases with `PKG=squad-identity` and record the package name tested.
- On Windows, run equivalent commands in PowerShell and verify paths with `Join-Path`-style expectations.

## Test scenarios

| ID | Scenario | Setup | Command | Expected Exit | Expected Outcome |
|---|---|---|---|---:|---|
| A1 | Fresh global npm install creates the Copilot extension | Start with an isolated home: `export HOME="$PWD/.sandbox/squad-identity-install/home-a1"`; remove any previous sandbox home/prefix. Ensure `"$HOME/.copilot/extensions"` does not exist. Use a published package or local tarball. | `npm install -g "$PKG" --prefix "$PWD/.sandbox/squad-identity-install/prefix-a1"` | 0 | `"$HOME/.copilot/extensions/squad-identity/"` exists. `extension.mjs` exists. `lib/` contains the expected `*.mjs` files copied from the package. Output indicates global sync/install completed. Rationale: proves postinstall bootstraps a first-time user with no Copilot extension tree. |
| A2 | Re-running global npm install is idempotent | Use the same sandbox from A1. Record checksums or mtimes for `extension.mjs` and `lib/*.mjs`. | `npm install -g "$PKG" --prefix "$PWD/.sandbox/squad-identity-install/prefix-a1"` | 0 | No duplicate directories. Files are present and updated from the current package payload. Existing unrelated files under `~/.copilot/extensions/` remain untouched. Rationale: upgrades and re-installs must be safe. |
| A3 | Global npm uninstall removes package but may leave synced extension files | Use the installed prefix/home from A1/A2. | `npm uninstall -g "$PKG" --prefix "$PWD/.sandbox/squad-identity-install/prefix-a1"` | 0 | `npm list -g --depth=0 --prefix "$PREFIX"` no longer lists the package. `"$HOME/.copilot/extensions/squad-identity/"` may still exist. Document lingering extension files as a known npm lifecycle limitation; a future `squad-identity unsync` can clean them. Rationale: prevents false failures and sets uninstall expectations. |
| B4 | Local npm install does not mutate user Copilot extensions | Fresh target project: `mkdir -p .sandbox/squad-identity-install/local-project && cd` into it. Set isolated `HOME` with no `.copilot/extensions`. | `npm install "$PKG"` | 0 | Postinstall detects `npm_config_global !== 'true'`, prints guidance to run `squad-identity init`, and does **not** create or modify `"$HOME/.copilot/extensions/"`. `node_modules/$PKG` is installed normally. Rationale: local dependency installation must not have global side effects. |
| C5 | CLI help and version are usable | Ensure package binary is on `PATH` from global install, or run via `npx squad-identity`. | `squad-identity --help`<br>`squad-identity --version` | 0 for each | Help includes available subcommands (`init`, `upgrade`, `doctor`, `status`). Version matches package metadata. No stack traces. Rationale: confirms executable wiring and basic UX. |
| C6 | `init` with no target arg inside a Squad repo provisions files | In a disposable git repo with `.squad/team.md` and no `.github/extensions/squad-identity/`, no `.squad/skills/squad-identity/`, no `.squad/identity/config.json`. Run from repo root. | `squad-identity init` | 0 | Copies extension to `.github/extensions/squad-identity/extension.mjs` and `.github/extensions/squad-identity/lib/*.mjs`. Copies skill to `.squad/skills/squad-identity/SKILL.md`. Creates `.squad/identity/config.json` from `identity/config.json.template`. Creates/keeps identity runbook if implemented. Output names target repo. Rationale: replaces the common `install.sh` path. |
| C7 | `init` rejects non-existent explicit target | Ensure `.sandbox/squad-identity-install/missing-target` does not exist. | `squad-identity init "$PWD/.sandbox/squad-identity-install/missing-target"` | 1 | Clear error states the target directory does not exist or is not accessible. No parent directories or partial files are created. Rationale: path validation must fail closed. |
| C8 | `init` preserves existing identity config | In a disposable repo, pre-create `.squad/identity/config.json` containing sentinel JSON, for example `{ "sentinel": "keep-me" }`. | `squad-identity init "$PWD/.sandbox/squad-identity-install/repo-with-config"` | 0 | Extension and skill files are synced. Existing `.squad/identity/config.json` byte-for-byte remains unchanged. Output says config already exists/not overwritten. Rationale: user app IDs and key paths are sensitive configuration. |
| C9 | `upgrade` re-syncs package files but never touches config or PEM keys | Initialize a repo, then modify/delete `.github/extensions/squad-identity/extension.mjs` to simulate drift. Place sentinels in `.squad/identity/config.json` and `.squad/identity/keys/*.pem`. | `squad-identity upgrade "$PWD/.sandbox/squad-identity-install/initialized-repo"` | 0 | Extension and skill files are restored from package payload. `.squad/identity/config.json` is unchanged. `*.pem` files are unchanged and not read into output. Rationale: upgrades must fix code drift without rotating secrets. |
| C10 | `doctor` with no config fails diagnostically | In a git repo with no `.squad/identity/config.json`. | `squad-identity doctor` | Non-zero (prefer 1) | Output states no identity config found and suggests `squad-identity init` or charter/config setup. No unhandled exception. Rationale: missing config is a blocking health failure. |
| C11 | `doctor` with valid config and valid PEM passes | Use a disposable repo configured with a real test GitHub App installation, valid `agentNameMap`, valid app ID/slug, valid private key path, and the required scripts copied by `init`/`upgrade`. Do not commit credentials. | `squad-identity doctor` | 0 | All checks are green: config found, agent map present, app(s) registered, PEM found, resolver accessible, token resolution succeeds. Output may show token length but never token value or PEM content. Rationale: proves end-to-end identity health. |
| C12 | `status` with no config fails | In a git repo with no `.squad/identity/config.json`. | `squad-identity status` | 1 | Output includes `no config found` or equivalent and points to next setup step. Rationale: status must not imply health when configuration is absent. |
| C13 | `status` with valid config prints mapping | In a repo with `.squad/identity/config.json` containing at least `agentNameMap` and `apps` entries. PEM/token validity is not required for status. | `squad-identity status` | 0 | Prints `agentNameMap`/agent-to-role mapping and registered app slugs/IDs. Does not print private key material. Rationale: operators need safe visibility without token resolution. |
| C14 | Unknown subcommand fails and prints help | Any directory. | `squad-identity bogus-subcommand` | Non-zero (prefer 1) | Output clearly states unknown command and includes help/usage. No files are written. Rationale: prevents silent no-op or accidental default behavior. |
| D15 | Cross-platform path resolution uses home/path APIs | Run A1, C6, and C8 on Linux, macOS, and Windows. On Windows use PowerShell with an isolated `$env:USERPROFILE`/`$env:HOME` where supported and verify path separators. | Linux/macOS: commands above.<br>Windows: `squad-identity init .\sandbox\repo` and global install with an isolated prefix/home. | 0 for valid commands | Files are written under the platform home (`os.homedir()` equivalent) and target repo using platform separators. No literal `~/`, `/home/`, `/Users/`, or hardcoded slash assumptions appear in created paths or error messages. Rationale: CLI must use `os.homedir()` and `path.join`. |
| D16 | CI global install skips user-home writes | Isolated home with no `.copilot/extensions`. Set `CI=true`. Use global install command with sandbox prefix. | `CI=true npm install -g "$PKG" --prefix "$PWD/.sandbox/squad-identity-install/prefix-ci"` | 0 unless spec changes | Package installs, but `"$HOME/.copilot/extensions/"` is not created or modified. Output says global sync was skipped because CI is detected and suggests `squad-identity init` or manual sync for interactive use. Rationale: CI jobs must not mutate a runner user profile. |
| E17 | Legacy `install.sh` remains a deprecated shim | From this repository root, create a disposable target git repo with `.squad/team.md`. Ensure target has no installed extension/skill/config. | `bash install.sh "$PWD/.sandbox/squad-identity-install/legacy-target"` | 0 | Output includes a deprecation notice directing users to `squad-identity init`. Legacy behavior still works: extension copied to `.github/extensions/squad-identity/`, skill copied to `.squad/skills/squad-identity/SKILL.md`, config template created only if absent, existing config preserved on re-run. Rationale: backward compatibility for current users. |
| F18 | CLI output never leaks token-like strings or PEM material | In repos from C10/C11/C13, capture stdout/stderr for all subcommands. If a verbose/debug mode exists, enable it. Also run one negative argument-scrubbing probe with fake token-like args using a child process capture, not shell xtrace, so shell tracing does not contaminate output. | Example capture: `squad-identity --help > .sandbox/squad-identity-install/help.log 2>&1` and repeat for `--version`, `init`, `upgrade`, `doctor`, `status`, `bogus-subcommand`.<br>Probe: run `squad-identity status --token ghs_FAKE_SHOULD_NOT_PRINT` and capture CLI stdout/stderr. Then search logs for `ghs_`, `ghp_`, `github_pat_`, `-----BEGIN`, `PRIVATE KEY`. | 0/non-zero per command-specific scenarios; grep/search for secrets exits 1/no matches | No CLI-produced stdout/stderr contains token-like prefixes or PEM boundaries/material. Doctor may print token length only. Wrapper must not echo full argv when errors occur. Rationale: install/dispatch changes must not regress secret hygiene. |

## Edge cases to watch

- Idempotency: `init`, `upgrade`, and global postinstall must tolerate existing directories and partial previous installs.
- Config preservation: `.squad/identity/config.json` and `*.pem` files are user-owned; sync/upgrade must not overwrite, delete, chmod unexpectedly, or print them.
- CI detection: `CI=true` should skip home mutation while still allowing the package install to succeed; if Morpheus changes this, update scenario D16 and the decision record.
- Scoped vs unscoped package name: run the same matrix against `@sabbour/squad-identity` and any temporary unscoped fallback, but record which artifact was tested.
- Postinstall failure modes: permission-denied home, read-only prefix, missing `HOME`, and package payload missing `extension.mjs` should produce clear warnings/errors with deterministic exit behavior.
- Cross-platform paths: test spaces in repo paths (for example `.sandbox/squad identity install/repo with spaces`) and Windows path separators.
- Worktree targets: `init` with no target arg should resolve the actual git worktree root, not the package install location.
- npm lifecycle differences: uninstall should not be expected to remove synced files unless a future explicit `unsync` command exists.
- Output assertions: assert exit code and filesystem state first; stdout wording can vary except for required diagnostics such as deprecation and no-config messages.

## Manual verification checklist

- [ ] A1 fresh global install exits 0 and creates `~/.copilot/extensions/squad-identity/{extension.mjs,lib/*.mjs}`.
- [ ] A2 repeated global install exits 0 and updates files without duplicates.
- [ ] A3 global uninstall exits 0; package is removed; lingering synced extension is documented as allowed.
- [ ] B4 local install exits 0, prints `squad-identity init` guidance, and does not touch `~/.copilot/extensions/`.
- [ ] C5 `--help` and `--version` both exit 0 with useful output.
- [ ] C6 `init` inside a Squad repo exits 0 and creates extension, skill, and config template.
- [ ] C7 `init <missing-dir>` exits 1 and writes no files.
- [ ] C8 `init` preserves an existing `.squad/identity/config.json` exactly.
- [ ] C9 `upgrade` re-syncs extension/skill files and leaves config plus PEM keys unchanged.
- [ ] C10 `doctor` with no config exits non-zero with a helpful diagnostic.
- [ ] C11 `doctor` with valid config and PEM exits 0 with all-green checks and no secret output.
- [ ] C12 `status` with no config exits 1 and says no config found.
- [ ] C13 `status` with valid config exits 0 and prints `agentNameMap`.
- [ ] C14 bogus subcommand exits non-zero and prints help.
- [ ] D15 Linux, macOS, and Windows path checks pass without hardcoded home/path assumptions.
- [ ] D16 `CI=true npm install -g` exits 0 and does not write to user home.
- [ ] E17 `bash install.sh <target>` exits 0, prints deprecation, and still performs legacy install behavior.
- [ ] F18 captured CLI stdout/stderr contains no `ghs_`, `ghp_`, `github_pat_`, PEM boundary, or private-key material.
