/**
 * Extension registration tests
 * Verifies tool registration by parsing extension.mjs source code.
 * (Cannot import extension.mjs directly — requires @github/copilot-sdk)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_ROOT } from './helpers.mjs';

const EXTENSION_PATH = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'extension.mjs');
const extensionSource = readFileSync(EXTENSION_PATH, 'utf-8');

describe('Extension: tool registration', () => {
  // Extract all registerTool calls from source
  const toolNameMatches = [...extensionSource.matchAll(/name:\s*'(squad_identity_\w+)'/g)];
  const registeredTools = toolNameMatches.map(m => m[1]);

  it('registers exactly 12 tools', () => {
    assert.equal(registeredTools.length, 12,
      `Expected 12 tools, found: ${registeredTools.join(', ')}`);
  });

  const expectedTools = [
    'squad_identity_status',
    'squad_identity_doctor',
    'squad_identity_update_charters',
    'squad_identity_update_copilot_instructions',
    'squad_identity_setup_steps',
    'squad_identity_setup_all',
    'squad_identity_generate_create_script',
    'squad_identity_generate_install_script',
    'squad_identity_resolve_token',
    'squad_identity_rotate_key',
    'squad_identity_lease_token',
    'squad_identity_attest_write',
  ];

  for (const tool of expectedTools) {
    it(`registers ${tool}`, () => {
      assert.ok(registeredTools.includes(tool),
        `${tool} not found in registered tools: ${registeredTools.join(', ')}`);
    });
  }

  it('all tools use squad_identity_ prefix', () => {
    for (const tool of registeredTools) {
      assert.ok(tool.startsWith('squad_identity_'),
        `Tool ${tool} should start with squad_identity_`);
    }
  });

  it('no duplicate tool names', () => {
    const unique = new Set(registeredTools);
    assert.equal(unique.size, registeredTools.length, 'tool names should be unique');
  });
});

describe('Extension: tool descriptions', () => {
  // Extract descriptions from registerTool calls
  const descMatches = [...extensionSource.matchAll(/description:\s*'([^']+)'/g)];

  it('every tool has a non-empty description', () => {
    assert.ok(descMatches.length >= 8, `Expected at least 8 descriptions, found ${descMatches.length}`);
    for (const m of descMatches) {
      assert.ok(m[1].length > 10, `Description too short: "${m[1]}"`);
    }
  });
});

describe('Extension: tool handlers', () => {
  it('admin tools call configure-identity.mjs', () => {
    // status, doctor, update_charters, update_copilot_instructions all use runConfigure
    assert.ok(extensionSource.includes("runConfigure(session, '--status')"), 'status should call --status');
    assert.ok(extensionSource.includes("runConfigure(session, '--doctor')"), 'doctor should call --doctor');
    assert.ok(extensionSource.includes("runConfigure(session, '--update-charters')"), 'update_charters should call --update-charters');
    assert.ok(extensionSource.includes("runConfigure(session, '--update-copilot-instructions')"), 'update_copilot_instructions should call --update-copilot-instructions');
  });

  it('resolve_token tool calls resolve-token.mjs', () => {
    assert.ok(extensionSource.includes('resolve-token.mjs'), 'should reference resolve-token.mjs');
  });

  it('rotate_key tool has two modes (import and generate)', () => {
    assert.ok(extensionSource.includes('--import-key'), 'should handle --import-key mode');
    assert.ok(extensionSource.includes('--generate-key'), 'should handle --generate-key mode');
  });

  it('resolve_token accepts roleSlug parameter', () => {
    assert.ok(extensionSource.includes('roleSlug'), 'resolve_token should accept roleSlug');
  });

  it('rotate_key accepts role and pemPath parameters', () => {
    assert.ok(extensionSource.includes("role:"), 'rotate_key should accept role');
    assert.ok(extensionSource.includes("pemPath:"), 'rotate_key should accept pemPath');
  });
});

describe('Extension: structure', () => {
  it('imports from @github/copilot-sdk/extension', () => {
    assert.ok(extensionSource.includes("@github/copilot-sdk/extension"),
      'should import from copilot-sdk');
  });

  it('imports from node:child_process', () => {
    assert.ok(extensionSource.includes("node:child_process"),
      'should import child_process for subprocess calls');
  });

  it('defines LIB_DIR pointing to lib/', () => {
    assert.ok(extensionSource.includes('LIB_DIR'),
      'should define LIB_DIR');
  });

  it('does NOT reference .squad/scripts/ (legacy removed)', () => {
    // The comment about legacy path detection is OK, but no active SCRIPTS_DIR usage
    assert.ok(!extensionSource.includes('SCRIPTS_DIR'),
      'should not have SCRIPTS_DIR constant');
  });

  it('does NOT have onSessionStart sync logic', () => {
    assert.ok(!extensionSource.includes('onSessionStart'),
      'should not have onSessionStart (sync logic removed)');
  });
});
