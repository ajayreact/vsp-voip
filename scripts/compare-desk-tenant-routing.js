#!/usr/bin/env node
/**
 * Read-only comparison: Symplore vs Asuitech V3 desk outbound routing.
 *
 * Place one Desk→Desk call per tenant, then run:
 *   docker compose exec -T api node scripts/compare-desk-tenant-routing.js
 *
 * Options:
 *   --window-minutes=N   Look back N minutes for latest DESK session (default: 30)
 *   --tenant-a=NAME      Override first tenant name match (default: symplore)
 *   --tenant-b=NAME      Override second tenant name match (default: asuitech)
 */
require('dotenv').config();

const STREAM_INGRESS = 'v3:stream:telephony-ingress';
const INGRESS_PAYLOAD_PREFIX = 'v3:ingress:payload:';

function parseArgs() {
  const args = { windowMinutes: 30, tenantA: 'symplore', tenantB: 'asuitech' };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--window-minutes=')) {
      args.windowMinutes = Number(arg.split('=')[1]) || 30;
    } else if (arg.startsWith('--tenant-a=')) {
      args.tenantA = arg.split('=')[1];
    } else if (arg.startsWith('--tenant-b=')) {
      args.tenantB = arg.split('=')[1];
    }
  }
  return args;
}

function fieldsArrayToMap(flat) {
  const map = {};
  for (let i = 0; i < flat.length; i += 2) {
    map[flat[i]] = flat[i + 1];
  }
  return map;
}

function extractClientState(webhookBody) {
  const raw = webhookBody?.data?.payload?.client_state
    ?? webhookBody?.data?.payload?.clientState
    ?? null;
  if (raw == null || raw === '') return '(absent)';
  if (typeof raw === 'string') {
    try {
      return JSON.stringify(JSON.parse(raw));
    } catch {
      return raw;
    }
  }
  return JSON.stringify(raw);
}

function inferTenantResolutionSource(routeSnapshot) {
  if (!routeSnapshot || typeof routeSnapshot !== 'object') {
    return '(no routeSnapshot — likely client_state or non-desk-bootstrap path)';
  }
  const bootstrap = routeSnapshot.deskBootstrap;
  if (bootstrap && typeof bootstrap === 'object' && bootstrap.source) {
    return String(bootstrap.source);
  }
  if (routeSnapshot.routingFlow || routeSnapshot.routedAt) {
    return '(post-route snapshot)';
  }
  return '(unknown)';
}

function hasExistingRoute7470f0c(routeSnapshot) {
  return Boolean(routeSnapshot);
}

function formatCell(value) {
  if (value === null || value === undefined) return '(null)';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  const s = String(value);
  return s.length > 80 ? `${s.slice(0, 77)}...` : s;
}

function printComparisonTable(rows) {
  const col1Width = Math.max(28, ...rows.map((r) => r.field.length));
  const col2Width = Math.max(10, ...rows.map((r) => formatCell(r.symplore).length));
  const col3Width = Math.max(10, ...rows.map((r) => formatCell(r.asuitech).length));

  const sep = `+-${'-'.repeat(col1Width)}-+-${'-'.repeat(col2Width)}-+-${'-'.repeat(col3Width)}-+`;
  const header = `| ${'Field'.padEnd(col1Width)} | ${'Symplore'.padEnd(col2Width)} | ${'Asuitech'.padEnd(col3Width)} |`;

  console.log(sep);
  console.log(header);
  console.log(sep);
  for (const row of rows) {
    const f = row.field.padEnd(col1Width);
    const a = formatCell(row.symplore).padEnd(col2Width);
    const b = formatCell(row.asuitech).padEnd(col3Width);
    console.log(`| ${f} | ${a} | ${b} |`);
  }
  console.log(sep);
}

