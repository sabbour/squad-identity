/**
 * Token Lease System tests — store, CLI, and exchange modules.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLease,
  exchangeLease,
  validateLease,
  revokeLease,
  cleanupExpired,
  listLeases,
} from '../extensions/squad-identity/lib/token-lease-store.mjs';
import { exchange } from '../extensions/squad-identity/lib/exchange-lease.mjs';

// Helper: small delay
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Token Lease Store
// ---------------------------------------------------------------------------

describe('Token Lease Store', () => {
  beforeEach(() => {
    // Clean up all leases between tests
    for (const l of listLeases()) {
      revokeLease(l.scopeId);
    }
    cleanupExpired();
  });

  it('createLease returns valid structure with scopeId starting with "lease_"', () => {
    const lease = createLease({ role: 'backend', token: 'ghs_abc123' });
    assert.ok(lease.scopeId.startsWith('lease_'));
    assert.equal(lease.role, 'backend');
    assert.equal(lease.token, 'ghs_abc123');
    assert.equal(typeof lease.deadlineUnix, 'number');
    assert.equal(typeof lease.remainingOps, 'number');
    assert.equal(typeof lease.leasedAtUnix, 'number');
  });

  it('createLease uses defaults (maxOps=3, maxTimeSec=300) when not specified', () => {
    const lease = createLease({ role: 'frontend', token: 'ghs_xyz' });
    assert.equal(lease.remainingOps, 3);
    // deadline should be ~300s from now
    const expectedDeadline = lease.leasedAtUnix + 300;
    assert.equal(lease.deadlineUnix, expectedDeadline);
  });

  it('exchangeLease returns token and decrements remainingOps', () => {
    const lease = createLease({ role: 'backend', token: 'ghs_tok', maxOps: 5 });
    const result = exchangeLease(lease.scopeId, 'backend');
    assert.equal(result.token, 'ghs_tok');
    assert.equal(result.remainingOps, 4);
  });

  it('exchangeLease throws after ops exhausted', () => {
    const lease = createLease({ role: 'backend', token: 'ghs_tok', maxOps: 1 });
    exchangeLease(lease.scopeId, 'backend'); // uses the one op
    assert.throws(
      () => exchangeLease(lease.scopeId, 'backend'),
      /exhausted/i,
    );
  });

  it('exchangeLease throws on role mismatch', () => {
    const lease = createLease({ role: 'backend', token: 'ghs_tok' });
    assert.throws(
      () => exchangeLease(lease.scopeId, 'frontend'),
      /role mismatch/i,
    );
  });

  it('exchangeLease throws on expired lease', async () => {
    const lease = createLease({ role: 'backend', token: 'ghs_tok', maxTimeSec: 0 });
    await sleep(1);
    assert.throws(
      () => exchangeLease(lease.scopeId, 'backend'),
      /expired/i,
    );
  });

  it('revokeLease makes subsequent exchange throw', () => {
    const lease = createLease({ role: 'backend', token: 'ghs_tok' });
    revokeLease(lease.scopeId);
    assert.throws(
      () => exchangeLease(lease.scopeId, 'backend'),
      /revoked/i,
    );
  });

  it('validateLease returns { valid: true } for good lease', () => {
    const lease = createLease({ role: 'backend', token: 'ghs_tok' });
    const result = validateLease(lease.scopeId);
    assert.equal(result.valid, true);
    assert.equal(typeof result.remainingOps, 'number');
    assert.equal(typeof result.deadlineUnix, 'number');
  });

  it('validateLease returns { valid: false, reason } for expired/exhausted/revoked', async () => {
    // Expired
    const expired = createLease({ role: 'a', token: 't', maxTimeSec: 0 });
    await sleep(1);
    const r1 = validateLease(expired.scopeId);
    assert.equal(r1.valid, false);
    assert.ok(r1.reason);

    // Exhausted
    const exhausted = createLease({ role: 'b', token: 't', maxOps: 1 });
    exchangeLease(exhausted.scopeId, 'b');
    const r2 = validateLease(exhausted.scopeId);
    assert.equal(r2.valid, false);
    assert.ok(r2.reason);

    // Revoked
    const revoked = createLease({ role: 'c', token: 't' });
    revokeLease(revoked.scopeId);
    const r3 = validateLease(revoked.scopeId);
    assert.equal(r3.valid, false);
    assert.ok(r3.reason);
  });

  it('cleanupExpired removes expired leases from listLeases', async () => {
    const expired = createLease({ role: 'x', token: 't', maxTimeSec: 0 });
    const alive = createLease({ role: 'y', token: 't2', maxTimeSec: 600 });
    await sleep(1);
    cleanupExpired();
    const ids = listLeases().map((l) => l.scopeId);
    assert.ok(!ids.includes(expired.scopeId), 'expired lease should be removed');
    assert.ok(ids.includes(alive.scopeId), 'alive lease should remain');
  });

  it('listLeases does not expose tokens', () => {
    createLease({ role: 'backend', token: 'ghs_secret' });
    const list = listLeases();
    assert.ok(list.length > 0);
    for (const entry of list) {
      assert.equal('token' in entry, false, 'token field must not appear in list output');
    }
  });
});

// ---------------------------------------------------------------------------
// Exchange module (programmatic API)
// ---------------------------------------------------------------------------

describe('Exchange module', () => {
  beforeEach(() => {
    for (const l of listLeases()) {
      revokeLease(l.scopeId);
    }
    cleanupExpired();
  });

  it('exchange({ scopeId, role }) returns token', async () => {
    const lease = createLease({ role: 'backend', token: 'ghs_prog' });
    const result = await exchange({ scopeId: lease.scopeId, role: 'backend' });
    assert.equal(result.token, 'ghs_prog');
    assert.equal(typeof result.remainingOps, 'number');
  });

  it('exchange throws on invalid scopeId', async () => {
    await assert.rejects(
      () => exchange({ scopeId: 'lease_nonexistent', role: 'backend' }),
      /not found/i,
    );
  });
});
