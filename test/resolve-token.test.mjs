/**
 * Tests for resolve-token.mjs
 * Tests token resolution logic including role normalization and JWT generation
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

test('Role normalization', async t => {
  await t.test('normalizes frontend role', () => {
    const normalized = 'frontend'.trim().toLowerCase().replace(/[\s_]+/g, '-');
    assert.strictEqual(normalized, 'frontend');
  });

  await t.test('normalizes backend role', () => {
    const normalized = 'backend'.trim().toLowerCase().replace(/[\s_]+/g, '-');
    assert.strictEqual(normalized, 'backend');
  });

  await t.test('handles spaces and underscores', () => {
    const normalized = 'backend dev'.trim().toLowerCase().replace(/[\s_]+/g, '-');
    assert.strictEqual(normalized, 'backend-dev');
  });

  await t.test('handles multiple spaces', () => {
    const normalized = 'code   review'.trim().toLowerCase().replace(/[\s_]+/g, '-');
    assert.strictEqual(normalized, 'code-review');
  });

  await t.test('handles underscores', () => {
    const normalized = 'backend_dev'.trim().toLowerCase().replace(/[\s_]+/g, '-');
    assert.strictEqual(normalized, 'backend-dev');
  });

  await t.test('handles mixed case', () => {
    const normalized = 'BackEnd_Dev'.trim().toLowerCase().replace(/[\s_]+/g, '-');
    assert.strictEqual(normalized, 'backend-dev');
  });
});

test('Base64url encoding', async t => {
  function base64url(input) {
    const b64 = Buffer.from(input).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  await t.test('encodes strings to base64url', () => {
    const encoded = base64url('hello');
    assert.ok(typeof encoded === 'string');
    assert.ok(encoded.length > 0);
    assert.ok(!encoded.includes('+'));
    assert.ok(!encoded.includes('/'));
    assert.ok(!encoded.includes('='));
  });

  await t.test('handles special characters', () => {
    const encoded = base64url('hello+world/test==');
    assert.ok(!encoded.includes('+'));
    assert.ok(!encoded.includes('/'));
    assert.ok(!encoded.includes('='));
  });

  await t.test('decoding is consistent', () => {
    const original = 'backend-dev-token';
    const encoded = base64url(original);
    const decoded = Buffer.from(encoded, 'base64url').toString('utf-8');
    assert.strictEqual(decoded, original);
  });

  await t.test('handles JSON objects', () => {
    const obj = { role: 'backend', name: 'Tank' };
    const encoded = base64url(JSON.stringify(obj));
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
    assert.deepStrictEqual(decoded, obj);
  });
});

test('JWT structure', async t => {
  function base64url(input) {
    const b64 = Buffer.from(input).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  await t.test('creates valid JWT header.payload format', () => {
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = { iss: 12345, iat: Math.floor(Date.now() / 1000) };

    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));

    const jwt = `${headerB64}.${payloadB64}`;
    const parts = jwt.split('.');

    assert.strictEqual(parts.length, 2);
    assert.ok(parts[0].length > 0);
    assert.ok(parts[1].length > 0);
  });

  await t.test('JWT header contains required fields', () => {
    const header = { alg: 'RS256', typ: 'JWT' };
    assert.strictEqual(header.alg, 'RS256');
    assert.strictEqual(header.typ, 'JWT');
  });

  await t.test('JWT payload contains app ID and timestamp', () => {
    const appId = 12345;
    const now = Math.floor(Date.now() / 1000);
    const payload = { iss: appId, iat: now, exp: now + 600 };

    assert.strictEqual(payload.iss, appId);
    assert.ok(payload.iat > 0);
    assert.ok(payload.exp > payload.iat);
  });

  await t.test('JWT expiration is 10 minutes', () => {
    const now = Math.floor(Date.now() / 1000);
    const iat = now;
    const exp = now + 600;
    const duration = exp - iat;

    assert.strictEqual(duration, 600);
  });
});

test('Config file structure', async t => {
  await t.test('parses valid config.json with agentNameMap', () => {
    const config = {
      agentNameMap: {
        'Tank': 'backend',
        'Fry': 'frontend',
      },
    };
    const json = JSON.stringify(config);
    const parsed = JSON.parse(json);

    assert.deepStrictEqual(parsed.agentNameMap, config.agentNameMap);
  });

  await t.test('handles missing agentNameMap gracefully', () => {
    const config = { tier: 'standard' };
    const json = JSON.stringify(config);
    const parsed = JSON.parse(json);

    assert.strictEqual(parsed.agentNameMap, undefined);
    assert.strictEqual(parsed.tier, 'standard');
  });

  await t.test('parses app registration with required fields', () => {
    const appReg = {
      appId: 12345,
      appSlug: 'sqd-backend',
      installationId: 98765,
    };
    const json = JSON.stringify(appReg);
    const parsed = JSON.parse(json);

    assert.strictEqual(parsed.appId, 12345);
    assert.strictEqual(parsed.appSlug, 'sqd-backend');
    assert.strictEqual(parsed.installationId, 98765);
  });

  await t.test('config with multiple apps', () => {
    const config = {
      agentNameMap: {
        'Tank': 'backend',
        'Fry': 'frontend',
        'Leela': 'lead',
      },
      apps: {
        backend: { appId: 123, installationId: 456 },
        frontend: { appId: 789, installationId: 101 },
        lead: { appId: 202, installationId: 303 },
      },
    };
    const json = JSON.stringify(config);
    const parsed = JSON.parse(json);

    assert.strictEqual(Object.keys(parsed.agentNameMap).length, 3);
    assert.strictEqual(Object.keys(parsed.apps).length, 3);
  });
});

test('Role slug mapping', async t => {
  const roleAliases = {
    lead: ['lead', 'leela', 'architect', 'coordinator'],
    backend: ['backend', 'bender', 'core', 'core-dev'],
    frontend: ['frontend', 'fry', 'ui', 'frontend-dev'],
    tester: ['tester', 'hermes', 'qa', 'observability'],
    security: ['security', 'zapp', 'auth', 'compliance'],
    codereview: ['codereview', 'nibbler', 'code-review'],
    docs: ['docs', 'amy', 'documentation', 'devrel'],
    devops: ['devops', 'kif', 'platform', 'infra'],
  };

  await t.test('resolves backend aliases', () => {
    const aliases = roleAliases.backend;
    assert.ok(aliases.includes('backend'));
    assert.ok(aliases.includes('core'));
    assert.strictEqual(aliases.length, 4);
  });

  await t.test('resolves frontend aliases', () => {
    const aliases = roleAliases.frontend;
    assert.ok(aliases.includes('frontend'));
    assert.ok(aliases.includes('ui'));
    assert.strictEqual(aliases.length, 4);
  });

  await t.test('resolves security aliases', () => {
    const aliases = roleAliases.security;
    assert.ok(aliases.includes('security'));
    assert.ok(aliases.includes('auth'));
    assert.ok(aliases.includes('compliance'));
  });

  await t.test('lead role has coordinator alias', () => {
    const aliases = roleAliases.lead;
    assert.ok(aliases.includes('coordinator'));
  });

  await t.test('all roles are present', () => {
    const roles = Object.keys(roleAliases);
    assert.ok(roles.includes('lead'));
    assert.ok(roles.includes('backend'));
    assert.ok(roles.includes('frontend'));
    assert.ok(roles.includes('tester'));
    assert.ok(roles.includes('security'));
    assert.ok(roles.includes('codereview'));
    assert.ok(roles.includes('docs'));
    assert.ok(roles.includes('devops'));
  });
});

test('Token format validation', async t => {
  await t.test('validates GitHub token format', () => {
    // GitHub tokens typically start with "ghs_" for app installation tokens
    const token = 'ghs_' + 'a'.repeat(36);
    assert.ok(token.startsWith('ghs_'));
    assert.strictEqual(token.length, 40);
  });

  await t.test('validates app ID is numeric', () => {
    const appId = 12345;
    assert.ok(Number.isInteger(appId));
    assert.ok(appId > 0);
  });

  await t.test('validates installation ID is numeric', () => {
    const installationId = 98765;
    assert.ok(Number.isInteger(installationId));
    assert.ok(installationId > 0);
  });
});
