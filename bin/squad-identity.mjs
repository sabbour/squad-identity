#!/usr/bin/env node

import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, '..');
const VERSION = '1.0.0';

const EXIT_USER = 1;
const EXIT_SYSTEM = 2;

const ROLE_KEYWORDS = {
  lead: ['lead', 'architect', 'tech lead'],
  frontend: ['frontend', 'ui', 'design'],
  backend: ['backend', 'api', 'server'],
  tester: ['test', 'qa', 'quality'],
  security: ['security', 'auth', 'compliance'],
  codereview: ['code review', 'reviewer', 'review'],
  devops: ['devops', 'infra', 'platform'],
  docs: ['docs', 'devrel', 'writer'],
  scribe: ['scribe'],
  data: ['data', 'database', 'analytics'],
};

function printMainHelp() {
  console.log(`squad-identity ${VERSION}

Usage:
  squad-identity <command> [target-repo]

Commands:
  setup [target-repo]       Full guided setup (recommended)
  doctor                    Run health checks
  resolve-token --role <r>  Resolve a bot installation token
  rotate-key --role <r>     Rotate a private key
  import-app --role <r>     Register an existing GitHub App
  upgrade [target-repo]     Refresh installed files
  init [target-repo]        Install files only (advanced)
  help                      Show this help

Options:
  -h, --help             Show help
  -v, --version          Show version`);
}

function printCommandHelp(command) {
  const help = {
    init: `Usage: squad-identity init [target-repo]\n\nInstalls the Copilot CLI extension, Squad skill, identity config template, and rotation runbook. If target-repo is omitted, the current git repository root is used.`,
    setup: `Usage: squad-identity setup [target-repo] [--force]\n\nThe primary entry point for squad-identity setup. Runs the full guided flow idempotently and skips already-configured steps unless --force is passed.\n\nPhases:\n  1. Init — install extension, skill, config (if missing)\n  2. Discover — read .squad/team.md for agent roles\n  3. Apps — create or import GitHub Apps per role\n  4. Install — install apps into the repo\n  5. Configure — update charters + copilot-instructions\n  6. Health — run doctor to verify\n\nOptions:\n  --force    Re-prompt for all roles and reapply setup steps, even if already configured`,
    'resolve-token': `Usage: squad-identity resolve-token --role <role>\n\nResolve a bot GitHub installation token for the given role. Prints the token to stdout so it can be captured in shell scripts.\n\nRequired:\n  --role <role>   Role slug (e.g. backend, frontend, lead)`,
    upgrade: `Usage: squad-identity upgrade [target-repo]\n\nRefreshes extension and skill files, then reapplies the squad-identity block in .github/copilot-instructions.md. Existing identity config and PEM keys are never touched.`,
    'rotate-key': `Usage: squad-identity rotate-key --role <role> [--pem <path>]\n\nRotate a GitHub App private key for a role.\n\nWithout --pem:\n  Opens the GitHub App settings page so you can generate a new key.\n  After downloading, run again with --pem to import.\n\nWith --pem:\n  Imports the PEM file into the OS keychain, replacing any existing key.`,
    'create-app': `Usage: squad-identity create-app --role <role> [--owner <username>] [--prefix <prefix>] [--name <name>]\n\nCreate a new GitHub App for a role using the GitHub manifest flow.\nOpens a browser to complete the OAuth authorization.\n\nRequired:\n  --role <role>       Role slug (e.g., lead, backend, frontend, tester)\n\nOptional:\n  --owner <username>  GitHub username or org for the app (default: authenticated user)\n  --prefix <prefix>   App name prefix (default: sqd)\n  --name <name>       Override the generated app name entirely\n\nThe manifest flow creates the app, generates a PEM key, and stores it\nin the OS keychain. The app registration is saved to .squad/identity/apps/<role>.json.`,
    'import-app': `Usage: squad-identity import-app --role <role> (--app-id <id> --app-slug <slug> --pem <path> | --search <name>) [--force]\n\nRegister an existing GitHub App for a role. Use this when you already have a\nGitHub App created (manually or from another repo) instead of creating a new one.\n\nRequired:\n  --role <role>       Role slug (e.g., lead, backend, frontend, tester)\n\nDirect import mode:\n  --app-id <id>       GitHub App ID (numeric)\n  --app-slug <slug>   GitHub App slug (e.g., my-squad-backend)\n  --pem <path>        Path to the PEM private key file\n\nSearch mode:\n  --search <name>     Find an existing GitHub App by name or slug, then continue with import\n\nOptional:\n  --client-id <id>    OAuth client ID (if known)\n  --org <org>         Search this organization's installations too when using --search\n  --force             Overwrite existing role registration without prompting\n\nThe PEM is stored in the OS keychain and the local file is NOT kept.\nThe app registration is saved to .squad/identity/apps/<role>.json.`,
    doctor: `Usage: squad-identity doctor\n\nRuns the existing configure-identity.mjs --doctor health check in the current Squad repo.`,
  };
  console.log(help[command] ?? 'Unknown command.');
}