async function findTenantByNamePattern(prisma, pattern) {
  return prisma.tenant.findFirst({
    where: { name: { contains: pattern, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
}

async function findLatestDeskSession(prisma, tenantId, since) {
  return prisma.v3CallSession.findFirst({
    where: {
      tenantId,
      origin: 'DESK',
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      outboxCommands: {
        select: { commandType: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      legs: {
        select: { id: true, role: true, callControlId: true, toAddress: true, fromAddress: true },
      },
    },
  });
}

async function findCallInitiatedWebhook(redis, callControlId) {
  if (!redis || !callControlId) return null;

  const batches = [200, 500, 2000];
  for (const count of batches) {
    const entries = await redis.xrevrange(STREAM_INGRESS, '+', '-', 'COUNT', count);
    for (const [, fields] of entries) {
      const map = fieldsArrayToMap(fields);
      if (map.callControlId !== callControlId) continue;
      if (map.eventType !== 'call.initiated') continue;
      if (!map.payloadRef) continue;
      const raw = await redis.get(`${INGRESS_PAYLOAD_PREFIX}${map.payloadRef}`);
      if (!raw) continue;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function analyzeTenantSession(session, webhookBody) {
  const routeSnapshot = session?.routeSnapshot && typeof session.routeSnapshot === 'object'
    ? session.routeSnapshot
    : null;

  const commandTypes = (session?.outboxCommands || []).map((c) => c.commandType);
  const hasAnswer = commandTypes.includes('ANSWER');
  const hasDial = commandTypes.includes('DIAL');
  const hasBridge = commandTypes.includes('BRIDGE');
  const snapshotCommands = Array.isArray(routeSnapshot?.commands) ? routeSnapshot.commands : [];
  const deskCommandBuilderExecuted = hasAnswer || hasDial || hasBridge
    || snapshotCommands.length > 0
    || Boolean(routeSnapshot?.routedAt);

  return {
    tenantName: null,
    sessionId: session?.id ?? '(no session in window)',
    sessionCreatedAt: session?.createdAt?.toISOString?.() ?? '(n/a)',
    client_state: webhookBody ? extractClientState(webhookBody) : '(webhook not found in Redis stream)',
    tenantResolutionSource: inferTenantResolutionSource(routeSnapshot),
    callKind: routeSnapshot?.callKind ?? '(null)',
    routeSnapshot: routeSnapshot ?? '(null)',
    hasExistingRoute: session ? hasExistingRoute7470f0c(routeSnapshot) : '(n/a)',
    routedAt: routeSnapshot?.routedAt ?? '(null)',
    deskCommandBuilderExecuted: session ? (deskCommandBuilderExecuted ? 'yes' : 'no') : '(n/a)',
    answerCreated: session ? (hasAnswer ? 'yes' : 'no') : '(n/a)',
    dialCreated: session ? (hasDial ? 'yes' : 'no') : '(n/a)',
    bridgeCreated: session ? (hasBridge ? 'yes' : 'no') : '(n/a)',
    routingContinues: session
      ? (deskCommandBuilderExecuted ? 'yes' : (hasExistingRoute7470f0c(routeSnapshot) ? 'no (already_routed)' : 'no'))
      : '(n/a)',
    primaryCallControlId: session?.primaryCallControlId ?? '(n/a)',
    outboxCommandTypes: commandTypes.length ? commandTypes.join(', ') : '(none)',
  };
}

async function main() {
  const args = parseArgs();
  const since = new Date(Date.now() - args.windowMinutes * 60 * 1000);

  const { getPrisma } = require('../db');
  const { getRedisClient } = require('../lib/redis');

  const prisma = await getPrisma();
  const redis = await getRedisClient();

  console.log('V3 Desk routing comparison (read-only)');
  console.log(`Window: last ${args.windowMinutes} minutes (since ${since.toISOString()})`);
  console.log('Place one Desk→Desk call per tenant before running if no recent session exists.\n');

  const symplore = await findTenantByNamePattern(prisma, args.tenantA);
  const asuitech = await findTenantByNamePattern(prisma, args.tenantB);

  if (!symplore) {
    console.error(`Tenant matching "${args.tenantA}" not found.`);
    process.exit(1);
  }
  if (!asuitech) {
    console.error(`Tenant matching "${args.tenantB}" not found.`);
    process.exit(1);
  }

  console.log(`Found Symplore: ${symplore.name} (${symplore.id})`);
  console.log(`Found Asuitech: ${asuitech.name} (${asuitech.id})\n`);

  const symSession = await findLatestDeskSession(prisma, symplore.id, since);
  const asuSession = await findLatestDeskSession(prisma, asuitech.id, since);

  if (!symSession) {
    console.warn(`No DESK-origin V3CallSession for Symplore in the last ${args.windowMinutes} minutes.`);
  }
  if (!asuSession) {
    console.warn(`No DESK-origin V3CallSession for Asuitech in the last ${args.windowMinutes} minutes.`);
  }

  const symWebhook = symSession
    ? await findCallInitiatedWebhook(redis, symSession.primaryCallControlId)
    : null;
  const asuWebhook = asuSession
    ? await findCallInitiatedWebhook(redis, asuSession.primaryCallControlId)
    : null;

  const sym = analyzeTenantSession(symSession, symWebhook);
  const asu = analyzeTenantSession(asuSession, asuWebhook);
  sym.tenantName = symplore.name;
  asu.tenantName = asuitech.name;

  const rows = [
    { field: 'tenant name', symplore: sym.tenantName, asuitech: asu.tenantName },
    { field: 'session id', symplore: sym.sessionId, asuitech: asu.sessionId },
    { field: 'session createdAt', symplore: sym.sessionCreatedAt, asuitech: asu.sessionCreatedAt },
    { field: 'primaryCallControlId', symplore: sym.primaryCallControlId, asuitech: asu.primaryCallControlId },
    { field: 'client_state', symplore: sym.client_state, asuitech: asu.client_state },
    { field: 'tenantResolution.source', symplore: sym.tenantResolutionSource, asuitech: asu.tenantResolutionSource },
    { field: 'callKind', symplore: sym.callKind, asuitech: asu.callKind },
    { field: 'routeSnapshot', symplore: sym.routeSnapshot, asuitech: asu.routeSnapshot },
    { field: 'hasExistingRoute (7470f0c)', symplore: sym.hasExistingRoute, asuitech: asu.hasExistingRoute },
    { field: 'routedAt', symplore: sym.routedAt, asuitech: asu.routedAt },
    { field: 'deskCommandBuilder executed?', symplore: sym.deskCommandBuilderExecuted, asuitech: asu.deskCommandBuilderExecuted },
    { field: 'outbox command types', symplore: sym.outboxCommandTypes, asuitech: asu.outboxCommandTypes },
    { field: 'ANSWER created?', symplore: sym.answerCreated, asuitech: asu.answerCreated },
    { field: 'DIAL created?', symplore: sym.dialCreated, asuitech: asu.dialCreated },
    { field: 'BRIDGE created?', symplore: sym.bridgeCreated, asuitech: asu.bridgeCreated },
    { field: 'Routing continues?', symplore: sym.routingContinues, asuitech: asu.routingContinues },
  ];

  printComparisonTable(rows);

  console.log('\nNotes:');
  console.log('- hasExistingRoute uses 7470f0c logic: Boolean(routeSnapshot).');
  console.log('- tenantResolution.source from routeSnapshot.deskBootstrap.source when bootstrap snapshot exists.');
  console.log('- client_state from Redis ingress payload (call.initiated) for primaryCallControlId.');
  console.log('- If session missing, place a Desk→Desk call and re-run within the window.');

  await prisma.$disconnect();
  if (redis?.quit) await redis.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
