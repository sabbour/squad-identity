/**
 * Generated script tool tests
 * Verifies the new extension tools are registered with the expected script content.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_ROOT } from './helpers.mjs';

const EXTENSION_PATH = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'extension.mjs');
const extensionSource = readFileSync(EXTENSION_PATH, 'utf-8');

describe('Extension: generate create script tool', () => {
  it('registers the tool with an optional roles array schema', () => {
    assert.match(
      extensionSource,
      /name:\s*'squad_identity_generate_create_script'[\s\S]*?roles:\s*\{[\s\S]*?type:\s*'array'/,
    );
  });

  it('uses team role discovery and app registration reads', () => {
    assert.ok(extensionSource.includes("function parseTeamRoster"), 'should parse .squad/team.md');
    assert.ok(extensionSource.includes("function matchRolePattern"), 'should reuse role pattern matching');
    assert.ok(extensionSource.includes("function loadAppRegistrations"), 'should read app registrations');
  });

  it('generates prerequisite checks and create-app commands', () => {
    assert.ok(extensionSource.includes('node --version >/dev/null'), 'should check node availability');
    assert.ok(extensionSource.includes('gh auth status >/dev/null'), 'should check gh auth');
    assert.ok(extensionSource.includes('squad-identity create-app --role ${role}'), 'should generate create-app commands');
    assert.ok(extensionSource.includes('squad-identity doctor'), 'should verify with doctor at the end');
  });
});

describe('Extension: generate install script tool', () => {
  it('registers the tool with an optional roles array schema', () => {
    assert.match(
      extensionSource,
      /name:\s*'squad_identity_generate_install_script'[\s\S]*?roles:\s*\{[\s\S]*?type:\s*'array'/,
    );
  });

  it('reads registered apps and installation status from app JSON files', () => {
    assert.ok(extensionSource.includes('.squad/identity/apps/'), 'should reference app registrations directory');
    assert.ok(extensionSource.includes('installationId'), 'should inspect installation IDs');
  });

  it('generates install URLs, waits for user confirmation, and runs setup', () => {
    assert.ok(extensionSource.includes('https://github.com/apps/${app.slug}/installations/new'), 'should generate app install URLs');
    assert.ok(extensionSource.includes('press Enter to continue'), 'should pause for browser install completion');
    assert.ok(extensionSource.includes('squad-identity setup'), 'should run setup to capture installation IDs');
  });
});