function failUser(message) {
  console.error(`❌ ${message}`);
  process.exit(EXIT_USER);
}

function failSystem(message) {
  console.error(`❌ ${message}`);
  process.exit(EXIT_SYSTEM);
}

function gitRootFromCwd() {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function resolveTarget(args) {
  const explicit = args.find(arg => !arg.startsWith('-'));
  const target = explicit ? resolve(explicit) : gitRootFromCwd();
  if (!target) failUser('target repo not provided and current directory is not inside a git repo');
  if (!existsSync(target)) failUser(`target repo does not exist: ${target}`);
  return target;
}

function copyMjsDir(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const file of readdirSync(sourceDir)) {
    if (!file.endsWith('.mjs')) continue;
    copyFileSync(join(sourceDir, file), join(targetDir, file));
  }
}

function parseRolesOption(args) {
  let rolesValue = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--roles') {
      if (!args[index + 1] || args[index + 1].startsWith('--')) {
        failUser('--roles requires a comma-separated list of role slugs.');
      }
      rolesValue = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--roles=')) {
      rolesValue = arg.slice('--roles='.length);
    }
  }

  if (rolesValue == null) return null;

  const roles = rolesValue
    .split(',')
    .map(role => role.trim())
    .filter(Boolean);

  if (roles.length === 0) {
    failUser('--roles requires a comma-separated list of role slugs.');
  }

  return [...new Set(roles)];
}

function loadAppRegistrations(target) {
  const appsDir = join(target, '.squad', 'identity', 'apps');
  const registrations = new Map();

  if (!existsSync(appsDir)) return registrations;

  for (const file of readdirSync(appsDir)) {
    if (!file.endsWith('.json')) continue;
    const role = file.replace(/\.json$/, '');
    try {
      registrations.set(role, JSON.parse(readFileSync(join(appsDir, file), 'utf8')));
    } catch {
      registrations.set(role, {});
    }
  }

  return registrations;
}

function discoverNeededRoles(target) {
  const teamMdPath = join(target, '.squad', 'team.md');
  if (!existsSync(teamMdPath)) {
    failUser(`.squad/team.md not found at ${teamMdPath}. Create it with your team roster first.`);
  }

  const teamContent = readFileSync(teamMdPath, 'utf-8').toLowerCase();
  const neededRoles = [];

  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    if (keywords.some(keyword => teamContent.includes(keyword))) {
      neededRoles.push(role);
    }
  }

  if (neededRoles.length === 0) {
    failUser('Could not infer any roles from .squad/team.md. Check the Members table.');
  }

  return neededRoles;
}

function runLibScript(scriptName, scriptArgs, cwd) {
  const scriptPath = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    cwd,
    stdio: 'inherit',
  });
  if (result.error) failSystem(result.error.message);
  return result;
}

