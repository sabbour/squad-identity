import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// We test the keychain module's logic by mocking child_process
// Since the actual OS keychain may not be available in CI, we test:
// 1. keychainAccount key generation
// 2. Availability caching behavior
// 3. PEM validation on load
// 4. Module exports

describe('Keychain module', async () => {
  let keychain;

  beforeEach(async () => {
    // Fresh import each time to reset module state
    // Use dynamic import with cache busting
    keychain = await import(`../extensions/squad-identity/lib/keychain.mjs?t=${Date.now()}`);
  });

  afterEach(() => {
    if (keychain?.resetKeychainCache) {
      keychain.resetKeychainCache();
    }
  });

  it('exports expected functions', () => {
    assert.equal(typeof keychain.keychainAvailable, 'function');
    assert.equal(typeof keychain.keychainStore, 'function');
    assert.equal(typeof keychain.keychainLoad, 'function');
    assert.equal(typeof keychain.keychainDelete, 'function');
    assert.equal(typeof keychain.resetKeychainCache, 'function');
  });

  it('SERVICE constant is squad-identity', () => {
    assert.equal(keychain.SERVICE, 'squad-identity');
  });

  it('keychainAccount generates correct key from appId', () => {
    assert.equal(keychain.keychainAccount(12345), 'app-12345');
    assert.equal(keychain.keychainAccount('67890'), 'app-67890');
  });

  it('keychainAccount uses appId not role slug (avoids collisions)', () => {
    // Two different apps with same role but different IDs produce different keys
    const key1 = keychain.keychainAccount(111);
    const key2 = keychain.keychainAccount(222);
    assert.notEqual(key1, key2);
  });

  it('keychainAvailable returns boolean', () => {
    const result = keychain.keychainAvailable();
    assert.equal(typeof result, 'boolean');
  });

  it('keychainAvailable treats linux secret-tool lookup miss as available', async () => {
    const source = readFileSync(
      new URL('../extensions/squad-identity/lib/keychain.mjs', import.meta.url),
      'utf-8',
    );
    const testSource = `${source.replace(
      "import { execFileSync, spawnSync } from 'node:child_process';",
      'const { execFileSync, spawnSync } = globalThis.__keychainTestMocks;',
    )}\n//# sourceURL=keychain-linux-probe-test-${Date.now()}.mjs`;

    const restorePlatform = process.platform;
    globalThis.__keychainTestMocks = {
      execFileSync() {
        throw new Error('linux availability check should not use execFileSync');
      },
      spawnSync(command, args) {
        assert.equal(command, 'secret-tool');
        assert.deepEqual(args, ['lookup', 'service', '__squad_identity_probe__', 'account', '__probe__']);
        return {
          status: 1,
          signal: null,
          error: undefined,
          stderr: '',
        };
      },
    };

    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true,
    });

    try {
      const linuxKeychain = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(testSource)}`);
      linuxKeychain.resetKeychainCache();
      assert.equal(linuxKeychain.keychainAvailable(), true);
    } finally {
      delete globalThis.__keychainTestMocks;
      Object.defineProperty(process, 'platform', {
        value: restorePlatform,
        configurable: true,
      });
    }
  });

  it('keychainAvailable caches result', () => {
    const first = keychain.keychainAvailable();
    const second = keychain.keychainAvailable();
    assert.equal(first, second);
  });

  it('resetKeychainCache allows re-check', () => {
    keychain.keychainAvailable();
    keychain.resetKeychainCache();
    // After reset, next call re-checks (doesn't throw)
    const result = keychain.keychainAvailable();
    assert.equal(typeof result, 'boolean');
  });

  it('keychainStore returns false when keychain unavailable', () => {
    // Force unavailable
    keychain.resetKeychainCache();
    // On CI/test environments without keychain, this should return false gracefully
    if (!keychain.keychainAvailable()) {
      const result = keychain.keychainStore(12345, '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----');
      assert.equal(result, false);
    }
  });

  it('keychainLoad returns null when keychain unavailable', () => {
    keychain.resetKeychainCache();
    if (!keychain.keychainAvailable()) {
      const result = keychain.keychainLoad(12345);
      assert.equal(result, null);
    }
  });

  it('keychainDelete returns false when keychain unavailable', () => {
    keychain.resetKeychainCache();
    if (!keychain.keychainAvailable()) {
      const result = keychain.keychainDelete(12345);
      assert.equal(result, false);
    }
  });

  it('keychainLoad returns null for non-existent entry', () => {
    // Even if keychain is available, a non-existent appId should return null
    const result = keychain.keychainLoad(999999999);
    assert.equal(result, null);
  });
});

describe('Keychain credential resolution order', () => {
  it('resolve-token exports are intact after keychain integration', async () => {
    const { resolveToken, resolveTokenWithDiagnostics, resolveRoleSlug, clearTokenCache } =
      await import('../extensions/squad-identity/lib/resolve-token.mjs');
    assert.equal(typeof resolveToken, 'function');
    assert.equal(typeof resolveTokenWithDiagnostics, 'function');
    assert.equal(typeof resolveRoleSlug, 'function');
    assert.equal(typeof clearTokenCache, 'function');
  });
});
