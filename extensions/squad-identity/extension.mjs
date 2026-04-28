/**
 * squad-identity extension for GitHub Copilot CLI
 *
 * Registers identity management tools and syncs lib/*.mjs → .squad/scripts/
 * on session start so Squad bot agents can call scripts without knowing paths.
 *
 * @see https://github.com/github/copilot-sdk
 */

import { joinSession } from '@github/copilot-sdk/extension';
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_DIR   = join(__dirname, 'lib');

// Resolve REPO_ROOT by walking up from extension dir (.github/extensions/squad-identity/)
const REPO_ROOT   = join(__dirname, '..', '..', '..');
const SCRIPTS_DIR = join(REPO_ROOT, '.squad', 'scripts');
const CONFIGURE   = join(LIB_DIR, 'configure-identity.mjs');

// ---------------------------------------------------------------------------
// Helper: run configure-identity.mjs with a flag, return stdout
// ---------------------------------------------------------------------------

async function runConfigure(session, flag) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [CONFIGURE, flag],
      { cwd: REPO_ROOT, timeout: 30000 }
    );
    if (stderr) session.log(stderr);
    return stdout;
  } catch (err) {
    const msg = err.stdout || err.stderr || err.message;
    session.log(`configure-identity ${flag} error: ${msg}`);
    return msg;
  }
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

joinSession(async session => {

  // -------------------------------------------------------------------------
  // onSessionStart — sync lib/*.mjs → .squad/scripts/
  // -------------------------------------------------------------------------

  session.onSessionStart(async () => {
    if (!existsSync(LIB_DIR)) return {};

    mkdirSync(SCRIPTS_DIR, { recursive: true });
    let synced = 0;
    for (const file of readdirSync(LIB_DIR)) {
      if (!file.endsWith('.mjs')) continue;
      const dest = join(SCRIPTS_DIR, file);
      if (!existsSync(dest)) {
        copyFileSync(join(LIB_DIR, file), dest);
        synced++;
      }
    }
    if (synced > 0) {
      session.log(`[squad-identity] Synced ${synced} script(s) to .squad/scripts/`);
    }
    return {};
  });

  // -------------------------------------------------------------------------
  // Tool: identity_status
  // -------------------------------------------------------------------------

  session.registerTool({
    name: 'identity_status',
    description: 'Show the current Squad identity configuration: agentNameMap (agent name → role slug) and registered GitHub App registrations.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: async () => {
      const out = await runConfigure(session, '--status');
      return { type: 'text', text: out || 'No output.' };
    },
  });

  // -------------------------------------------------------------------------
  // Tool: identity_doctor
  // -------------------------------------------------------------------------

  session.registerTool({
    name: 'identity_doctor',
    description: 'Run a health check on the Squad identity setup: verifies config.json exists, agentNameMap is populated, PEM keys are readable, resolve-token.mjs is accessible, and token resolution succeeds for the lead role.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: async () => {
      const out = await runConfigure(session, '--doctor');
      return { type: 'text', text: out || 'No output.' };
    },
  });

  // -------------------------------------------------------------------------
  // Tool: identity_update_charters
  // -------------------------------------------------------------------------

  session.registerTool({
    name: 'identity_update_charters',
    description: 'Parse .squad/team.md to infer the agent-name → role-slug mapping, write it to .squad/identity/config.json as agentNameMap, and inject a concrete ROLE_SLUG="<slug>" line into each agent charter. Also adds a skill pointer to .squad/skills/squad-identity/SKILL.md. Idempotent.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: async () => {
      const out = await runConfigure(session, '--update-charters');
      return { type: 'text', text: out || 'No output.' };
    },
  });

  // -------------------------------------------------------------------------
  // Tool: identity_update_copilot_instructions
  // -------------------------------------------------------------------------

  session.registerTool({
    name: 'identity_update_copilot_instructions',
    description: 'Replace or append the Squad identity block in .github/copilot-instructions.md. The block explains how agents should resolve ROLE_SLUG, obtain a bot token, and run post-flight checks. Safe to run after every squad upgrade.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: async () => {
      const out = await runConfigure(session, '--update-copilot-instructions');
      return { type: 'text', text: out || 'No output.' };
    },
  });

  // -------------------------------------------------------------------------
  // Tool: identity_setup_steps
  // -------------------------------------------------------------------------

  session.registerTool({
    name: 'identity_setup_steps',
    description: 'Return step-by-step instructions for setting up GitHub App bot identity from scratch. Some steps (GitHub App creation, OAuth) require a browser and are run manually.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: async () => {
      const text = `
# Squad Identity — Setup Steps

These steps configure GitHub App bot identity so each Squad agent writes to
GitHub as its own \`{app-slug}[bot]\` account instead of the human operator.

## Prerequisites
- \`gh\` CLI authenticated (\`gh auth status\`)
- \`node\` >= 18

## Step 1 — Create GitHub Apps (browser required)

Run interactively — this opens your browser for OAuth:

\`\`\`bash
node .squad/scripts/create-app.mjs
\`\`\`

Repeat once per role (lead, frontend, backend, tester, security, codereview, devops, docs, scribe).
Each run creates one GitHub App and saves its config + private key.

## Step 2 — Install Apps into your org/repo

\`\`\`bash
node .squad/scripts/install-apps.mjs
\`\`\`

## Step 3 — Upload secrets

\`\`\`bash
node .squad/scripts/sync-secrets.mjs
\`\`\`

This uploads PEM keys and app metadata as GitHub Actions secrets.

## Step 4 — Update agent charters

Run the tool or:
\`\`\`bash
node .squad/scripts/configure-identity.mjs --update-charters
\`\`\`

This infers each agent's role slug from \`.squad/team.md\`, writes \`agentNameMap\`
to \`.squad/identity/config.json\`, and injects \`ROLE_SLUG="<slug>"\` into each charter.

## Step 5 — Update copilot-instructions.md

\`\`\`bash
node .squad/scripts/configure-identity.mjs --update-copilot-instructions
\`\`\`

## Step 6 — Verify

\`\`\`bash
node .squad/scripts/configure-identity.mjs --doctor
\`\`\`

## After a \`squad upgrade\`

Only steps 4 and 5 need to re-run (charters and copilot-instructions may be overwritten).
Everything in \`.squad/identity/\` and \`.github/extensions/\` survives upgrades.

## Key files

| File | Purpose |
|------|---------|
| \`.squad/identity/config.json\` | App registrations + agentNameMap |
| \`.squad/identity/keys/*.pem\` | Private keys (never committed) |
| \`.squad/scripts/resolve-token.mjs\` | Token resolver called by agents |
| \`.squad/scripts/post-flight-check.mjs\` | Post-write identity verifier |
| \`.squad/skills/squad-identity/SKILL.md\` | Protocol agents read at spawn |
`.trim();

      return { type: 'text', text };
    },
  });

});
