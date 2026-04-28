#!/usr/bin/env node
// .squad/scripts/post-flight-check.mjs
//
// Synchronous post-flight identity verification for #1087 governance hardening.
//
// Every agent-authored GitHub write (review / comment / label / PR create /
// issue edit / commit push) must be verified against the GitHub API to confirm
// the actor is the expected bot account. Mismatch means ambient-auth fallback
// happened and a human identity was attributed to automated work — a P1
// governance failure.
//
// Binding constraints honored:
//   - Zapp C4: synchronous, blocking; on mismatch attempt revoke with the
//     correct bot token; if revoke fails, halt and surface the mismatch.
//   - Zapp C5 / Nibbler gap 4: verify `user.type === "Bot"` in addition to
//     login equality. Defends against human-login collision.
//   - Nibbler gap 3: reviews are dismissed (PUT /dismissals), never deleted;
//     comments are DELETE /issues/comments/{id}; labels are DELETE
//     /issues/{n}/labels/{name}.
//   - Nibbler gap 2: supports write types review, comment, label, pr-create,
//     issue-edit, commit-push.
//   - Never prints the token value. Token is read from `GH_TOKEN` env in the
//     caller's inline subshell (the `GH_TOKEN="$TOKEN" node …` pattern).
//
// Usage:
//   GH_TOKEN="$TOKEN" node .squad/scripts/post-flight-check.mjs \
//     --kind review --owner OWNER --repo REPO --pr NUM --id REVIEW_ID \
//     --expected-login sabbour-squad-lead[bot]
//
//   Kinds: review | comment | label | pr-create | issue-edit | commit
//
// Exit codes:
//   0  Actor matches expected bot AND user.type === "Bot".
//   1  Mismatch detected and revoke succeeded — governance fail recorded.
//   2  Mismatch detected and revoke FAILED — P1, halt.
//   3  Invalid arguments or API error unrelated to identity.

import { resolve as resolvePath } from 'node:path';

const API = 'https://api.github.com';

// Dual bot-family support (issue #184 / Option A).
// The per-role identity apps (suite 3492xxx) were registered as `squad-<role>`
// while the CI workflow apps use `sabbour-squad-<role>`. Both families are
// valid in different contexts. We normalize by stripping the `sabbour-` prefix
// before comparing so `squad-lead[bot]` and `sabbour-squad-lead[bot]` are
// treated as equivalent.
function normalizeBotLogin(login) {
  return typeof login === 'string' ? login.replace(/^sabbour-/, '') : login;
}

function loginMatches(actualLogin, expectedLogin) {
  return (
    actualLogin === expectedLogin ||
    normalizeBotLogin(actualLogin) === normalizeBotLogin(expectedLogin)
  );
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { json: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === '--json') out.json = true;
    else if (a === '--kind') { out.kind = next; i++; }
    else if (a === '--owner') { out.owner = next; i++; }
    else if (a === '--repo') { out.repo = next; i++; }
    else if (a === '--pr') { out.pr = next; i++; }
    else if (a === '--issue') { out.issue = next; i++; }
    else if (a === '--id') { out.id = next; i++; }
    else if (a === '--sha') { out.sha = next; i++; }
    else if (a === '--label') { out.label = next; i++; }
    else if (a === '--expected-login') { out.expectedLogin = next; i++; }
    else if (a === '--help' || a === '-h') { out.help = true; }
  }
  return out;
}

function printHelp() {
  process.stdout.write(`post-flight-check — verify actor identity on a bot write (issue #1087)

Usage:
  GH_TOKEN="$TOKEN" node post-flight-check.mjs --kind <kind> --owner O --repo R \\
    --expected-login sabbour-squad-<role>[bot] [kind-specific flags]

Kinds and required flags:
  review      --pr N --id REVIEW_ID
  comment     --issue N --id COMMENT_ID     (works for PR comments too)
  label       --issue N --label NAME
  pr-create   --pr N                         (checks latest commit + PR user)
  issue-edit  --issue N                      (checks last timeline actor)
  commit      --sha SHA                      (checks commit author/committer)

Exit codes: 0=match, 1=mismatch+revoked, 2=mismatch+revoke-failed, 3=error.
`);
}

async function ghFetch(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'squad-post-flight-check',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep null */ }
  return { ok: res.ok, status: res.status, data, text };
}

