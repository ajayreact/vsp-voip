#!/usr/bin/env node
/**
 * Telephony diagnostics report — READ ONLY. Builds a per-call Desk→Desk
 * timeline from the [TRACE] lines emitted when TELEPHONY_DIAGNOSTICS=true.
 *
 * It never touches routing, Call Control, Telnyx, tenants, or the database.
 * It only parses log text and prints a timeline. Removable in one commit.
 *
 * Usage:
 *   # Last 30 minutes straight from Docker (recommended):
 *   docker compose logs api telephony-v3-worker --since 30m --no-color 2>&1 \
 *     | node scripts/telephony-diagnostics-report.js --stdin
 *
 *   # From saved log files:
 *   node scripts/telephony-diagnostics-report.js api.log worker.log
 *
 *   # Auto-run docker for you (requires docker compose in cwd):
 *   node scripts/telephony-diagnostics-report.js --docker --since 30m
 *
 *   # Compare a working vs failing capture and print the first divergence:
 *   node scripts/telephony-diagnostics-report.js compare symplore.log asuitech.log
 *
 * Flags:
 *   --stdin            Read log text from stdin.
 *   --docker           Shell out to `docker compose logs` for you.
 *   --since <dur>      Docker window (default 30m). Only with --docker.
 *   --json             Emit machine-readable JSON instead of the text report.
 *   --no-db            Skip the read-only database enrichment.
 *
 * Database enrichment (read-only): when DATABASE_URL is available, each call's
 * target extension is looked up (Extension + User + PhoneNumber + Security +
 * Tenant) and printed as a "Database State" stage. Missing required fields are
 * reported as "DATABASE INCONSISTENCY DETECTED". The script only reads; it
 * never writes to the database or changes any telephony behavior.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * Canonical Desk→Desk pipeline, in execution order. Each stage lists the
 * trace labels (as emitted by traceDeskDesk) that satisfy it.
 * `optional` stages never trigger a "missing" verdict on their own.
 */
const PIPELINE = [
  { key: 'webhook', label: 'Webhook Received', match: [/Webhook Received/i] },
  { key: 'destination', label: 'DestinationResolver', match: [/resolveOutboundDestination/i, /loadTargetExtension/i] },
  { key: 'ring_targets', label: 'resolveExtensionRingTargets', match: [/resolveExtensionRingTargets/i] },
  { key: 'desk_router', label: 'Desk Router', match: [/deskResolver/i, /desk\.router/i], optional: true },
  { key: 'internal_dial', label: 'internalExtensionDial', match: [/beginInternalExtensionRing/i, /handleInternalExtension/i], optional: true },
  { key: 'dial_request', label: 'Dial Request', match: [/Dial Request/i] },
  { key: 'dial_response', label: 'Dial Response', match: [/Dial Response/i] },
];

function parseArgs(argv) {
  const args = { files: [], stdin: false, docker: false, since: '30m', json: false, db: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--stdin') args.stdin = true;
    else if (a === '--docker') args.docker = true;
    else if (a === '--json') args.json = true;
    else if (a === '--no-db') args.db = false;
    else if (a === '--db') args.db = true;
    else if (a === '--since') { args.since = argv[i + 1] || '30m'; i += 1; }
    else if (a.startsWith('--')) { /* ignore unknown flag */ }
    else args.files.push(a);
  }
  return args;
}

/**
 * Required DB fields for a Desk→Desk internal call to be routable. A missing
 * value here is reported as DATABASE INCONSISTENCY. Purely a read-side check —
 * it never mutates anything.
 */
const REQUIRED_DB_FIELDS = [
  { key: 'extensionFound', label: 'Extension record', check: (d) => d.extensionFound },
  { key: 'id', label: 'Extension ID', check: (d) => Boolean(d.id) },
  { key: 'extensionNumber', label: 'Extension Number', check: (d) => Boolean(d.extensionNumber) },
  { key: 'status', label: 'Status = ACTIVE', check: (d) => d.status === 'ACTIVE' },
  { key: 'displayName', label: 'displayName', check: (d) => Boolean(d.displayName) },
  {
    key: 'sipTarget',
    label: 'SIP target (User.telnyxSipUsername OR Extension.telnyxSipUsername)',
    check: (d) => Boolean(d.userTelnyxSipUsername || d.telnyxSipUsername),
  },
  { key: 'allowInternalExtensions', label: 'allowInternalExtensions = true', check: (d) => d.allowInternalExtensions === true },
  { key: 'credentialConnectionId', label: 'Credential Connection ID', check: (d) => Boolean(d.credentialConnectionId) },
];

