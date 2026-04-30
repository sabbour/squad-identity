/**
 * CLI batch command tests — create-apps, install-apps, and resolve-token.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupFixture, createFixtureRepo, runCli } from './helpers.mjs';

const DISCOVERED_ROLES = [
  'lead',
  'backend',
  'frontend',
  'devops',
  'security',
  'tester',
  'codereview',
  'docs',
  'scribe',
];

function writeAppRegistrations(dir, roles, options = {}) {
  const appsDir = join(dir, '.squad', 'identity', 'apps');
  mkdirSync(appsDir, { recursive: true });

  for (const role of roles) {
    const app = {
      appId: Number(`1${roles.indexOf(role) + 1}`),
      slug: `test-${role}`,
      ...(options.withInstallationId ? { installationId: Number(`9${roles.indexOf(role) + 1}`) } : {}),
    };
    writeFileSync(join(appsDir, `${role}.json`), `${JSON.stringify(app, null, 2)}\n`, 'utf8');
  }
}

describe('CLI: batch commands', () => {
  it('create-apps with no team.md exits with an error', () => {
    const dir = createFixtureRepo({ teamMd: false });
    try {
      const { status, stderr } = runCli(['create-apps'], { cwd: dir });
      assert.notEqual(status, 0);
      assert.ok(stderr.includes('team.md'), 'should mention missing team.md');
    } finally {
      cleanupFixture(dir);
    }
  });

  it('create-apps exits 0 with nothing to create when all discovered roles already have apps', () => {
    const dir = createFixtureRepo({ teamMd: true });
    try {
      writeAppRegistrations(dir, DISCOVERED_ROLES);
      const { status, stdout } = runCli(['create-apps'], { cwd: dir });
      assert.equal(status, 0);
      assert.ok(stdout.includes('Nothing to create'), 'should report nothing to create');
    } finally {
      cleanupFixture(dir);
    }
  });

  it('install-apps with no app registrations prints a message and exits 0', () => {
    const dir = createFixtureRepo({ teamMd: true });
    try {
      const { status, stdout } = runCli(['install-apps'], { cwd: dir });
      assert.equal(status, 0);
      assert.ok(stdout.includes('Nothing to install'), 'should mention there is nothing to install');
    } finally {
      cleanupFixture(dir);
    }
  });

  it('create-apps --help outputs help text', () => {
    const { status, stdout } = runCli(['create-apps', '--help']);
    assert.equal(status, 0);
    assert.ok(stdout.includes('Usage:'));
    assert.ok(stdout.includes('--roles'));
  });

  it('install-apps --help outputs help text', () => {
    const { status, stdout } = runCli(['install-apps', '--help']);
    assert.equal(status, 0);
    assert.ok(stdout.includes('Usage:'));
    assert.ok(stdout.includes('--roles'));
  });

  it('resolve-token --help outputs help text', () => {
    const { status, stdout } = runCli(['resolve-token', '--help']);
    assert.equal(status, 0);
    assert.ok(stdout.includes('Usage:'));
    assert.ok(stdout.includes('--role'));
  });

  it('resolve-token without --role exits with an error', () => {
    const { status, stderr } = runCli(['resolve-token']);
    assert.notEqual(status, 0);
    assert.ok(stderr.includes('--role'), 'should require --role');
  });

  it('--roles parsing works correctly for both batch commands', () => {
    const dir = createFixtureRepo({ teamMd: true });
    try {
      writeAppRegistrations(dir, DISCOVERED_ROLES, { withInstallationId: true });

      const createResult = runCli(['create-apps', '--roles', 'lead, backend ,tester'], { cwd: dir });
      assert.equal(createResult.status, 0);
      assert.ok(createResult.stdout.includes('Nothing to create'), 'create-apps should accept comma-separated role filters');

      const installResult = runCli(['install-apps', '--roles', 'lead, backend ,tester'], { cwd: dir });
      assert.equal(installResult.status, 0);
      assert.ok(installResult.stdout.includes('Nothing to install'), 'install-apps should accept comma-separated role filters');
    } finally {
      cleanupFixture(dir);
    }
  });
});
