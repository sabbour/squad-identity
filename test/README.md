# Squad Identity Test Suite

Tests for the `@sabbour/squad-identity` bot identity governance package.
All tests use Node.js built-in `node:test` module (Node 18+).

## Running Tests

```bash
npm test                # run all tests
npm run test:watch      # watch mode (Node 19+)
node --test test/cli.test.mjs   # run a specific file
```

## Test Files

| File | Tests | What it covers |
|------|-------|---------------|
| `cli.test.mjs` | ~30 | CLI integration: init, upgrade, doctor, status, setup preflight, negative paths, idempotency |
| `configure-integration.test.mjs` | ~9 | configure-identity.mjs: --status, --doctor, --update-charters, --update-copilot-instructions, role inference |
| `extension.test.mjs` | ~17 | Extension source analysis: 8 tool registrations, descriptions, handler wiring, structure |
| `package-assets.test.mjs` | ~13 | Package smoke: all init-copied files exist, npm pack includes them, syntax checks, config template, SKILL.md |
| `keychain.test.mjs` | ~12 | Keychain module: exports, account key gen, availability caching, graceful degradation |
| `resolve-token.test.mjs` | ~28 | Unit: role normalization, base64url encoding, JWT structure, config parsing, token format |

### Integration vs Unit

- **Integration tests** (`cli.test.mjs`, `configure-integration.test.mjs`): create fresh temp git repos, run the real CLI binary via subprocess, verify actual file creation and modification.
- **Source analysis tests** (`extension.test.mjs`): parse extension.mjs source to verify tool registrations without requiring the Copilot SDK.
- **Package tests** (`package-assets.test.mjs`): verify `npm pack` includes everything `init` copies.
- **Unit tests** (`keychain.test.mjs`, `resolve-token.test.mjs`): test exported functions and logic patterns.

## Test helpers

`helpers.mjs` provides:
- `createFixtureRepo({ teamMd, charters })` — fresh temp dir with git init, optional team.md and charter files
- `cleanupFixture(dir)` — rm -rf the temp dir
- `runCli(args, { cwd })` — spawn the CLI binary, capture stdout/stderr/status
- `runLib(script, args, { cwd })` — run a lib script directly

## Adding Tests

1. Create `test/my-feature.test.mjs`
2. Import helpers from `./helpers.mjs`
3. Use `describe`/`it` from `node:test` and `assert` from `node:assert/strict`
4. For integration tests: use `createFixtureRepo()` + `runCli()` + `cleanupFixture()`
5. Run `npm test` to verify