function syncInstallFiles(target, { includeIdentityConfig }) {
  const sourceExtDir = join(PACKAGE_ROOT, 'extensions', 'squad-identity');
  const sourceExtLib = join(sourceExtDir, 'lib');
  const targetExtDir = join(target, '.github', 'extensions', 'squad-identity');
  const targetExtLib = join(targetExtDir, 'lib');

  mkdirSync(targetExtLib, { recursive: true });
  copyFileSync(join(sourceExtDir, 'extension.mjs'), join(targetExtDir, 'extension.mjs'));
  copyMjsDir(sourceExtLib, targetExtLib);
  console.log(`✅ Extension installed → ${targetExtDir}`);

  const skillDir = join(target, '.squad', 'skills', 'squad-identity');
  mkdirSync(skillDir, { recursive: true });
  copyFileSync(join(PACKAGE_ROOT, 'squad-identity', 'SKILL.md'), join(skillDir, 'SKILL.md'));
  console.log(`✅ Skill installed    → ${join(skillDir, 'SKILL.md')}`);

  const identityDir = join(target, '.squad', 'identity');
  const configFile = join(identityDir, 'config.json');
  mkdirSync(identityDir, { recursive: true });

  if (includeIdentityConfig) {
    if (!existsSync(configFile)) {
      copyFileSync(join(PACKAGE_ROOT, 'identity', 'config.json.template'), configFile);
      console.log(`✅ Identity config    → ${configFile} (template — fill in your app details)`);
    } else {
      console.log('✓  Identity config already exists — not overwritten');
    }
  }

}

function runConfigure(flag, cwd) {
  const configure = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', 'configure-identity.mjs');
  const result = spawnSync(process.execPath, [configure, flag], {
    cwd,
    stdio: 'inherit',
  });
  if (result.error) failSystem(result.error.message);
  process.exit(result.status ?? EXIT_SYSTEM);
}

function runConfigureForUpgrade(flag, cwd) {
  const configure = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', 'configure-identity.mjs');
  const result = spawnSync(process.execPath, [configure, flag], {
    cwd,
    stdio: 'inherit',
  });
  if (result.error) failSystem(result.error.message);
  if ((result.status ?? EXIT_SYSTEM) !== 0) process.exit(result.status ?? EXIT_SYSTEM);
}