async function getActor(kind, args, token) {
  const { owner, repo, pr, issue, id, sha } = args;
  switch (kind) {
    case 'review': {
      const r = await ghFetch('GET', `/repos/${owner}/${repo}/pulls/${pr}/reviews/${id}`, token);
      if (!r.ok) return { error: `review fetch failed: ${r.status}` };
      return { login: r.data?.user?.login, type: r.data?.user?.type };
    }
    case 'comment': {
      const r = await ghFetch('GET', `/repos/${owner}/${repo}/issues/comments/${id}`, token);
      if (!r.ok) return { error: `comment fetch failed: ${r.status}` };
      return { login: r.data?.user?.login, type: r.data?.user?.type };
    }
    case 'label': {
      // Labels carry no actor; look up the most recent `labeled` event on the issue.
      const r = await ghFetch('GET', `/repos/${owner}/${repo}/issues/${issue}/events?per_page=100`, token);
      if (!r.ok) return { error: `events fetch failed: ${r.status}` };
      const match = (r.data || [])
        .filter((e) => e.event === 'labeled' && e.label?.name === args.label)
        .slice(-1)[0];
      if (!match) return { error: `no labeled event found for ${args.label}` };
      return { login: match.actor?.login, type: match.actor?.type };
    }
    case 'pr-create': {
      // Nibbler PR #1091 round-2: verify BOTH the PR record user AND the
      // head commit author. A null headActor is a FAIL (not a pass) —
      // commits whose email doesn't resolve to a GitHub user cannot be
      // attributed to the bot, and the #1086/#1087 incident pattern is
      // exactly: bot-shaped git author, ambient-auth PR creation, commit
      // author.login === null on the GitHub side.
      const prRes = await ghFetch('GET', `/repos/${owner}/${repo}/pulls/${pr}`, token);
      if (!prRes.ok) return { error: `pr fetch failed: ${prRes.status}` };
      const prUser = { login: prRes.data?.user?.login, type: prRes.data?.user?.type };
      const headSha = prRes.data?.head?.sha;
      if (!headSha) {
        return { ...prUser, headActor: null, headActorError: 'pr has no head.sha' };
      }
      const commitRes = await ghFetch('GET', `/repos/${owner}/${repo}/commits/${headSha}`, token);
      if (!commitRes.ok) {
        return {
          ...prUser,
          headActor: null,
          headActorError: `head commit fetch failed: ${commitRes.status}`,
        };
      }
      if (!commitRes.data?.author) {
        return {
          ...prUser,
          headActor: null,
          headActorError: `head commit ${headSha.slice(0, 8)} has null author (commit email does not resolve to a GitHub user)`,
        };
      }
      const headActor = {
        login: commitRes.data.author.login,
        type: commitRes.data.author.type,
      };
      return { ...prUser, headActor };
    }
    case 'issue-edit': {
      // Nibbler PR #1091 C4: filter the timeline to edit-shaped events only.
      // slice(-1) picks the most recent event of ANY kind and attributes the
      // edit to a bystander actor.
      const r = await ghFetch('GET', `/repos/${owner}/${repo}/issues/${issue}/timeline?per_page=100`, token);
      if (!r.ok) return { error: `timeline fetch failed: ${r.status}` };
      const editEvents = (r.data || []).filter((e) =>
        e.event === 'renamed' || e.event === 'edited' || e.event === 'demilestoned' || e.event === 'milestoned' || e.event === 'locked' || e.event === 'unlocked',
      );
      const last = editEvents.slice(-1)[0];
      if (!last) {
        // Fall back to the issue record itself.
        const issueRes = await ghFetch('GET', `/repos/${owner}/${repo}/issues/${issue}`, token);
        if (!issueRes.ok) return { error: `issue fetch failed: ${issueRes.status}` };
        return { login: issueRes.data?.user?.login, type: issueRes.data?.user?.type };
      }
      return { login: last.actor?.login, type: last.actor?.type };
    }
    case 'commit': {
      const r = await ghFetch('GET', `/repos/${owner}/${repo}/commits/${sha}`, token);
      if (!r.ok) return { error: `commit fetch failed: ${r.status}` };
      // Zapp PR #1091 N2: explicit "unattributable" path when the commit
      // email can't be resolved to a GitHub user.
      if (!r.data?.author) {
        return {
          error: `commit ${sha.slice(0, 8)} has no GitHub-resolved author (author.login === null). Commit email may not match any GitHub user.`,
        };
      }
      return { login: r.data.author.login, type: r.data.author.type };
    }
    default:
      return { error: `unknown kind: ${kind}` };
  }
}

