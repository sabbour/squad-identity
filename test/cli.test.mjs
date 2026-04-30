/**
 * CLI integration tests — exercises the real squad-identity binary.
 * Each test suite gets a fresh temp git repo.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createFixtureRepo,
  cleanupFixture,
  runCli,
  PACKAGE_ROOT,
} from './helpers.mjs';

// ---------------------------------------------------------------------------
// Version and help
// ---------------------------------------------------------------------------

describe('CLI: version and help', () => {
  it('--version prints semver', () => {
    const { status, stdout } = runCli(['--version']);
    assert.equal(status, 0);
    assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
  });

  it('-v prints same version', () => {
    const { status, stdout } = runCli(['-v']);
    assert.equal(status, 0);
    assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
  });

  it('--help prints usage', () => {
    const { status, stdout } = runCli(['--help']);
    assert.equal(status, 0);
    assert.ok(stdout.includes('Usage:'));
    assert.ok(stdout.includes('init'));
    assert.ok(stdout.includes('setup'));
    assert.ok(stdout.includes('resolve-token'));
    assert.ok(stdout.includes('upgrade'));
    assert.ok(stdout.includes('doctor'));
    assert.ok(stdout.includes('rotate-key'));
    assert.ok(stdout.includes('import-app'));
  });

  it('help command works same as --help', () => {
    const { status, stdout } = runCli(['help']);
    assert.equal(status, 0);
    assert.ok(stdout.includes('Usage:'));
  });

  it('no args prints help', () => {
    const { status, stdout } = runCli([]);
    assert.equal(status, 0);
    assert.ok(stdout.includes('Usage:'));
  });
});

// ---------------------------------------------------------------------------
// Negative paths
// ---------------------------------------------------------------------------

describe('CLI: negative paths', () => {
  it('unknown command exits with error', () => {
    const { status, stderr } = runCli(['notacommand']);
    assert.notEqual(status, 0);
    assert.ok(stderr.includes('unknown command'));
  });

  it('init without git repo and no target exits with error', () => {
    const { status, stderr } = runCli(['init'], { cwd: '/tmp' });
    // /tmp is not a git repo and no target given — should fail
    assert.notEqual(status, 0);
  });

  it('init with non-existent target exits with error', () => {
    const { status, stderr } = runCli(['init', '/tmp/does-not-exist-squad-identity-test-xyz']);
    assert.notEqual(status, 0);
    assert.ok(stderr.includes('does not exist'));
  });

  it('rotate-key without --role exits with error', () => {
    const { status, stderr } = runCli(['rotate-key']);
    assert.notEqual(status, 0);
    assert.ok(stderr.includes('--role'));
  });

  it('command --help prints command-specific help', () => {
    for (const cmd of ['init', 'upgrade', 'rotate-key', 'doctor', 'setup', 'resolve-token', 'import-app']) {
      const { status, stdout } = runCli([cmd, '--help']);
      assert.equal(status, 0, `${cmd} --help should exit 0`);
      assert.ok(stdout.includes('Usage:'), `${cmd} --help should contain Usage:`);
    }
  });
});

// ---------------------------------------------------------------------------
// init command
// ---------------------------------------------------------------------------

describe('CLI: init', () => {
  let dir;

  before(() => {
    dir = createFixtureRepo({ teamMd: true });
  });

  after(() => {
    cleanupFixture(dir);
  });

  it('init creates expected directory structure', () => {
    const { status, stdout } = runCli(['init', dir]);
    assert.equal(status, 0, `init failed: ${stdout}`);

    // Extension files
    assert.ok(existsSync(join(dir, '.github', 'extensions', 'squad-identity', 'extension.mjs')),
      'extension.mjs should exist');
    assert.ok(existsSync(join(dir, '.github', 'extensions', 'squad-identity', 'lib', 'resolve-token.mjs')),
      'lib/resolve-token.mjs should exist');
    assert.ok(existsSync(join(dir, '.github', 'extensions', 'squad-identity', 'lib', 'configure-identity.mjs')),
      'lib/configure-identity.mjs should exist');
    assert.ok(existsSync(join(dir, '.github', 'extensions', 'squad-identity', 'lib', 'create-app.mjs')),
      'lib/create-app.mjs should exist');
    assert.ok(existsSync(join(dir, '.github', 'extensions', 'squad-identity', 'lib', 'install-apps.mjs')),
      'lib/install-apps.mjs should exist');
    assert.ok(existsSync(join(dir, '.github', 'extensions', 'squad-identity', 'lib', 'keychain.mjs')),
      'lib/keychain.mjs should exist');
    assert.ok(existsSync(join(dir, '.github', 'extensions', 'squad-identity', 'lib', 'sync-secrets.mjs')),
      'lib/sync-secrets.mjs should exist');

    // Skill
    assert.ok(existsSync(join(dir, '.squad', 'skills', 'squad-identity', 'SKILL.md')),
      'SKILL.md should exist');

    // Identity config
    assert.ok(existsSync(join(dir, '.squad', 'identity', 'config.json')),
      'config.json should exist');
  });

  it('init creates valid config.json from template', () => {
    const cfg = JSON.parse(readFileSync(join(dir, '.squad', 'identity', 'config.json'), 'utf-8'));
    assert.ok(cfg.apps !== undefined, 'config should have apps key');
    assert.ok(cfg.agentNameMap !== undefined, 'config should have agentNameMap key');
  });

  it('SKILL.md contains protocol steps', () => {
    const skill = readFileSync(join(dir, '.squad', 'skills', 'squad-identity', 'SKILL.md'), 'utf-8');
    assert.ok(skill.includes('Step A'), 'SKILL.md should contain Step A');
    assert.ok(skill.includes('Step B'), 'SKILL.md should contain Step B');
    assert.ok(skill.includes('Step C'), 'SKILL.md should contain Step C');
    assert.ok(skill.includes('squad_identity_resolve_token'), 'SKILL.md should mention resolve_token tool');
  });

  it('init is idempotent (second run does not error)', () => {
    const { status } = runCli(['init', dir]);
    assert.equal(status, 0, 'second init should succeed');
  });

  it('init does not overwrite existing config.json', () => {
    const cfgPath = join(dir, '.squad', 'identity', 'config.json');
    const original = readFileSync(cfgPath, 'utf-8');

    // Modify config
    const cfg = JSON.parse(original);
    cfg.customField = 'test-marker';
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

    // Re-run init
    runCli(['init', dir]);

    // Config should still have our marker
    const after = JSON.parse(readFileSync(cfgPath, 'utf-8'));
    assert.equal(after.customField, 'test-marker', 'init should preserve existing config');
  });

  it('extension.mjs is a valid JavaScript file', () => {
    const extPath = join(dir, '.github', 'extensions', 'squad-identity', 'extension.mjs');
    const content = readFileSync(extPath, 'utf-8');
    assert.ok(content.includes('joinSession'), 'extension should import joinSession');
    assert.ok(content.includes('squad_identity_'), 'extension should register squad_identity_ tools');
  });
});

// ---------------------------------------------------------------------------
// upgrade command
// ---------------------------------------------------------------------------

describe('CLI: upgrade', () => {
  let dir;

  before(() => {
    dir = createFixtureRepo({ teamMd: true });
    // Init first
    runCli(['init', dir]);
  });

  after(() => {
    cleanupFixture(dir);
  });

  it('upgrade refreshes extension files', () => {
    // Corrupt the extension file
    const extPath = join(dir, '.github', 'extensions', 'squad-identity', 'extension.mjs');
    writeFileSync(extPath, '// corrupted');

    const { status } = runCli(['upgrade', dir]);
    assert.equal(status, 0, 'upgrade should succeed');

    // File should be restored
    const content = readFileSync(extPath, 'utf-8');
    assert.ok(content.includes('joinSession'), 'extension should be restored');
  });

  it('upgrade preserves existing config.json', () => {
    const cfgPath = join(dir, '.squad', 'identity', 'config.json');
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf-8'));
    cfg.customField = 'survive-upgrade';
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

    runCli(['upgrade', dir]);

    const after = JSON.parse(readFileSync(cfgPath, 'utf-8'));
    assert.equal(after.customField, 'survive-upgrade', 'config should survive upgrade');
  });
});

// ---------------------------------------------------------------------------
// doctor (in an inited but unconfigured repo)
// ---------------------------------------------------------------------------

describe('CLI: doctor', () => {
  let dir;

  before(() => {
    dir = createFixtureRepo({ teamMd: true });
    runCli(['init', dir]);
  });

  after(() => {
    cleanupFixture(dir);
  });

  it('doctor runs without crashing', () => {
    const { stdout, stderr } = runCli(['doctor'], { cwd: dir });
    const output = stdout + stderr;
    assert.ok(output.length > 0, 'doctor should produce output');
  });
});

// ---------------------------------------------------------------------------
// setup preflight checks
// ---------------------------------------------------------------------------

describe('CLI: setup preflight', () => {
  it('setup fails if team.md is missing', () => {
    const dir = createFixtureRepo({ teamMd: false });
    try {
      const { status, stderr } = runCli(['setup', dir], { input: 'n\n' });
      assert.notEqual(status, 0);
      assert.ok(stderr.includes('team.md'), 'should mention team.md');
    } finally {
      cleanupFixture(dir);
    }
  });

  it('setup discovers roles from team.md', () => {
    const dir = createFixtureRepo({ teamMd: true });
    try {
      // Send 's' (skip) for each role prompt to avoid creating apps
      const { stdout } = runCli(['setup', dir], { input: 's\ns\ns\ns\ns\ns\ns\ns\ns\n' });
      // Should show discovered roles before asking for confirmation
      assert.ok(stdout.includes('lead') || stdout.includes('backend') || stdout.includes('frontend'),
        'should discover roles from team.md');
    } finally {
      cleanupFixture(dir);
    }
  });

  it('setup skipped by user does not create apps', () => {
    const dir = createFixtureRepo({ teamMd: true });
    try {
      // Skip all roles
      const { stdout } = runCli(['setup', dir], { input: 's\ns\ns\ns\ns\ns\ns\ns\ns\n' });
      assert.ok(stdout.includes('Skipped') || stdout.includes('skip'),
        'should indicate skipping');
      // No apps should exist
      assert.ok(!existsSync(join(dir, '.squad', 'identity', 'apps')),
        'apps dir should not exist after skipping');
    } finally {
      cleanupFixture(dir);
    }
  });
});
