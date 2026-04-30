import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STORE_PATH = path.join(os.tmpdir(), 'squad-identity-leases.json');
const LOCK_PATH = STORE_PATH + '.lock';
const LOCK_STALE_MS = 5000; // Consider lock stale after 5s

const now = () => Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------------------
// File-level advisory locking (atomic mkdir as mutex)
// ---------------------------------------------------------------------------

function acquireLock(maxWaitMs = 3000) {
  const deadline = Date.now() + maxWaitMs;
  while (true) {
    try {
      fs.mkdirSync(LOCK_PATH);
      return; // acquired
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // Check if lock is stale (holder crashed)
      try {
        const stat = fs.statSync(LOCK_PATH);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          fs.rmdirSync(LOCK_PATH);
          continue; // retry immediately after breaking stale lock
        }
      } catch { /* stat failed — lock was just released */ continue; }
      if (Date.now() >= deadline) {
        // Force-break to avoid deadlock
        try { fs.rmdirSync(LOCK_PATH); } catch {}
        continue;
      }
      // Spin-wait with jitter
      const jitter = Math.floor(Math.random() * 10) + 1;
      const waitUntil = Date.now() + jitter;
      while (Date.now() < waitUntil) { /* busy wait (ms-scale) */ }
    }
  }
}

function releaseLock() {
  try { fs.rmdirSync(LOCK_PATH); } catch { /* already released */ }
}

function withLock(fn) {
  acquireLock();
  try {
    return fn();
  } finally {
    releaseLock();
  }
}

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const leases = JSON.parse(raw);
    // TTL cleanup on read: remove expired/exhausted/revoked entries
    const ts = now();
    const active = {};
    for (const [id, lease] of Object.entries(leases)) {
      if (!lease.revoked && ts < lease.deadlineUnix && lease.remainingOps > 0) {
        active[id] = lease;
      }
    }
    return active;
  } catch {
    return {};
  }
}

function writeStore(leases) {
  const data = JSON.stringify(leases, null, 2);
  fs.writeFileSync(STORE_PATH, data, { mode: 0o600 });
}

/**
 * Create a time-bound, operation-counted lease for a resolved token.
 * @param {object} opts
 * @param {string} opts.role - Role slug the lease is scoped to.
 * @param {string} opts.token - GitHub App installation token.
 * @param {number} [opts.maxOps=3] - Maximum exchange operations allowed.
 * @param {number} [opts.maxTimeSec=300] - Lease lifetime in seconds.
 * @returns {{ scopeId: string, role: string, token: string, deadlineUnix: number, remainingOps: number, leasedAtUnix: number }}
 */
export function createLease({ role, token, maxOps = 3, maxTimeSec = 300 }) {
  return withLock(() => {
    const scopeId = `lease_${crypto.randomBytes(8).toString('hex')}`;
    const leasedAtUnix = now();
    const deadlineUnix = leasedAtUnix + maxTimeSec;
    const lease = { scopeId, role, token, deadlineUnix, remainingOps: maxOps, leasedAtUnix, revoked: false };
    const store = readStore();
    store[scopeId] = lease;
    writeStore(store);
    return { scopeId, role, token, deadlineUnix, remainingOps: maxOps, leasedAtUnix };
  });
}

/**
 * Exchange a lease for its token, decrementing the operation counter.
 * @param {string} scopeId - Lease identifier.
 * @param {string} role - Expected role slug (must match the lease).
 * @returns {{ token: string, remainingOps: number }}
 * @throws If lease is missing, expired, exhausted, revoked, or role mismatches.
 */
export function exchangeLease(scopeId, role) {
  const store = readStore();
  const lease = store[scopeId];
  if (!lease) throw new Error(`Lease not found: ${scopeId}`);
  if (lease.revoked) throw new Error('Lease revoked');
  if (now() >= lease.deadlineUnix) throw new Error('Lease expired: deadline reached');
  if (lease.remainingOps === 0) throw new Error('Lease exhausted: no remaining operations');
  if (lease.role !== role) throw new Error(`Role mismatch: lease is for '${lease.role}', not '${role}'`);

  lease.remainingOps -= 1;
  store[scopeId] = lease;
  writeStore(store);
  return { token: lease.token, remainingOps: lease.remainingOps };
}

/**
 * Validate a lease without consuming an operation.
 * @param {string} scopeId
 * @returns {{ valid: boolean, reason?: string, remainingOps?: number, deadlineUnix?: number }}
 */
export function validateLease(scopeId) {
  const store = readStore();
  const lease = store[scopeId];
  if (!lease) return { valid: false, reason: `Lease not found: ${scopeId}` };
  if (lease.revoked) return { valid: false, reason: 'Lease revoked' };
  if (now() >= lease.deadlineUnix) return { valid: false, reason: 'Lease expired: deadline reached' };
  if (lease.remainingOps === 0) return { valid: false, reason: 'Lease exhausted: no remaining operations' };
  return { valid: true, remainingOps: lease.remainingOps, deadlineUnix: lease.deadlineUnix };
}

/**
 * Explicitly revoke a lease.
 * @param {string} scopeId
 */
export function revokeLease(scopeId) {
  const store = readStore();
  const lease = store[scopeId];
  if (lease) {
    lease.revoked = true;
    store[scopeId] = lease;
    writeStore(store);
  }
}

/**
 * Remove all expired or exhausted leases from memory.
 */
export function cleanupExpired() {
  const store = readStore(); // readStore already filters expired entries
  writeStore(store);
}

/**
 * List all active leases (for debugging / status).
 * @returns {Array<{ scopeId: string, role: string, deadlineUnix: number, remainingOps: number, leasedAtUnix: number }>}
 */
export function listLeases() {
  const store = readStore();
  return Object.values(store).map(({ scopeId, role, deadlineUnix, remainingOps, leasedAtUnix }) => ({
    scopeId, role, deadlineUnix, remainingOps, leasedAtUnix,
  }));
}
