/**
 * Tests for premerge-check.mjs — pre-merge governance check module.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { premergeCheck } from '../extensions/squad-identity/lib/premerge-check.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir() {
  return mkdtempSync(join(tmpdir(), 'squad-premerge-test-'));
}

function writeConfig(dir, config) {
  const configDir = join(dir, '.squad', 'identity');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, 'config.json'), JSON.stringify(config, null, 2));
}

function writeWorkflow(dir, name) {
  const wfDir = join(dir, '.github', 'workflows');
  mkdirSync(wfDir, { recursive: true });
  writeFileSync(join(wfDir, name), `name: ${name}\non: push\n`);
}

// ---------------------------------------------------------------------------
// Pass — all workflows present
// ---------------------------------------------------------------------------

describe('premerge-check: all workflows present', () => {
  let dir;

  before(() => {
    dir = createTempDir();
    writeConfig(dir, {
      branches: { main: { required_workflows: ['ci.yml'], required_labels: [] } },
    });
    writeWorkflow(dir, 'ci.yml');
  });

  after(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns checkPassed=true with workflow in present list', () => {
    const result = premergeCheck({ targetBranch: 'main', repoRoot: dir });
    assert.equal(result.checkPassed, true);
    assert.equal(result.branch, 'main');
    assert.deepEqual(result.workflowRequirements.present, ['ci.yml']);
    assert.deepEqual(result.workflowRequirements.missing, []);
  });
});

// ---------------------------------------------------------------------------
// Fail — missing workflows
// ---------------------------------------------------------------------------

describe('premerge-check: missing workflows', () => {
  let dir;

  before(() => {
    dir = createTempDir();
    writeConfig(dir, {
      branches: { main: { required_workflows: ['ci.yml', 'lint.yml'], required_labels: [] } },
    });
    writeWorkflow(dir, 'ci.yml');
  });

  after(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns checkPassed=false with lint.yml in missing list', () => {
    const result = premergeCheck({ targetBranch: 'main', repoRoot: dir });
    assert.equal(result.checkPassed, false);
    assert.deepEqual(result.workflowRequirements.present, ['ci.yml']);
    assert.ok(result.workflowRequirements.missing.includes('lint.yml'));
  });
});

// ---------------------------------------------------------------------------
// Pass — branch not in config
// ---------------------------------------------------------------------------

describe('premerge-check: branch not in config', () => {
  let dir;

  before(() => {
    dir = createTempDir();
    writeConfig(dir, {
      branches: { main: { required_workflows: ['ci.yml'], required_labels: [] } },
    });
  });

  after(() => { rmSync(dir, { recursive: true, force: true }); });

  it('passes when target branch has no requirements', () => {
    const result = premergeCheck({ targetBranch: 'feature/x', repoRoot: dir });
    assert.equal(result.checkPassed, true);
    assert.equal(result.branch, 'feature/x');
    assert.deepEqual(result.workflowRequirements.missing, []);
  });
});

// ---------------------------------------------------------------------------
// Pass — empty requirements
// ---------------------------------------------------------------------------

describe('premerge-check: empty requirements', () => {
  let dir;

  before(() => {
    dir = createTempDir();
    writeConfig(dir, {
      branches: { main: { required_workflows: [], required_labels: [] } },
    });
  });

  after(() => { rmSync(dir, { recursive: true, force: true }); });

  it('passes when required_workflows is empty', () => {
    const result = premergeCheck({ targetBranch: 'main', repoRoot: dir });
    assert.equal(result.checkPassed, true);
    assert.deepEqual(result.workflowRequirements.requiredWorkflows, []);
  });
});

// ---------------------------------------------------------------------------
// Fail — missing workflows dir
// ---------------------------------------------------------------------------

describe('premerge-check: missing workflows directory', () => {
  let dir;

  before(() => {
    dir = createTempDir();
    writeConfig(dir, {
      branches: { main: { required_workflows: ['ci.yml', 'lint.yml'], required_labels: [] } },
    });
    // Intentionally do NOT create .github/workflows/
  });

  after(() => { rmSync(dir, { recursive: true, force: true }); });

  it('fails with all workflows listed as missing', () => {
    const result = premergeCheck({ targetBranch: 'main', repoRoot: dir });
    assert.equal(result.checkPassed, false);
    assert.deepEqual(result.workflowRequirements.missing, ['ci.yml', 'lint.yml']);
    assert.deepEqual(result.workflowRequirements.present, []);
  });
});

// ---------------------------------------------------------------------------
// Error — invalid repoRoot
// ---------------------------------------------------------------------------

describe('premerge-check: invalid repoRoot', () => {
  it('throws when repoRoot does not exist', () => {
    assert.throws(
      () => premergeCheck({ targetBranch: 'main', repoRoot: '/nonexistent/path/xyz123' }),
      /repoRoot does not exist/,
    );
  });
});

// ---------------------------------------------------------------------------
// Pass — config file missing (graceful default)
// ---------------------------------------------------------------------------

describe('premerge-check: config file missing', () => {
  let dir;

  before(() => {
    dir = createTempDir();
    // No .squad/identity/config.json created
  });

  after(() => { rmSync(dir, { recursive: true, force: true }); });

  it('passes gracefully when config.json is absent', () => {
    const result = premergeCheck({ targetBranch: 'main', repoRoot: dir });
    assert.equal(result.checkPassed, true);
    assert.deepEqual(result.workflowRequirements.missing, []);
  });
});