function printNextSteps() {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ squad-identity installed successfully.

Next steps:
  1. Restart Copilot CLI to load the extension
  2. Call: squad_identity_setup_steps
     (for first-time setup with no GitHub Apps yet)
  3. Or if Apps already exist:
     squad_identity_update_charters
     squad_identity_doctor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

async function loadKeychainModule() {
  const keychainPath = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', 'keychain.mjs');
  try {
    return await import(pathToFileURL(keychainPath).href);
  } catch {
    return null;
  }
}

async function hasPemForRole(role, appId, keychainModule) {
  const envKey = role.toUpperCase();
  if (process.env[`SQUAD_${envKey}_PRIVATE_KEY`]) {
    return true;
  }

  if (!keychainModule?.keychainLoad || !appId) {
    return false;
  }

  try {
    return !!keychainModule.keychainLoad(String(appId));
  } catch {
    return false;
  }
}

async function checkRoleStatus(target, role, registration, keychainModule) {
  if (!registration || !registration.appId) return 'needs_creation';

  const hasPem = await hasPemForRole(role, registration.appId, keychainModule);
  if (!hasPem) return 'needs_pem';
  if (!registration.installationId) return 'needs_install';
  return 'fully_configured';
}

function formatRoleStatus(status) {
  if (status === 'fully_configured') return '✅ app + PEM + installed';
  if (status === 'needs_pem') return '⚠️  app exists, no PEM';
  if (status === 'needs_install') return '⚠️  app exists, not installed';
  return '🆕 needs app creation';
}

async function importExistingAppForRole(target, role, ask) {
  const appIdStr = await ask(`    App ID (numeric): `);
  const slug = await ask(`    App slug: `);
  const pem = await ask(`    PEM file path: `);

  const numericAppId = parseInt(appIdStr.trim(), 10);
  if (isNaN(numericAppId)) {
    console.error(`    ⚠️  Invalid app ID "${appIdStr.trim()}". Skipping ${role}.\n`);
    return;
  }

  const resolvedPem = resolve(pem.trim().replace(/^~/, process.env.HOME ?? ''));
  if (!existsSync(resolvedPem)) {
    console.error(`    ⚠️  PEM file not found: ${resolvedPem}. Skipping ${role}.\n`);
    return;
  }

  const pemContent = readFileSync(resolvedPem, 'utf8');
  if (!pemContent.includes('-----BEGIN RSA PRIVATE KEY-----') && !pemContent.includes('-----BEGIN PRIVATE KEY-----')) {
    console.error(`    ⚠️  File does not appear to be a PEM key. Skipping ${role}.\n`);
    return;
  }

  const appsDir = join(target, '.squad', 'identity', 'apps');
  mkdirSync(appsDir, { recursive: true });
  const appPath = join(appsDir, `${role}.json`);
  writeFileSync(appPath, JSON.stringify({ appId: numericAppId, slug: slug.trim() }, null, 2) + '\n', 'utf8');

  const createApp = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', 'create-app.mjs');
  const importResult = spawnSync(process.execPath, [createApp, '--import-key', resolvedPem, '--role', role], {
    cwd: target,
    stdio: 'inherit',
  });
  if (importResult.status !== 0) {
    console.error(`    ⚠️  PEM import failed for ${role}. Registration saved — run rotate-key later.\n`);
  } else {
    console.log(`    ✅ Imported existing app for ${role}\n`);
  }
}

function createAppForRole(target, role) {
  const createApp = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', 'create-app.mjs');
  console.log(`\n━━━ Creating app for role: ${role} ━━━\n`);
  const result = spawnSync(process.execPath, [createApp, '--role', role, '--icon'], {
    cwd: target,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`\n⚠️  Failed to create app for role "${role}". Continuing...`);
  }
}

function rotateKeyForRole(role, target) {
  const selfPath = fileURLToPath(import.meta.url);
  const result = spawnSync(process.execPath, [selfPath, 'rotate-key', '--role', role], {
    cwd: target,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`\n⚠️  Failed to start key rotation for role "${role}". Continuing...`);
  }
}

function cmdInit(args) {
  if (args.includes('--help') || args.includes('-h')) return printCommandHelp('init');
  const target = resolveTarget(args);
  console.log(`🔧 Installing squad-identity into: ${target}\n`);
  try {
    syncInstallFiles(target, { includeIdentityConfig: true });
    printNextSteps();
  } catch (err) {
    failSystem(err.message);
  }
}

function cmdUpgrade(args) {
  if (args.includes('--help') || args.includes('-h')) return printCommandHelp('upgrade');
  const target = resolveTarget(args);
  console.log(`🔧 Upgrading squad-identity in: ${target}\n`);
  try {
    syncInstallFiles(target, { includeIdentityConfig: false });
  } catch (err) {
    failSystem(err.message);
  }
  runConfigureForUpgrade('--update-copilot-instructions', target);
  console.log('\n✅ squad-identity upgrade complete.');
}

async function cmdSetup(args) {
  if (args.includes('--help') || args.includes('-h')) return printCommandHelp('setup');

  const force = args.includes('--force') || args.includes('--reconfigure');
  const target = resolveTarget(args);
  const configure = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', 'configure-identity.mjs');

  console.log('\n━━━ Phase 1: Initialize ━━━\n');
  const extDir = join(target, '.github', 'extensions', 'squad-identity');
  const skillPath = join(target, '.squad', 'skills', 'squad-identity', 'SKILL.md');
  const configPath = join(target, '.squad', 'identity', 'config.json');
  const needsInit = force || !existsSync(extDir) || !existsSync(skillPath) || !existsSync(configPath);

  if (needsInit) {
    if (force) {
      console.log('🔧 --force enabled; reapplying install files.\n');
    } else {
      console.log('🔧 Installing missing setup files.\n');
    }
    syncInstallFiles(target, { includeIdentityConfig: true });
  } else {
    console.log('✅ Extension, skill, and identity config already present — skipping init.');
  }

  console.log('\n━━━ Phase 2: Discover roles ━━━\n');
  const neededRoles = discoverNeededRoles(target);
  const keychainModule = await loadKeychainModule();
  let registrations = loadAppRegistrations(target);
  const roleStatuses = new Map();

  console.log(`🔍 Discovered ${neededRoles.length} roles from .squad/team.md:\n`);
  for (const role of neededRoles) {
    const status = await checkRoleStatus(target, role, registrations.get(role), keychainModule);
    roleStatuses.set(role, status);
    console.log(`   ${role.padEnd(12)} ${formatRoleStatus(status)}`);
  }

  console.log('\n━━━ Phase 3: Create or register apps ━━━\n');
  const rolesToPrompt = force
    ? neededRoles
    : neededRoles.filter(role => ['needs_creation', 'needs_pem'].includes(roleStatuses.get(role)));

  if (rolesToPrompt.length === 0) {
    console.log('✅ All roles already have an app registration and PEM — skipping app prompts.');
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(res => rl.question(q, res));

    try {
      for (const role of rolesToPrompt) {
        const currentStatus = roleStatuses.get(role);

        if (currentStatus === 'needs_pem') {
          console.log(`  ${role}: app exists but PEM is missing.`);
          const choice = await ask('    [R]otate key / [i]mport existing / [s]kip? ');
          const selected = choice.trim().toLowerCase();

          if (selected === 'r') {
            rotateKeyForRole(role, target);
          } else if (selected === 'i') {
            await importExistingAppForRole(target, role, ask);
          } else {
            console.log(`    ⏭️  Skipped ${role}\n`);
          }
        } else {
          if (currentStatus === 'fully_configured') {
            console.log(`  ${role}: already fully configured.`);
          } else if (currentStatus === 'needs_install') {
            console.log(`  ${role}: app + PEM already present; install still needed.`);
          }

          const choice = await ask(`  ${role}: [C]reate / [i]mport / [s]kip? `);
          const selected = choice.trim().toLowerCase();

          if (selected === 'i') {
            await importExistingAppForRole(target, role, ask);
          } else if (selected === 's') {
            console.log(`    ⏭️  Skipped ${role}\n`);
          } else {
            createAppForRole(target, role);
          }
        }

        registrations = loadAppRegistrations(target);
        roleStatuses.set(role, await checkRoleStatus(target, role, registrations.get(role), keychainModule));
      }
    } finally {
      rl.close();
    }
  }

  console.log('\n━━━ Phase 4: Install apps ━━━\n');
  registrations = loadAppRegistrations(target);
  for (const role of neededRoles) {
    roleStatuses.set(role, await checkRoleStatus(target, role, registrations.get(role), keychainModule));
  }

  const rolesToInstall = neededRoles.filter(role => roleStatuses.get(role) === 'needs_install');
  if (rolesToInstall.length === 0) {
    console.log('✅ No app installs pending — skipping install phase.');
  } else {
    console.log(`📦 Roles needing installation: ${rolesToInstall.join(', ')}\n`);
    for (const role of rolesToInstall) {
      console.log(`━━━ Installing app for role: ${role} ━━━\n`);
      const result = runLibScript('install-apps.mjs', ['--role', role], target);
      if ((result.status ?? EXIT_SYSTEM) !== 0) {
        console.error(`⚠️  Install step failed for ${role}. Continuing...\n`);
      }
    }
  }

  console.log('\n━━━ Phase 5: Configure repo ━━━\n');
  const updateCharters = spawnSync(process.execPath, [configure, '--update-charters'], {
    cwd: target,
    stdio: 'inherit',
  });
  if (updateCharters.error) failSystem(updateCharters.error.message);
  if ((updateCharters.status ?? EXIT_SYSTEM) !== 0) process.exit(updateCharters.status ?? EXIT_SYSTEM);

  const updateInstructions = spawnSync(process.execPath, [configure, '--update-copilot-instructions'], {
    cwd: target,
    stdio: 'inherit',
  });
  if (updateInstructions.error) failSystem(updateInstructions.error.message);
  if ((updateInstructions.status ?? EXIT_SYSTEM) !== 0) process.exit(updateInstructions.status ?? EXIT_SYSTEM);

  console.log('\n━━━ Phase 6: Health check ━━━\n');
  const doctorResult = spawnSync(process.execPath, [configure, '--doctor'], {
    cwd: target,
    stdio: 'inherit',
  });
  if (doctorResult.error) failSystem(doctorResult.error.message);
  if ((doctorResult.status ?? EXIT_SYSTEM) !== 0) process.exit(doctorResult.status ?? EXIT_SYSTEM);

  console.log('\n✅ Setup complete.');
}

function cmdResolveToken(args) {
  if (args.includes('--help') || args.includes('-h')) return printCommandHelp('resolve-token');

  let role = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--role' && args[index + 1]) {
      role = args[index + 1];
      index += 1;
    }
  }

  if (!role) failUser('--role is required. Example: squad-identity resolve-token --role backend');

  const target = gitRootFromCwd() ?? process.cwd();
  const resolveToken = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', 'resolve-token.mjs');
  const result = spawnSync(process.execPath, [resolveToken, role], {
    cwd: target,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) failSystem(result.error.message);
  if ((result.status ?? EXIT_USER) !== 0) {
    const message = (result.stderr || result.stdout || 'token resolution failed').trim();
    failUser(message || 'token resolution failed');
  }

  process.stdout.write(result.stdout || '');
  process.exit(0);
}

