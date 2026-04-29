/**
 * Package asset smoke tests
 * Ensures all files that init/upgrade copy are actually included in the package.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PACKAGE_ROOT } from './helpers.mjs';

describe('Package assets', () => {
  it('all files copied by init exist in package root', () => {
    // These are the exact paths syncInstallFiles reads from
    const requiredFiles = [
      'extensions/squad-identity/extension.mjs',
      'extensions/squad-identity/lib/configure-identity.mjs',
      'extensions/squad-identity/lib/create-app.mjs',
      'extensions/squad-identity/lib/install-apps.mjs',
      'extensions/squad-identity/lib/resolve-token.mjs',
      'extensions/squad-identity/lib/sync-secrets.mjs',
      'extensions/squad-identity/lib/keychain.mjs',
      'squad-identity/SKILL.md',
      'identity/config.json.template',
    ];

    for (const file of requiredFiles) {
      assert.ok(existsSync(join(PACKAGE_ROOT, file)),
        `Package must contain ${file}`);
    }
  });

  it('package.json files array includes required paths', () => {
    const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf-8'));
    const files = pkg.files;

    assert.ok(files.includes('bin/'), 'files should include bin/');
    assert.ok(files.includes('extensions/'), 'files should include extensions/');
    assert.ok(files.includes('squad-identity/SKILL.md'), 'files should include SKILL.md');
    assert.ok(files.some(f => f.includes('identity')), 'files should include identity template');
    assert.ok(files.includes('README.md'), 'files should include README.md');
  });

  it('npm pack --dry-run includes all required files', () => {
    const result = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf-8',
    });

    const packInfo = JSON.parse(result);
    const packedFiles = packInfo[0].files.map(f => f.path);

    const mustInclude = [
      'bin/squad-identity.mjs',
      'extensions/squad-identity/extension.mjs',
      'extensions/squad-identity/lib/resolve-token.mjs',
      'extensions/squad-identity/lib/keychain.mjs',
      'squad-identity/SKILL.md',
      'identity/config.json.template',
    ];

    for (const file of mustInclude) {
      assert.ok(packedFiles.includes(file),
        `npm pack should include ${file} (got: ${packedFiles.join(', ')})`);
    }
  });

  it('bin entry in package.json points to real file', () => {
    const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf-8'));
    const binPath = pkg.bin['squad-identity'];
    assert.ok(existsSync(join(PACKAGE_ROOT, binPath)),
      `bin entry ${binPath} should exist`);
  });

  it('CLI entry point is valid JavaScript', () => {
    // node --check validates syntax without executing
    execFileSync(process.execPath, ['--check', join(PACKAGE_ROOT, 'bin', 'squad-identity.mjs')]);
  });

  it('extension.mjs is valid JavaScript', () => {
    execFileSync(process.execPath, ['--check', join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'extension.mjs')]);
  });

  it('all lib scripts are valid JavaScript', () => {
    const libs = [
      'configure-identity.mjs',
      'create-app.mjs',
      'install-apps.mjs',
      'resolve-token.mjs',
      'sync-secrets.mjs',
      'keychain.mjs',
    ];

    for (const lib of libs) {
      execFileSync(process.execPath, ['--check', join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', lib)]);
    }
  });
});

describe('Config template', () => {
  it('config.json.template is valid JSON', () => {
    const content = readFileSync(join(PACKAGE_ROOT, 'identity', 'config.json.template'), 'utf-8');
    const cfg = JSON.parse(content);
    assert.ok(typeof cfg === 'object');
  });

  it('config.json.template has expected keys', () => {
    const cfg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'identity', 'config.json.template'), 'utf-8'));
    assert.ok('apps' in cfg, 'template should have apps key');
    assert.ok('agentNameMap' in cfg, 'template should have agentNameMap key');
  });
});

describe('SKILL.md', () => {
  it('contains required protocol sections', () => {
    const skill = readFileSync(join(PACKAGE_ROOT, 'squad-identity', 'SKILL.md'), 'utf-8');
    assert.ok(skill.includes('Step A'), 'should have Step A');
    assert.ok(skill.includes('Step B'), 'should have Step B');
    assert.ok(skill.includes('Step C'), 'should have Step C');
    assert.ok(skill.includes('Anti-Pattern'), 'should have Anti-Patterns section');
    assert.ok(skill.includes('squad_identity_resolve_token'), 'should reference resolve_token tool');
  });

  it('does not reference deleted files or legacy paths', () => {
    const skill = readFileSync(join(PACKAGE_ROOT, 'squad-identity', 'SKILL.md'), 'utf-8');
    assert.ok(!skill.includes('.squad/identity/README.md'), 'should not reference deleted identity/README.md');
    assert.ok(!skill.includes('Step D'), 'should not have Step D (post-flight removed)');
  });
});
