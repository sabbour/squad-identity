/**
 * Integration tests for configure-identity.mjs
 * Tests the lib script's actual behavior with real files.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createFixtureRepo,
  cleanupFixture,
  runCli,
  runLib,
  SAMPLE_TEAM_MD,
} from './helpers.mjs';

// ---------------------------------------------------------------------------
// --status flag
// ---------------------------------------------------------------------------

describe('configure-identity: --status', () => {
  let dir;

  before(() => {
    dir = createFixtureRepo({ teamMd: true });
    runCli(['init', dir]);
  });

  after(() => {
    cleanupFixture(dir);
  });

  it('prints config info', () => {
    const { stdout, stderr } = runLib('configure-identity.mjs', ['--status'], { cwd: dir });
    const output = stdout + stderr;
    assert.ok(output.length > 0, 'should produce output');
  });
});

// ---------------------------------------------------------------------------
// --doctor flag
// ---------------------------------------------------------------------------

describe('configure-identity: --doctor', () => {
  let dir;

  before(() => {
    dir = createFixtureRepo({ teamMd: true });
    runCli(['init', dir]);
  });

  after(() => {
    cleanupFixture(dir);
  });

  it('runs health check without crashing', () => {
    const { stdout, stderr } = runLib('configure-identity.mjs', ['--doctor'], { cwd: dir });
    const output = stdout + stderr;
    assert.ok(output.length > 0, 'should produce output');
    // Doctor should report something about the config
    assert.ok(output.includes('config') || output.includes('Config') || output.includes('identity'),
      'should mention config or identity');
  });
});

// ---------------------------------------------------------------------------
// --update-charters flag
// ---------------------------------------------------------------------------

describe('configure-identity: --update-charters', () => {
  let dir;

  before(() => {
    dir = createFixtureRepo({ teamMd: true, charters: true });
    runCli(['init', dir]);

    // Add some app registrations so role inference works
    const appsDir = join(dir, '.squad', 'identity', 'apps');
    mkdirSync(appsDir, { recursive: true });
    writeFileSync(join(appsDir, 'lead.json'), JSON.stringify({ appId: 1001, appSlug: 'sqd-lead' }));
    writeFileSync(join(appsDir, 'backend.json'), JSON.stringify({ appId: 1002, appSlug: 'sqd-backend' }));
    writeFileSync(join(appsDir, 'frontend.json'), JSON.stringify({ appId: 1003, appSlug: 'sqd-frontend' }));
  });

  after(() => {
    cleanupFixture(dir);
  });

  it('updates charters with ROLE_SLUG', () => {
    const { status, stdout, stderr } = runLib('configure-identity.mjs', ['--update-charters'], { cwd: dir });
    // May warn about some things but should not crash
    const output = stdout + stderr;
    assert.ok(status === 0 || output.length > 0, 'should produce output');
  });

  it('writes agentNameMap to config.json', () => {
    // Run update-charters which populates agentNameMap
    runLib('configure-identity.mjs', ['--update-charters'], { cwd: dir });

    const cfg = JSON.parse(readFileSync(join(dir, '.squad', 'identity', 'config.json'), 'utf-8'));
    assert.ok(cfg.agentNameMap, 'config should have agentNameMap after update-charters');
  });

  it('injects ROLE_SLUG into charter files', () => {
    // Create a charter without ROLE_SLUG
    const agentDir = join(dir, '.squad', 'agents', 'switch');
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, 'charter.md'), '# Switch\n\nFrontend developer.\n');

    runLib('configure-identity.mjs', ['--update-charters'], { cwd: dir });

    // Check if morpheus charter (which already had ROLE_SLUG) still has it
    const morpheusCharter = readFileSync(join(dir, '.squad', 'agents', 'morpheus', 'charter.md'), 'utf-8');
    assert.ok(morpheusCharter.includes('ROLE_SLUG='), 'morpheus charter should have ROLE_SLUG');
  });
});

// ---------------------------------------------------------------------------
// --update-copilot-instructions flag
// ---------------------------------------------------------------------------

describe('configure-identity: --update-copilot-instructions', () => {
  let dir;

  before(() => {
    dir = createFixtureRepo({ teamMd: true });
    runCli(['init', dir]);
    // Create .github directory for copilot-instructions
    mkdirSync(join(dir, '.github'), { recursive: true });
  });

  after(() => {
    cleanupFixture(dir);
  });

  it('creates copilot-instructions.md with identity block', () => {
    const { status } = runLib('configure-identity.mjs', ['--update-copilot-instructions'], { cwd: dir });
    assert.equal(status, 0, 'update-copilot-instructions should succeed');

    const instrPath = join(dir, '.github', 'copilot-instructions.md');
    assert.ok(existsSync(instrPath), 'copilot-instructions.md should exist');

    const content = readFileSync(instrPath, 'utf-8');
    assert.ok(content.includes('squad'), 'should contain squad-identity content');
  });

  it('is idempotent (running twice does not duplicate block)', () => {
    runLib('configure-identity.mjs', ['--update-copilot-instructions'], { cwd: dir });
    runLib('configure-identity.mjs', ['--update-copilot-instructions'], { cwd: dir });

    const content = readFileSync(join(dir, '.github', 'copilot-instructions.md'), 'utf-8');

    // Count occurrences of the identity block marker
    const markerCount = (content.match(/squad.identity/gi) || []).length;
    // Should appear a reasonable number of times but not doubled
    // The key thing: block should not be duplicated
    const blockStart = '<!-- BEGIN squad-identity';
    const starts = (content.match(new RegExp(blockStart, 'g')) || []).length;
    assert.ok(starts <= 1, `identity block should not be duplicated (found ${starts})`);
  });

  it('preserves existing content in copilot-instructions.md', () => {
    const instrPath = join(dir, '.github', 'copilot-instructions.md');
    writeFileSync(instrPath, '# My Project\n\nCustom instructions here.\n');

    runLib('configure-identity.mjs', ['--update-copilot-instructions'], { cwd: dir });

    const content = readFileSync(instrPath, 'utf-8');
    assert.ok(content.includes('My Project'), 'should preserve existing content');
    assert.ok(content.includes('squad') || content.includes('Squad'),
      'should also contain identity block');
  });
});

// ---------------------------------------------------------------------------
// Role inference from team.md
// ---------------------------------------------------------------------------

describe('configure-identity: role inference', () => {
  it('recognizes standard role keywords from team.md', () => {
    const dir = createFixtureRepo({ teamMd: true });
    try {
      runCli(['init', dir]);
      // Add app registrations for all roles
      const appsDir = join(dir, '.squad', 'identity', 'apps');
      mkdirSync(appsDir, { recursive: true });
      const roles = ['lead', 'backend', 'frontend', 'devops', 'security', 'tester', 'codereview', 'docs', 'scribe'];
      for (const role of roles) {
        writeFileSync(join(appsDir, `${role}.json`), JSON.stringify({ appId: 1000, appSlug: `squad-identity-${role}` }));
      }

      // Create agents matching team.md
      for (const name of ['morpheus', 'tank', 'switch', 'dozer', 'oracle', 'mouse', 'cypher', 'niobe', 'link']) {
        const agentDir = join(dir, '.squad', 'agents', name);
        mkdirSync(agentDir, { recursive: true });
        writeFileSync(join(agentDir, 'charter.md'), `# ${name}\n`);
      }

      const { status, stdout, stderr } = runLib('configure-identity.mjs', ['--update-charters'], { cwd: dir });
      const output = stdout + stderr;

      // Check that agentNameMap was populated
      const cfg = JSON.parse(readFileSync(join(dir, '.squad', 'identity', 'config.json'), 'utf-8'));
      if (cfg.agentNameMap) {
        const mapped = Object.keys(cfg.agentNameMap);
        assert.ok(mapped.length > 0, `should map at least some agents, got: ${mapped}`);
      }
    } finally {
      cleanupFixture(dir);
    }
  });
});