function cmdRotateKey(args) {
  if (args.includes('--help') || args.includes('-h')) return printCommandHelp('rotate-key');

  // Parse --role and --pem from args
  let role = null;
  let pemPath = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--role' && args[i + 1]) role = args[++i];
    else if (args[i] === '--pem' && args[i + 1]) pemPath = args[++i];
  }

  if (!role) failUser('--role is required. Example: squad-identity rotate-key --role backend');

  const createApp = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', 'create-app.mjs');

  if (pemPath) {
    // Import the PEM directly into keychain
    const result = spawnSync(process.execPath, [createApp, '--import-key', pemPath, '--role', role], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    if (result.error) failSystem(result.error.message);
    process.exit(result.status ?? 0);
  } else {
    // Open the settings page for the user to generate a new key
    console.log(`🔑 Key rotation for role: ${role}\n`);
    console.log('Step 1: Opening GitHub App settings page...\n');

    const target = gitRootFromCwd() ?? process.cwd();
    const appFile = join(target, '.squad', 'identity', 'apps', `${role}.json`);
    if (!existsSync(appFile)) {
      failUser(`No app registration found for role "${role}" at ${appFile}. Create the app first.`);
    }

    let appSlug;
    try {
      const appData = JSON.parse(readFileSync(appFile, 'utf8'));
      appSlug = appData.appSlug;
    } catch {
      failUser(`Failed to read app registration at ${appFile}.`);
    }

    if (!appSlug) failUser(`App registration at ${appFile} is missing "appSlug".`);

    const settingsUrl = `https://github.com/settings/apps/${appSlug}`;
    console.log(`  ${settingsUrl}\n`);

    // Try to open in browser
    try {
      const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
      spawnSync(openCmd, [settingsUrl], { stdio: 'ignore' });
    } catch { /* best effort */ }

    console.log('Step 2: In the browser, click "Generate a private key" and download the PEM.\n');
    console.log('Step 3: Import the new key:\n');
    console.log(`  squad-identity rotate-key --role ${role} --pem ~/Downloads/${appSlug}*.pem\n`);
    console.log('Step 4: Delete the old key from the GitHub App settings page.');
    console.log('Step 5: Delete the downloaded PEM file from your machine.\n');
  }
}

