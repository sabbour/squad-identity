import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  recordAttestation,
  listAttestations,
  verifyAttestation,
  getLogPath,
} from '../extensions/squad-identity/lib/attestation-store.mjs';

import { attestWrite } from '../extensions/squad-identity/lib/attest-write.mjs';

// ============================================================================
// Attestation Store
// ============================================================================

describe('attestation-store', () => {
  let logDir;

  before(() => {
    logDir = mkdtempSync(join(tmpdir(), 'attest-test-'));
  });

  after(() => {
    rmSync(logDir, { recursive: true, force: true });
  });

  it('recordAttestation creates log file and returns record with attestation_id starting with "attest_"', () => {
    const record = recordAttestation({
      attestationDir: logDir,
      writeType: 'pr-create',
      owner: 'org',
      repo: 'repo',
      targetObject: 'PR#1',
      roleSlug: 'backend',
      expectedActor: 'bot[bot]',
      actualActor: 'bot[bot]',
    });

    assert.ok(record.attestation_id.startsWith('attest_'));
    assert.equal(record.write_type, 'pr-create');
    assert.equal(record.owner, 'org');
    assert.equal(record.repo, 'repo');
    assert.equal(record.actor_match, true);
  });

  it('recordAttestation appends to existing log file (multiple records)', () => {
    recordAttestation({
      attestationDir: logDir,
      writeType: 'pr-comment',
      owner: 'org',
      repo: 'repo',
      targetObject: 'PR#2',
      roleSlug: 'frontend',
      expectedActor: 'bot[bot]',
      actualActor: 'other[bot]',
    });

    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, '0');
    const d = String(today.getUTCDate()).padStart(2, '0');
    const logPath = getLogPath(logDir, `${y}${m}${d}`);
    const lines = readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
    assert.ok(lines.length >= 2, 'Expected at least 2 records in log file');
  });

  it('listAttestations returns all records for today', () => {
    const records = listAttestations({ attestationDir: logDir });
    assert.ok(records.length >= 2);
  });

  it('listAttestations filters by roleSlug', () => {
    const records = listAttestations({ attestationDir: logDir, roleSlug: 'backend' });
    assert.ok(records.length >= 1);
    assert.ok(records.every((r) => r.role_slug === 'backend'));
  });

  it('listAttestations filters by actorMatch (boolean)', () => {
    const matched = listAttestations({ attestationDir: logDir, actorMatch: true });
    assert.ok(matched.every((r) => r.actor_match === true));

    const unmatched = listAttestations({ attestationDir: logDir, actorMatch: false });
    assert.ok(unmatched.every((r) => r.actor_match === false));
    assert.ok(unmatched.length >= 1);
  });

  it('verifyAttestation finds record by ID', () => {
    const record = recordAttestation({
      attestationDir: logDir,
      writeType: 'push',
      owner: 'org',
      repo: 'repo',
      targetObject: 'sha123',
      roleSlug: 'infra',
      expectedActor: 'bot[bot]',
      actualActor: 'bot[bot]',
    });

    const found = verifyAttestation(record.attestation_id, { attestationDir: logDir });
    assert.ok(found);
    assert.equal(found.attestation_id, record.attestation_id);
    assert.equal(found.write_type, 'push');
  });

  it('verifyAttestation returns null for non-existent ID', () => {
    const found = verifyAttestation('attest_nonexistent', { attestationDir: logDir });
    assert.equal(found, null);
  });

  it('getLogPath returns correct date-stamped path', () => {
    const path = getLogPath(logDir, '20250601');
    assert.equal(path, join(logDir, 'log-20250601.jsonl'));
  });

  it('daily rotation: records on different simulated dates go to different files', () => {
    const rotDir = mkdtempSync(join(tmpdir(), 'attest-rot-'));
    try {
      // Day 1: unix timestamp for 2025-03-15 00:00:00 UTC
      recordAttestation({
        attestationDir: rotDir,
        writeType: 'pr-create',
        owner: 'org',
        repo: 'repo',
        targetObject: 'PR#10',
        roleSlug: 'backend',
        expectedActor: 'bot[bot]',
        actualActor: 'bot[bot]',
        timestampUnix: 1742169600, // 2025-03-17 UTC
      });

      // Day 2: different timestamp
      recordAttestation({
        attestationDir: rotDir,
        writeType: 'pr-comment',
        owner: 'org',
        repo: 'repo',
        targetObject: 'PR#11',
        roleSlug: 'frontend',
        expectedActor: 'bot[bot]',
        actualActor: 'bot[bot]',
        timestampUnix: 1742256000, // 2025-03-18 UTC
      });

      const day1Path = getLogPath(rotDir, '20250317');
      const day2Path = getLogPath(rotDir, '20250318');
      const day1Lines = readFileSync(day1Path, 'utf8').split('\n').filter(Boolean);
      const day2Lines = readFileSync(day2Path, 'utf8').split('\n').filter(Boolean);

      assert.equal(day1Lines.length, 1);
      assert.equal(day2Lines.length, 1);
    } finally {
      rmSync(rotDir, { recursive: true, force: true });
    }
  });
});

// ============================================================================
// Attest-Write (integration — verify: false to skip GitHub API)
// ============================================================================

describe('attest-write', () => {
  let repoRoot;

  before(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'attest-write-'));
  });

  after(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('attestWrite with verify=false records attestation and returns { recorded: true, verification: null }', async () => {
    const result = await attestWrite({
      repoRoot,
      owner: 'org',
      repo: 'repo',
      writeType: 'pr-create',
      writeRef: 'PR#42',
      roleSlug: 'backend',
      expectedActor: 'bot[bot]',
      token: 'fake-token',
      verify: false,
    });

    assert.equal(result.recorded, true);
    assert.equal(result.verification, null);
    assert.ok(result.attestationId.startsWith('attest_'));
  });

  it('attestWrite creates logDir if it does not exist', async () => {
    const freshRoot = mkdtempSync(join(tmpdir(), 'attest-fresh-'));
    try {
      const result = await attestWrite({
        repoRoot: freshRoot,
        owner: 'org',
        repo: 'repo',
        writeType: 'push',
        writeRef: 'sha456',
        roleSlug: 'infra',
        expectedActor: 'bot[bot]',
        token: 'fake-token',
        verify: false,
      });

      assert.equal(result.recorded, true);

      // Verify the log directory and file were created
      const logDir = join(freshRoot, '.squad', 'attestation');
      const records = listAttestations({ attestationDir: logDir });
      assert.ok(records.length >= 1);
    } finally {
      rmSync(freshRoot, { recursive: true, force: true });
    }
  });
});
