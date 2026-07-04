#!/usr/bin/env node
/**
 * Production read-only audit: Symplore vs Asuitech Desk→Desk prerequisites.
 *
 *   docker compose exec -T api npx tsx scripts/audit-desk-desk-tenants.js
 *   docker compose exec -T api npx tsx scripts/audit-desk-desk-tenants.js --tenant-a=symplore --tenant-b=asuitech
 */
require('dotenv').config();

const { getPrisma } = require('../db');
const { resolveExtensionRingTargets, formatTargetDialTo } = require('../lib/inboundRouting');
const { loadCredentialConnectionId } = require('../lib/telnyxSipProfile');

function pick(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj?.[k] ?? null;
  return out;
}

async function findTenant(prisma, pattern) {
  return prisma.tenant.findFirst({
    where: { name: { contains: pattern, mode: 'insensitive' } },
    select: {
      id: true,
      name: true,
      isActive: true,
      timezone: true,
      billingStatus: true,
    },
  });
}

async function loadTenantAudit(prisma, tenantId) {
  const [users, extensions, phoneNumbers, greeting, v3Flags] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      orderBy: { email: 'asc' },
    }),
    prisma.extension.findMany({
      where: { tenantId },
      include: {
        user: true,
        security: true,
        devices: true,
        forwarding: true,
      },
      orderBy: { extensionNumber: 'asc' },
    }),
    prisma.phoneNumber.findMany({
      where: { tenantId },
      include: { assignedUser: true, extension: true },
      orderBy: { number: 'asc' },
    }),
    prisma.greeting.findUnique({ where: { tenantId } }),
    prisma.v3FeatureFlag.findUnique({ where: { tenantId } }).catch(() => null),
  ]);

  return { users, extensions, phoneNumbers, greeting, v3Flags };
}

async function traceExtensionRing(prisma, ext, connectionId) {
  const resolution = await resolveExtensionRingTargets(prisma, ext, connectionId);
  return {
    extensionNumber: ext.extensionNumber,
    status: ext.status,
    userId: ext.userId,
    userTelnyxSipUsername: ext.user?.telnyxSipUsername ?? null,
    extensionTelnyxSipUsername: ext.telnyxSipUsername,
    userSipRegistered: ext.user?.sipRegistered ?? null,
    extensionSipRegistered: ext.sipRegistered,
    effectiveUserId: resolution?.effectiveUserId ?? null,
    appTargetCount: resolution?.appTargets?.length ?? 0,
    sipTargetCount: resolution?.sipTargets?.length ?? 0,
    totalTargets: resolution?.targets?.length ?? 0,
    targets: (resolution?.targets || []).map((t) => ({
      type: t.type,
      dial: formatTargetDialTo(t),
    })),
    devices: (ext.devices || []).map((d) => pick(d, ['deviceType', 'status', 'lastRegistrationAt'])),
    security: ext.security
      ? pick(ext.security, ['allowInternalExtensions', 'blockAnonymous', 'timeRestrictionsEnabled'])
      : null,
  };
}

function printTenantReport(label, bundle, ringTraces) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`TENANT: ${label}`);
  console.log('='.repeat(72));
  console.log('\nUsers:', bundle.users.length);
  for (const u of bundle.users) {
    console.log(JSON.stringify(pick(u, [
      'id', 'email', 'name', 'role', 'telnyxSipUsername', 'telnyxCredentialId',
      'sipRegistered', 'softphoneOnlineAt',
    ]), null, 2));
  }

  console.log('\nExtensions:', bundle.extensions.length);
  for (const e of bundle.extensions) {
    console.log(JSON.stringify({
      id: e.id,
      extensionNumber: e.extensionNumber,
      displayName: e.displayName,
      status: e.status,
      userId: e.userId,
      telnyxSipUsername: e.telnyxSipUsername,
      sipRegistered: e.sipRegistered,
      webrtcEnabled: e.webrtcEnabled,
      sipEnabled: e.sipEnabled,
    }, null, 2));
  }

  console.log('\nPhoneNumbers:', bundle.phoneNumbers.length);
  for (const pn of bundle.phoneNumbers) {
    console.log(JSON.stringify({
      number: pn.number,
      assignedUserId: pn.assignedUserId,
      assignedUserEmail: pn.assignedUser?.email ?? null,
      extensionId: pn.extensionId,
      extensionNumber: pn.extension?.extensionNumber ?? null,
      routingType: pn.routingType,
      isActive: pn.isActive,
    }, null, 2));
  }

  console.log('\nGreeting:', bundle.greeting ? {
    ringGroupEnabled: bundle.greeting.ringGroupEnabled,
    ivrEnabled: bundle.greeting.ivrEnabled,
  } : null);

  console.log('\nV3FeatureFlag:', bundle.v3Flags);

  console.log('\nresolveExtensionRingTargets (ACTIVE extensions):');
  for (const row of ringTraces) {
    console.log(JSON.stringify(row, null, 2));
  }
}

async function main() {
  const tenantA = process.argv.find((a) => a.startsWith('--tenant-a='))?.split('=')[1] || 'symplore';
  const tenantB = process.argv.find((a) => a.startsWith('--tenant-b='))?.split('=')[1] || 'asuitech';

  const prisma = await getPrisma();
  const connectionId = await loadCredentialConnectionId(prisma).catch(() => null);

  console.log('Desk→Desk tenant audit (read-only)');
  console.log('Credential connectionId:', connectionId || '(not set)');

  const sym = await findTenant(prisma, tenantA);
  const asu = await findTenant(prisma, tenantB);

  if (!sym) console.warn(`Tenant "${tenantA}" not found`);
  if (!asu) console.warn(`Tenant "${tenantB}" not found`);

  for (const { label, tenant } of [
    { label: tenantA, tenant: sym },
    { label: tenantB, tenant: asu },
  ]) {
    if (!tenant) continue;
    const bundle = await loadTenantAudit(prisma, tenant.id);
    const active = bundle.extensions.filter((e) => e.status === 'ACTIVE');
    const ringTraces = [];
    for (const ext of active) {
      ringTraces.push(await traceExtensionRing(prisma, ext, connectionId));
    }
    printTenantReport(`${tenant.name} (${tenant.id})`, bundle, ringTraces);
  }

  console.log('\n--- Divergence checklist (compare above) ---');
  console.log('1. Caller User.telnyxSipUsername + sipRegistered');
  console.log('2. Callee Extension.userId vs extension.telnyxSipUsername');
  console.log('3. Callee totalTargets > 0 after ring resolver');
  console.log('4. PhoneNumber.assignedUserId vs Extension.userId consistency');
  console.log('5. During live call: grep api logs for [TRACE] desk-desk or desk.outbound.originated.trace');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