async function attemptRevoke(kind, args, token) {
  const { owner, repo, pr, issue, id } = args;
  switch (kind) {
    case 'review': {
      // Reviews cannot be deleted once submitted — they must be DISMISSED.
      const r = await ghFetch(
        'PUT',
        `/repos/${owner}/${repo}/pulls/${pr}/reviews/${id}/dismissals`,
        token,
        { message: 'governance:identity-mismatch — review attributed to wrong actor (#1087)' },
      );
      return { ok: r.ok, detail: `dismiss review ${id} -> ${r.status}` };
    }
    case 'comment': {
      const r = await ghFetch('DELETE', `/repos/${owner}/${repo}/issues/comments/${id}`, token);
      return { ok: r.ok, detail: `delete comment ${id} -> ${r.status}` };
    }
    case 'label': {
      const r = await ghFetch(
        'DELETE',
        `/repos/${owner}/${repo}/issues/${issue}/labels/${encodeURIComponent(args.label)}`,
        token,
      );
      return { ok: r.ok, detail: `remove label ${args.label} -> ${r.status}` };
    }
    case 'pr-create':
    case 'issue-edit':
    case 'commit':
      // These can't be cleanly undone programmatically — surface as P1.
      return { ok: false, detail: `kind=${kind} cannot be auto-revoked; manual remediation required` };
    default:
      return { ok: false, detail: `unknown kind: ${kind}` };
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.kind) {
    printHelp();
    process.exit(args.help ? 0 : 3);
  }

  const token = process.env.GH_TOKEN;
  if (!token) {
    process.stderr.write('post-flight-check: GH_TOKEN not set in environment\n');
    process.exit(3);
  }

  if (!args.owner || !args.repo || !args.expectedLogin) {
    process.stderr.write('post-flight-check: --owner, --repo, and --expected-login are required\n');
    process.exit(3);
  }

  const actor = await getActor(args.kind, args, token);
  if (actor.error) {
    process.stderr.write(`post-flight-check: ${actor.error}\n`);
    process.exit(3);
  }

  const loginOk = loginMatches(actor.login, args.expectedLogin);
  const typeOk = actor.type === 'Bot';
  // Nibbler PR #1091 round-2: for pr-create, null headActor is a HARD FAIL.
  // The prior `!actor.headActor ||` clause silently passed when the head
  // commit couldn't be attributed — which is exactly the #1086 regression.
  let headActorOk = true;
  let headActorReason = null;
  if (args.kind === 'pr-create') {
    if (!actor.headActor) {
      headActorOk = false;
      headActorReason = actor.headActorError || 'head commit actor unresolved';
    } else if (
      !loginMatches(actor.headActor.login, args.expectedLogin) ||
      actor.headActor.type !== 'Bot'
    ) {
      headActorOk = false;
      headActorReason = `head commit actor ${actor.headActor.login}/${actor.headActor.type} != ${args.expectedLogin}/Bot`;
    }
  }

  if (loginOk && typeOk && headActorOk) {
    const msg = `post-flight-check: OK  kind=${args.kind} login=${actor.login} type=Bot\n`;
    if (args.json) {
      process.stdout.write(JSON.stringify({ ok: true, kind: args.kind, login: actor.login, type: actor.type }) + '\n');
    } else {
      process.stderr.write(msg);
    }
    process.exit(0);
  }

  // Mismatch. Attempt revoke.
  const revoke = await attemptRevoke(args.kind, args, token);
  const payload = {
    ok: false,
    kind: args.kind,
    expectedLogin: args.expectedLogin,
    actualLogin: actor.login ?? null,
    actualType: actor.type ?? null,
    reason: !typeOk
      ? 'user.type !== "Bot"'
      : !loginOk
        ? 'login mismatch'
        : headActorReason || 'head commit actor mismatch',
    headActor: actor.headActor ?? null,
    revoke,
  };
  if (args.json) {
    process.stdout.write(JSON.stringify(payload) + '\n');
  } else {
    process.stderr.write(
      `post-flight-check: MISMATCH kind=${args.kind} expected=${args.expectedLogin} ` +
        `actual=${actor.login}/${actor.type}. Revoke: ${revoke.detail}\n`,
    );
  }
  process.exit(revoke.ok ? 1 : 2);
}

export { parseArgs, getActor, attemptRevoke };

const isCliInvocation =
  typeof process.argv[1] === 'string' &&
  resolvePath(process.argv[1]).endsWith('post-flight-check.mjs');

if (isCliInvocation) {
  await main();
}