async function cmdImportApp(args) {
  if (args.includes('--help') || args.includes('-h')) return printCommandHelp('import-app');

  let role = null, appId = null, appSlug = null, pemPath = null, clientId = null, searchName = null, org = null;
  const force = args.includes('--force');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--force') continue;
    if (args[i] === '--role' && args[i + 1]) role = args[++i];
    else if (args[i] === '--app-id' && args[i + 1]) appId = args[++i];
    else if (args[i] === '--app-slug' && args[i + 1]) appSlug = args[++i];
    else if (args[i] === '--pem' && args[i + 1]) pemPath = args[++i];
    else if (args[i] === '--client-id' && args[i + 1]) clientId = args[++i];
    else if (args[i] === '--search' && args[i + 1]) searchName = args[++i];
    else if (args[i] === '--org' && args[i + 1]) org = args[++i];
  }

  if (!role) failUser('--role is required. Example: squad-identity import-app --role backend --app-id 12345 --app-slug my-squad-backend --pem ~/key.pem');

  if (searchName) {
    const findApp = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', 'find-app.mjs');
    const findArgs = ['--name', searchName, '--role', role];
    if (org) findArgs.push('--org', org);
    if (pemPath) findArgs.push('--pem', pemPath);
    if (force) findArgs.push('--force');
    const result = spawnSync(process.execPath, [findApp, ...findArgs], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    if (result.error) failSystem(result.error.message);
    process.exit(result.status ?? 0);
  }

  if (!appId) failUser('--app-id is required (numeric GitHub App ID).');
  if (!appSlug) failUser('--app-slug is required (GitHub App slug, e.g., my-squad-backend).');
  if (!pemPath) failUser('--pem is required (path to the PEM private key file).');

  const numericAppId = parseInt(appId, 10);
  if (isNaN(numericAppId)) failUser(`--app-id must be a number, got: "${appId}"`);

  const resolvedPem = resolve(pemPath.replace(/^~/, process.env.HOME ?? ''));
  if (!existsSync(resolvedPem)) failUser(`PEM file not found: ${resolvedPem}`);

  const pemContent = readFileSync(resolvedPem, 'utf8');
  if (!pemContent.includes('-----BEGIN RSA PRIVATE KEY-----') && !pemContent.includes('-----BEGIN PRIVATE KEY-----')) {
    failUser(`File at ${resolvedPem} does not appear to be a PEM private key.`);
  }

  const target = gitRootFromCwd() ?? process.cwd();
  const appsDir = join(target, '.squad', 'identity', 'apps');
  mkdirSync(appsDir, { recursive: true });

  // Idempotency guard — check for existing registration
  const appPath = join(appsDir, `${role}.json`);
  if (existsSync(appPath)) {
    try {
      const existing = JSON.parse(readFileSync(appPath, 'utf8'));
      console.warn(`⚠️  Role "${role}" already has an app registered: ${existing.slug ?? '(unknown)'} (ID: ${existing.appId ?? '?'})`);
    } catch {
      console.warn(`⚠️  Role "${role}" already has a registration file: ${appPath}`);
    }
    if (!force) {
      if (process.stdin.isTTY) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise(res => rl.question('Overwrite? [y/N] ', res));
        rl.close();
        if (answer.trim().toLowerCase() !== 'y') {
          console.log('Aborted.');
          process.exit(0);
        }
      } else {
        failUser('Role already registered. Use --force to overwrite in non-interactive mode.');
      }
    }
  }

  // Save app registration JSON
  const appData = { appId: numericAppId, slug: appSlug, ...(clientId && { clientId }) };
  writeFileSync(appPath, JSON.stringify(appData, null, 2) + '\n', 'utf8');
  console.log(`✅ App registration saved: ${appPath}`);

  // Import PEM into keychain
  const createApp = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', 'create-app.mjs');
  const result = spawnSync(process.execPath, [createApp, '--import-key', resolvedPem, '--role', role], {
    cwd: target,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error('\n⚠️  App registration saved but PEM import failed. Run again or use rotate-key to import the PEM.');
    process.exit(result.status ?? 1);
  }

  console.log(`\n✅ Existing app "${appSlug}" (ID: ${numericAppId}) registered for role "${role}".`);
  console.log('   PEM stored in OS keychain. You can delete the local PEM file.');
  console.log('\n   Next: run `squad-identity setup` to install the app and update charters.');
}

const [command = 'help', ...args] = process.argv.slice(2);

if (command === '--version' || command === '-v') {
  console.log(VERSION);
} else if (command === '--help' || command === '-h' || command === 'help') {
  printMainHelp();
} else if (command === 'init') {
  cmdInit(args);
} else if (command === 'setup') {
  await cmdSetup(args);
} else if (command === 'resolve-token') {
  cmdResolveToken(args);
} else if (command === 'upgrade') {
  cmdUpgrade(args);
} else if (command === 'rotate-key') {
  cmdRotateKey(args);
} else if (command === 'import-app') {
  await cmdImportApp(args);
} else if (command === 'create-app') {
  if (args.includes('--help') || args.includes('-h')) printCommandHelp('create-app');
  else {
    const createApp = join(PACKAGE_ROOT, 'extensions', 'squad-identity', 'lib', 'create-app.mjs');
    const result = spawnSync(process.execPath, [createApp, ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    if (result.error) failSystem(result.error.message);
    process.exit(result.status ?? 0);
  }
} else if (command === 'doctor') {
  if (args.includes('--help') || args.includes('-h')) printCommandHelp('doctor');
  else runConfigure('--doctor', process.cwd());
} else {
  printMainHelp();
  failUser(`unknown command: ${command}`);
}
