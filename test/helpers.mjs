/**
 * Shared test helpers — fresh git repo fixtures, CLI runner, etc.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = join(__dirname, '..');
export const CLI_PATH = join(PACKAGE_ROOT, 'bin', 'squad-identity.mjs');

/**
 * Create a fresh temp directory with a git repo initialized.
 * Optionally populate with .squad/team.md and agent charters.
 */
export function createFixtureRepo({ teamMd = true, charters = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'squad-identity-test-'));

  // Init git repo (required for CLI commands that call git rev-parse)
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir, stdio: 'ignore' });

  // Create an initial commit so HEAD exists
  writeFileSync(join(dir, '.gitkeep'), '');
  execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' });

  if (teamMd) {
    mkdirSync(join(dir, '.squad'), { recursive: true });
    writeFileSync(join(dir, '.squad', 'team.md'), SAMPLE_TEAM_MD);
  }

  if (charters) {
    for (const [name, content] of Object.entries(SAMPLE_CHARTERS)) {
      const charterDir = join(dir, '.squad', 'agents', name);
      mkdirSync(charterDir, { recursive: true });
      writeFileSync(join(charterDir, 'charter.md'), content);
    }
  }

  return dir;
}

/**
 * Clean up a fixture directory.
 */
export function cleanupFixture(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Run the squad-identity CLI with given args, in a specified cwd.
 * Returns { status, stdout, stderr }.
 */
export function runCli(args, { cwd = process.cwd(), input } = {}) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    input,
    timeout: 30000,
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

/**
 * Run a lib script directly (e.g., configure-identity.mjs).
 */
export function runLib(script, args, { cwd = process.cwd() } = {}) {
  const scriptPath = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', script);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

export const SAMPLE_TEAM_MD = `# Team

## Members

| Name | Role | Description |
|------|------|-------------|
| Morpheus | Lead Architect | Coordinates the team |
| Tank | Backend Developer | Builds APIs and services |
| Switch | Frontend Developer | Builds UI components |
| Dozer | DevOps Engineer | Platform and infrastructure |
| Oracle | Security Analyst | Security and compliance |
| Mouse | Tester | QA and test automation |
| Cypher | Code Reviewer | Reviews PRs and code quality |
| Niobe | Documentation Writer | Technical docs and devrel |
| Link | Scribe | Session logging and memory |
`;

export const SAMPLE_CHARTERS = {
  morpheus: `# Morpheus — Lead Architect

You are the team coordinator and architect.

ROLE_SLUG="lead"  # injected by configure-identity --update-charters; do not edit
`,
  tank: `# Tank — Backend Developer

You build APIs and backend services.

ROLE_SLUG="backend"  # injected by configure-identity --update-charters; do not edit
`,
  switch: `# Switch — Frontend Developer

You build UI components and web experiences.
`,
};