/** Extract the numeric target extension + tenant for a call group. */
function targetForGroup(group) {
  let extensionNumber = null;
  let tenantId = group.tenantId || null;
  for (const ev of group.events) {
    if (!tenantId && ev.tenantId) tenantId = ev.tenantId;
    const candidate = ev.raw?.targetExtension ?? ev.raw?.extension ?? null;
    if (!extensionNumber && candidate && /^\d{1,6}$/.test(String(candidate))) {
      extensionNumber = String(candidate);
    }
  }
  if (!extensionNumber) {
    for (const ev of group.events) {
      if (ev.to && /^\d{1,6}$/.test(String(ev.to))) { extensionNumber = String(ev.to); break; }
    }
  }
  return { tenantId, extensionNumber };
}

/** Lazy DB accessor. Returns null (with a reason) when DB is unavailable. */
function createDbFetcher() {
  if (!process.env.DATABASE_URL) {
    try { require('dotenv').config(); } catch { /* optional */ }
  }
  if (!process.env.DATABASE_URL) {
    return { available: false, reason: 'DATABASE_URL not set', fetch: async () => null, close: async () => {} };
  }

  let prisma;
  let credentialConnectionId = null;
  const cache = new Map();

  try {
    const { PrismaClient } = require('../generated/prisma/client');
    const { PrismaPg } = require('@prisma/adapter-pg');
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  } catch (error) {
    const firstLine = String(error.message || error).split('\n')[0];
    return { available: false, reason: `prisma client unavailable (${firstLine})`, fetch: async () => null, close: async () => {} };
  }

  async function ensureCredentialConnectionId() {
    if (credentialConnectionId !== null) return credentialConnectionId;
    try {
      const { loadPlatformSettings } = require('../lib/platformSettings');
      const { getCredentialConnectionId } = require('../lib/telnyxConfig');
      const platform = await loadPlatformSettings(prisma);
      credentialConnectionId = getCredentialConnectionId(platform) || '';
    } catch {
      credentialConnectionId = '';
    }
    return credentialConnectionId;
  }

  async function fetch(tenantId, extensionNumber) {
    if (!extensionNumber) return { extensionFound: false, reason: 'no target extension number in trace' };
    const cacheKey = `${tenantId || '*'}:${extensionNumber}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const where = tenantId
      ? { tenantId, extensionNumber: String(extensionNumber) }
      : { extensionNumber: String(extensionNumber) };
    const ext = await prisma.extension.findFirst({
      where,
      include: { user: true, security: true, primaryPhoneNumber: true, tenant: true },
    });
    const ccId = await ensureCredentialConnectionId();

    let state;
    if (!ext) {
      state = { extensionFound: false, tenantId, extensionNumber: String(extensionNumber), credentialConnectionId: ccId };
    } else {
      state = {
        extensionFound: true,
        tenantId: ext.tenantId,
        tenantName: ext.tenant?.name ?? null,
        id: ext.id,
        extensionNumber: ext.extensionNumber,
        status: ext.status,
        userId: ext.userId,
        displayName: ext.displayName,
        sipRegistered: ext.user?.sipRegistered ?? ext.sipRegistered ?? null,
        telnyxSipUsername: ext.telnyxSipUsername ?? null,
        allowInternalExtensions: ext.security?.allowInternalExtensions ?? null,
        doNotDisturb: ext.doNotDisturb ?? null,
        assignedDid: ext.primaryPhoneNumber?.number ?? null,
        phoneNumberAssignedUserId: ext.primaryPhoneNumber?.assignedUserId ?? null,
        userTelnyxSipUsername: ext.user?.telnyxSipUsername ?? null,
        userTelnyxCredentialId: ext.user?.telnyxCredentialId ?? null,
        credentialConnectionId: ccId,
      };
    }
    cache.set(cacheKey, state);
    return state;
  }

  return { available: true, reason: null, fetch, close: async () => { try { await prisma.$disconnect(); } catch { /* ignore */ } } };
}

function dbInconsistencies(dbState) {
  if (!dbState) return [];
  if (!dbState.extensionFound) {
    return [`Extension record — not found for tenant=${dbState.tenantId || '?'} ext=${dbState.extensionNumber || '?'}`];
  }
  const problems = [];
  for (const field of REQUIRED_DB_FIELDS) {
    if (!field.check(dbState)) problems.push(field.label);
  }
  // Advisory cross-check (not a hard requirement): DID assigned to a different user.
  if (
    dbState.assignedDid
    && dbState.phoneNumberAssignedUserId
    && dbState.userId
    && dbState.phoneNumberAssignedUserId !== dbState.userId
  ) {
    problems.push(`PhoneNumber.assignedUserId (${dbState.phoneNumberAssignedUserId}) != Extension.userId (${dbState.userId})`);
  }
  return problems;
}

function renderDbState(dbState) {
  const lines = [];
  lines.push('    ↓');
  lines.push('DATABASE STATE (target extension)');
  if (!dbState) {
    lines.push('  (database enrichment disabled or unavailable)');
    return lines.join('\n');
  }
  if (!dbState.extensionFound) {
    lines.push(`  Tenant                    : ${dbState.tenantId || '?'}`);
    lines.push(`  Extension Number          : ${dbState.extensionNumber || '?'}`);
    lines.push(`  Credential Connection ID  : ${dbState.credentialConnectionId || 'MISSING'}`);
    lines.push('  Extension record          : NOT FOUND');
    return lines.join('\n');
  }
  const row = (k, v) => lines.push(`  ${k.padEnd(26)}: ${v === null || v === undefined ? 'MISSING' : v}`);
  row('Tenant', `${dbState.tenantName || '?'} (${dbState.tenantId})`);
  row('Extension ID', dbState.id);
  row('Extension Number', dbState.extensionNumber);
  row('Status', dbState.status);
  row('userId', dbState.userId);
  row('displayName', dbState.displayName);
  row('sipRegistered', dbState.sipRegistered);
  row('Extension.telnyxSipUsername', dbState.telnyxSipUsername);
  row('allowInternalExtensions', dbState.allowInternalExtensions);
  row('doNotDisturb', dbState.doNotDisturb);
  row('assigned DID', dbState.assignedDid);
  row('PhoneNumber.assignedUserId', dbState.phoneNumberAssignedUserId);
  row('User.telnyxSipUsername', dbState.userTelnyxSipUsername);
  row('User.telnyxCredentialId', dbState.userTelnyxCredentialId);
  row('Credential Connection ID', dbState.credentialConnectionId);
  return lines.join('\n');
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function readDocker(since) {
  const res = spawnSync(
    'docker',
    ['compose', 'logs', 'api', 'telephony-v3-worker', '--since', since, '--no-color'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (res.error) {
    console.error(`Failed to run docker compose logs: ${res.error.message}`);
    process.exit(1);
  }
  return `${res.stdout || ''}\n${res.stderr || ''}`;
}

/**
 * Extract a [TRACE] JSON object from an arbitrary log line. Docker/pm2 prefix
 * lines with container names + timestamps, so find the first '{' and parse.
 */
function parseTraceLine(line) {
  if (!line.includes('[TRACE]')) return null;
  const braceIdx = line.indexOf('{');
  if (braceIdx === -1) return null;
  const jsonText = line.slice(braceIdx);
  let obj;
  try {
    obj = JSON.parse(jsonText);
  } catch {
    return null;
  }
  const message = typeof obj.message === 'string' ? obj.message : '';
  if (!message.includes('[TRACE]')) return null;
  const label = message.replace(/.*\[TRACE\]\s*/, '').trim();
  return {
    label,
    ts: obj.ts || null,
    tenantId: obj.tenantId ?? null,
    callSessionId: obj.callSessionId ?? obj.call_session_id ?? null,
    callControlId: obj.callControlId ?? obj.call_control_id ?? null,
    callLegId: obj.callLegId ?? obj.call_leg_id ?? null,
    from: obj.from ?? null,
    to: obj.to ?? null,
    direction: obj.direction ?? null,
    state: obj.state ?? null,
    destination: obj.targetExtension ?? obj.destination ?? obj.destinationKind ?? null,
    raw: obj,
  };
}

function stageForLabel(label) {
  for (const stage of PIPELINE) {
    if (stage.match.some((re) => re.test(label))) return stage.key;
  }
  return null;
}

function idsOf(ev) {
  return [ev.callSessionId, ev.callControlId, ev.callLegId].filter(Boolean);
}

function tsMs(ev) {
  const t = Date.parse(ev.ts || '');
  return Number.isNaN(t) ? 0 : t;
}

/** Minimal union-find over call ids that co-occur within a single event. */
function buildIdUnionFind(events) {
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => { parent.set(find(a), find(b)); };
  for (const ev of events) {
    const ids = idsOf(ev);
    for (let i = 1; i < ids.length; i += 1) union(ids[0], ids[i]);
  }
  return { find, has: (x) => parent.has(x) };
}

/**
 * Group events into calls. Ids that co-occur in one event (e.g. the webhook
 * carries both call_session_id and call_control_id) are merged via union-find,
 * so a single call is never split across its own leg/session ids. "Middle"
 * stages that lack any id (loadTargetExtension / ring targets / desk router)
 * are stitched to the group with matching tenantId + destination + nearest ts.
 */
function groupEvents(events) {
  const uf = buildIdUnionFind(events);
  const anchored = new Map();
  const orphans = [];

  for (const ev of events) {
    const ids = idsOf(ev);
    if (ids.length) {
      const key = uf.find(ids[0]);
      if (!anchored.has(key)) {
        anchored.set(key, { key, events: [], tenantId: null, destination: null, sessionId: null });
      }
      const g = anchored.get(key);
      g.events.push(ev);
      if (!g.tenantId && ev.tenantId) g.tenantId = ev.tenantId;
      if (!g.destination && ev.destination) g.destination = ev.destination;
      if (!g.sessionId && ev.callSessionId) g.sessionId = ev.callSessionId;
    } else {
      orphans.push(ev);
    }
  }

  for (const ev of orphans) {
    let best = null;
    let bestScore = -1;
    for (const g of anchored.values()) {
      let score = 0;
      if (ev.tenantId && g.tenantId && ev.tenantId === g.tenantId) score += 2;
      if (ev.destination && g.destination && String(ev.destination) === String(g.destination)) score += 2;
      const nearest = g.events.reduce((min, ge) => Math.min(min, Math.abs(tsMs(ge) - tsMs(ev))), Infinity);
      if (nearest <= 120000) score += 1; // within 2 minutes
      if (score > bestScore) { bestScore = score; best = g; }
    }
    if (best && bestScore >= 2) {
      best.events.push(ev);
    } else {
      const key = `orphan:${ev.tenantId || '?'}:${ev.destination || '?'}`;
      if (!anchored.has(key)) {
        anchored.set(key, { key, events: [], tenantId: ev.tenantId, destination: ev.destination, orphan: true });
      }
      anchored.get(key).events.push(ev);
    }
  }

  for (const g of anchored.values()) {
    g.events.sort((a, b) => tsMs(a) - tsMs(b));
  }
  return [...anchored.values()].sort((a, b) => tsMs(a.events[0]) - tsMs(b.events[0]));
}

function presentStages(group) {
  const present = new Set();
  for (const ev of group.events) {
    const key = stageForLabel(ev.label);
    if (key) present.add(key);
  }
  return present;
}

/**
 * Determine the first stage that should have run but did not.
 * - If a later stage is present but an earlier one is missing → GAP.
 * - Otherwise the pipeline simply stopped: first stage after the last one seen.
 * Optional stages never, by themselves, count as the missing stage.
 */
function firstMissingStage(group) {
  const present = presentStages(group);
  const required = PIPELINE.filter((s) => !s.optional);

  let lastPresentIdx = -1;
  PIPELINE.forEach((s, idx) => { if (present.has(s.key)) lastPresentIdx = idx; });

  if (lastPresentIdx === -1) {
    return { type: 'none', stage: PIPELINE[0], note: 'No pipeline stages recorded for this call.' };
  }

  // Gap: a required stage before the last-seen stage is missing.
  for (let i = 0; i < lastPresentIdx; i += 1) {
    const s = PIPELINE[i];
    if (!s.optional && !present.has(s.key)) {
      return { type: 'gap', stage: s, note: `Later stage "${PIPELINE[lastPresentIdx].label}" ran but "${s.label}" was never logged.` };
    }
  }

  // Stopped: first required stage after the last-seen stage.
  for (let i = lastPresentIdx + 1; i < PIPELINE.length; i += 1) {
    const s = PIPELINE[i];
    if (!s.optional) {
      return { type: 'stopped', stage: s, note: `Pipeline stopped after "${PIPELINE[lastPresentIdx].label}".` };
    }
  }

  return { type: 'complete', stage: null, note: 'All required stages executed.' };
}

function renderGroup(group, dbState) {
  const lines = [];
  const displayKey = group.sessionId || group.key;
  const head = group.orphan
    ? `Call (uncorrelated) tenant=${group.tenantId || '?'} dest=${group.destination || '?'}`
    : `Call ${displayKey}  tenant=${group.tenantId || '?'} dest=${group.destination || '?'}`;
  lines.push('='.repeat(72));
  lines.push(head);
  lines.push('-'.repeat(72));

  group.events.forEach((ev, i) => {
    const time = ev.ts ? new Date(ev.ts).toISOString().slice(11, 23) : '--:--:--.---';
    const extra = [];
    if (ev.from || ev.to) extra.push(`${ev.from || '?'} → ${ev.to || '?'}`);
    if (ev.direction) extra.push(`dir=${ev.direction}`);
    if (ev.state) extra.push(`state=${ev.state}`);
    lines.push(`${time}  ${ev.label}${extra.length ? `   [${extra.join(' ')}]` : ''}`);
    if (i < group.events.length - 1) lines.push('    ↓');
  });

  lines.push(renderDbState(dbState));

  const verdict = firstMissingStage(group);
  const dbProblems = dbInconsistencies(dbState);
  lines.push('-'.repeat(72));
  if (verdict.type === 'complete') {
    lines.push('RESULT: ✅ all required stages executed.');
  } else if (verdict.type === 'none') {
    lines.push('FIRST MISSING STAGE: Webhook Received (no telemetry for this call)');
    lines.push(`  ${verdict.note}`);
  } else {
    lines.push(`FIRST MISSING STAGE: ${verdict.stage.label}  (${verdict.type})`);
    lines.push(`  ${verdict.note}`);
  }

  if (dbProblems.length) {
    lines.push('');
    for (const problem of dbProblems) {
      lines.push(`DATABASE INCONSISTENCY DETECTED: ${problem}`);
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// compare mode: align two call logs and print the first divergence.
// ---------------------------------------------------------------------------

/** Semantic, call-agnostic fields worth diffing (identifiers/timestamps excluded). */
const COMPARE_FIELDS = ['direction', 'state', 'destinationKind', 'targetCount', 'ok', 'status'];

function getField(ev, field) {
  if (ev[field] !== undefined && ev[field] !== null) return ev[field];
  const raw = ev.raw || {};
  return raw[field] !== undefined ? raw[field] : null;
}

function lastPresentIndex(group) {
  const present = presentStages(group);
  let idx = -1;
  PIPELINE.forEach((s, i) => { if (present.has(s.key)) idx = i; });
  return idx;
}

/** Pick the call that progressed furthest (then most events, then earliest). */
function pickPrimaryGroup(groups) {
  if (!groups.length) return null;
  return groups.slice().sort((a, b) => (
    (lastPresentIndex(b) - lastPresentIndex(a))
    || (b.events.length - a.events.length)
    || (tsMs(a.events[0]) - tsMs(b.events[0]))
  ))[0];
}

function repEvent(group, stageKey) {
  if (!group) return null;
  return group.events.find((ev) => stageForLabel(ev.label) === stageKey) || null;
}

function compareFields(evA, evB) {
  const diffs = [];
  for (const field of COMPARE_FIELDS) {
    const a = getField(evA, field);
    const b = getField(evB, field);
    if (a === null && b === null) continue;
    if (String(a) !== String(b)) diffs.push({ field, a, b });
  }
  return diffs;
}

function reachedLabel(group) {
  const idx = lastPresentIndex(group);
  return idx === -1 ? 'nothing' : PIPELINE[idx].label;
}

function parseFileToEvents(file) {
  const text = fs.readFileSync(file, 'utf8');
  const events = [];
  for (const line of text.split(/\r?\n/)) {
    const ev = parseTraceLine(line);
    if (ev) events.push(ev);
  }
  return events;
}

function findFirstDivergence(gA, gB) {
  for (const stage of PIPELINE) {
    const aEv = repEvent(gA, stage.key);
    const bEv = repEvent(gB, stage.key);
    const aP = Boolean(aEv);
    const bP = Boolean(bEv);
    if (aP !== bP) {
      return { stage, type: 'presence', aP, bP, aEv, bEv, diffs: [] };
    }
    if (aP && bP) {
      const diffs = compareFields(aEv, bEv);
      if (diffs.length) return { stage, type: 'fields', aP, bP, aEv, bEv, diffs };
    }
  }
  return null;
}

function runCompare(argv) {
  const files = [];
  let json = false;
  for (const a of argv) {
    if (a === '--json') json = true;
    else if (!a.startsWith('--')) files.push(a);
  }
  if (files.length < 2) {
    console.error('Usage: node scripts/telephony-diagnostics-report.js compare <A.log> <B.log>');
    console.error('  A = working (e.g. symplore.log), B = failing (e.g. asuitech.log)');
    process.exit(1);
  }

  const [fileA, fileB] = files;
  const nameA = path.basename(fileA);
  const nameB = path.basename(fileB);
  const gA = pickPrimaryGroup(groupEvents(parseFileToEvents(fileA)));
  const gB = pickPrimaryGroup(groupEvents(parseFileToEvents(fileB)));

  if (!gA || !gB) {
    console.error(`No [TRACE] calls found in ${!gA ? nameA : nameB}. Ensure TELEPHONY_DIAGNOSTICS=true captured the call.`);
    process.exit(1);
  }

  const divergence = findFirstDivergence(gA, gB);

  if (json) {
    console.log(JSON.stringify({
      a: { file: nameA, key: gA.sessionId || gA.key, tenantId: gA.tenantId, reached: reachedLabel(gA), stages: [...presentStages(gA)] },
      b: { file: nameB, key: gB.sessionId || gB.key, tenantId: gB.tenantId, reached: reachedLabel(gB), stages: [...presentStages(gB)] },
      firstDivergence: divergence ? {
        stage: divergence.stage.label,
        type: divergence.type,
        aPresent: divergence.aP,
        bPresent: divergence.bP,
        fieldDiffs: divergence.diffs,
      } : null,
    }, null, 2));
    return;
  }

  console.log('\nTELEPHONY DIAGNOSTICS — COMPARE');
  console.log(`A: ${nameA}  → call ${gA.sessionId || gA.key} (tenant=${gA.tenantId || '?'}, dest=${gA.destination || '?'}) reached: ${reachedLabel(gA)}`);
  console.log(`B: ${nameB}  → call ${gB.sessionId || gB.key} (tenant=${gB.tenantId || '?'}, dest=${gB.destination || '?'}) reached: ${reachedLabel(gB)}`);
  console.log(`\n${'-'.repeat(72)}`);
  console.log(`${'Stage'.padEnd(34)} ${'A'.padEnd(6)} ${'B'.padEnd(6)} Notes`);
  console.log('-'.repeat(72));

  for (const stage of PIPELINE) {
    const aEv = repEvent(gA, stage.key);
    const bEv = repEvent(gB, stage.key);
    const a = aEv ? '✅' : '❌';
    const b = bEv ? '✅' : '❌';
    let note = '';
    if (divergence && divergence.stage.key === stage.key) {
      note = '← FIRST DIVERGENCE';
    } else if (aEv && bEv) {
      const diffs = compareFields(aEv, bEv);
      if (diffs.length) note = `Δ ${diffs.map((d) => d.field).join(', ')}`;
    }
    console.log(`${stage.label.padEnd(34)} ${a.padEnd(6)} ${b.padEnd(6)} ${note}`);
  }

  console.log('-'.repeat(72));
  if (!divergence) {
    console.log('FIRST DIVERGENCE: none — both calls executed the same stages with matching fields.');
    return;
  }

  console.log(`FIRST DIVERGENCE: ${divergence.stage.label}  (${divergence.type})`);
  if (divergence.type === 'presence') {
    const aReached = reachedLabel(gA);
    const bReached = reachedLabel(gB);
    console.log(`  A (${nameA}): ${divergence.aP ? 'executed this stage' : `did NOT — stopped after "${aReached}"`}`);
    console.log(`  B (${nameB}): ${divergence.bP ? 'executed this stage' : `did NOT — stopped after "${bReached}"`}`);
  } else {
    console.log('  Both executed this stage, but fields differ:');
    for (const d of divergence.diffs) {
      console.log(`    ${d.field.padEnd(16)} A=${d.a}   B=${d.b}`);
    }
  }
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === 'compare') {
    runCompare(rawArgs.slice(1));
    return;
  }
  const args = parseArgs(rawArgs);

  let text = '';
  if (args.docker) text = readDocker(args.since);
  else if (args.files.length) text = args.files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  else if (args.stdin || !process.stdin.isTTY) text = readStdin();
  else {
    console.error('No input. Pipe logs with --stdin, pass log files, or use --docker.');
    console.error('Example: docker compose logs api telephony-v3-worker --since 30m 2>&1 | node scripts/telephony-diagnostics-report.js --stdin');
    process.exit(1);
  }

  const events = [];
  for (const line of text.split(/\r?\n/)) {
    const ev = parseTraceLine(line);
    if (ev) events.push(ev);
  }

  const groups = groupEvents(events);

  // Read-only DB enrichment (never mutates). Disable with --no-db.
  const dbByGroup = new Map();
  let db = { available: false, reason: 'disabled (--no-db)', fetch: async () => null, close: async () => {} };
  if (args.db) {
    db = createDbFetcher();
    if (db.available) {
      for (const group of groups) {
        const { tenantId, extensionNumber } = targetForGroup(group);
        try {
          dbByGroup.set(group, await db.fetch(tenantId, extensionNumber));
        } catch (error) {
          dbByGroup.set(group, { extensionFound: false, tenantId, extensionNumber, dbError: error.message });
        }
      }
    }
    await db.close();
  }

  if (args.json) {
    console.log(JSON.stringify(groups.map((g) => ({
      key: g.key,
      tenantId: g.tenantId,
      destination: g.destination,
      stages: [...presentStages(g)],
      firstMissing: (() => { const v = firstMissingStage(g); return v.stage ? v.stage.key : null; })(),
      databaseState: dbByGroup.get(g) || null,
      databaseInconsistencies: dbInconsistencies(dbByGroup.get(g)),
      events: g.events.map((e) => ({ ts: e.ts, label: e.label, from: e.from, to: e.to, direction: e.direction, state: e.state })),
    })), null, 2));
    return;
  }

  console.log('\nTELEPHONY DIAGNOSTICS REPORT');
  console.log(`Parsed ${events.length} [TRACE] event(s) into ${groups.length} call(s).`);
  if (args.db && !db.available) {
    console.log(`Database enrichment: OFF (${db.reason}).`);
  } else if (!args.db) {
    console.log('Database enrichment: OFF (--no-db).');
  } else {
    console.log('Database enrichment: ON (read-only).');
  }
  if (!events.length) {
    console.log('\nNo [TRACE] lines found. Confirm TELEPHONY_DIAGNOSTICS=true is set on the');
    console.log('api and telephony-v3-worker containers, then reproduce the call.');
    return;
  }

  for (const group of groups) {
    console.log(`\n${renderGroup(group, dbByGroup.get(group))}`);
  }

  console.log(`\n${'='.repeat(72)}`);
  const stopped = groups.filter((g) => firstMissingStage(g).type !== 'complete');
  const inconsistent = groups.filter((g) => dbInconsistencies(dbByGroup.get(g)).length);
  console.log(`SUMMARY: ${groups.length} call(s), ${stopped.length} incomplete, ${inconsistent.length} with DB inconsistencies.`);
  for (const g of stopped) {
    const v = firstMissingStage(g);
    const label = v.stage ? v.stage.label : 'Webhook Received';
    console.log(`  - ${g.orphan ? '(uncorrelated)' : (g.sessionId || g.key)}: first missing → ${label}`);
  }
  for (const g of inconsistent) {
    console.log(`  - ${g.orphan ? '(uncorrelated)' : (g.sessionId || g.key)}: DB inconsistency → ${dbInconsistencies(dbByGroup.get(g)).join('; ')}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
