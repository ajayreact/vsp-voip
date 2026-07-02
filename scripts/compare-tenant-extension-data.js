#!/usr/bin/env node
/**
 * Read-only: compare Symplore vs Asuitech extension/User/PhoneNumber data
 * and simulate resolveExtensionRingTargets() per extension.
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

function diffFields(a, b, keys) {
  const diffs = [];
  for (const k of keys) {
    const va = a?.[k];
    const vb = b?.[k];
    const sa = va instanceof Date ? va.toISOString() : JSON.stringify(va);
    const sb = vb instanceof Date ? vb.toISOString() : JSON.stringify(vb);
    if (sa !== sb) diffs.push({ field: k, symplore: va, asuitech: vb });
  }
  return diffs;
}

async function findTenant(prisma, pattern) {
  return prisma.tenant.findFirst({
    where: { name: { contains: pattern, mode: 'insensitive' } },
  });
}

async function loadTenantBundle(prisma, tenantId) {
  const [tenant, users, extensions, phoneNumbers] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.user.findMany({
      where: { tenantId },
      orderBy: { email: 'asc' },
    }),
    prisma.extension.findMany({
      where: { tenantId },
      include: {
        user: true,
        security: true,
        forwarding: true,
        devices: true,
        primaryPhoneNumber: true,
        phoneNumbers: true,
      },
      orderBy: { extensionNumber: 'asc' },
    }),
    prisma.phoneNumber.findMany({
      where: { tenantId },
      include: { assignedUser: true, extension: true },
      orderBy: { number: 'asc' },
    }),
  ]);
  return { tenant, users, extensions, phoneNumbers };
}

async function traceRingTargets(prisma, tenant, extension, connectionId) {
  const steps = [];
  steps.push({ step: 'extension.id', value: extension.id });
  steps.push({ step: 'extension.extensionNumber', value: extension.extensionNumber });
  steps.push({ step: 'extension.status', value: extension.status });
  steps.push({ step: 'extension.userId', value: extension.userId });

  if (!extension?.id) {
    steps.push({ step: 'EXIT', value: 'no extension.id → returns null' });
    return { steps, resolution: null };
  }

  const effectiveUserId = extension.userId ?? null;
  steps.push({ step: 'resolveEffectiveUserId', value: effectiveUserId });

  if (!effectiveUserId) {
    steps.push({ step: 'EXIT', value: 'effectiveUserId null → appTargets=[] → targets=[]' });
    const resolution = await resolveExtensionRingTargets(prisma, extension, connectionId);
    return { steps, resolution };
  }

  const user = extension.userId === effectiveUserId
    ? extension.user
    : await prisma.user.findUnique({ where: { id: effectiveUserId } });

  steps.push({
    step: 'user loaded',
    value: user
      ? pick(user, ['id', 'email', 'tenantId', 'telnyxSipUsername', 'telnyxCredentialId', 'sipRegistered', 'softphoneOnlineAt'])
      : null,
  });

  if (!user) {
    steps.push({ step: 'EXIT', value: 'user not found → appTargets=[]' });
    const resolution = await resolveExtensionRingTargets(prisma, extension, connectionId);
    return { steps, resolution };
  }

  if (!user.telnyxSipUsername) {
    steps.push({
      step: 'ensureAppUserDialReady would run',
      value: connectionId ? 'user has no telnyxSipUsername — may provision via getOrCreateUserTelephonyCredential' : 'no connectionId — skip provision',
    });
  } else {
    steps.push({ step: 'user.telnyxSipUsername', value: user.telnyxSipUsername });
  }

  const resolution = await resolveExtensionRingTargets(prisma, extension, connectionId);
  const targets = resolution?.targets || [];

  steps.push({
    step: 'resolveExtensionRingTargets result',
    value: {
      targetCount: targets.length,
      effectiveUserId: resolution?.effectiveUserId,
      targets: targets.map((t) => ({
        type: t.type,
        label: t.label,
        userId: t.user?.id,
        telnyxSipUsername: t.user?.telnyxSipUsername,
        dialTo: formatTargetDialTo(t),
      })),
    },
  });

  if (targets.length === 0) {
    const reason = !effectiveUserId
      ? 'Extension.userId is null'
      : !user?.telnyxSipUsername
        ? 'User.telnyxSipUsername is null after ensureAppUserDialReady'
        : 'unknown';
    steps.push({ step: 'EMPTY TARGETS REASON', value: reason });
  }

  return { steps, resolution };
}

async function main() {
  const prisma = await getPrisma();
  const connectionId = await loadCredentialConnectionId(prisma).catch(() => null);

  const symplore = await findTenant(prisma, 'symplore');
  const asuitech = await findTenant(prisma, 'asuitech');

  console.log('=== Tenant Extension Data Comparison ===\n');
  console.log('Credential connection ID:', connectionId || '(not configured locally)');

  if (!symplore) console.warn('Symplore tenant NOT FOUND');
  if (!asuitech) console.warn('Asuitech tenant NOT FOUND');

  if (!symplore && !asuitech) {
    const all = await prisma.tenant.findMany({ select: { id: true, name: true } });
    console.log('\nAvailable tenants:', all);
    process.exit(1);
  }

  const sym = symplore ? await loadTenantBundle(prisma, symplore.id) : null;
  const asu = asuitech ? await loadTenantBundle(prisma, asuitech.id) : null;

  const tenantKeys = ['id', 'name', 'isActive', 'contactEmail', 'timezone', 'billingStatus', 'maxUsers', 'maxPhoneNumbers', 'maxConcurrentCalls'];
  if (sym?.tenant && asu?.tenant) {
    console.log('\n--- Tenant field diffs ---');
    console.log(JSON.stringify(diffFields(sym.tenant, asu.tenant, tenantKeys), null, 2));
  }

  console.log('\n--- Symplore summary ---');
  if (sym) {
    console.log(`Tenant: ${sym.tenant.name} (${sym.tenant.id})`);
    console.log(`Users: ${sym.users.length}, Extensions: ${sym.extensions.length}, PhoneNumbers: ${sym.phoneNumbers.length}`);
  }

  console.log('\n--- Asuitech summary ---');
  if (asu) {
    console.log(`Tenant: ${asu.tenant.name} (${asu.tenant.id})`);
    console.log(`Users: ${asu.users.length}, Extensions: ${asu.extensions.length}, PhoneNumbers: ${asu.phoneNumbers.length}`);
  }

  const userKeys = ['id', 'email', 'name', 'role', 'tenantId', 'telnyxCredentialId', 'telnyxSipUsername', 'sipRegistered', 'softphoneOnlineAt', 'sipRegistrationCheckedAt', 'sipRegistrationSource'];
  const extKeys = ['id', 'tenantId', 'extensionNumber', 'displayName', 'status', 'userId', 'telnyxSipUsername', 'telnyxCredentialId', 'sipRegistered', 'doNotDisturb', 'dndInboundAction', 'webrtcEnabled', 'sipEnabled', 'multiDeviceEnabled', 'primaryPhoneNumberId'];
  const secKeys = ['allowInternalExtensions', 'blockAnonymous', 'internationalEnabled', 'outboundCallerId', 'hideCallerId', 'afterHoursAction', 'timeRestrictionsEnabled'];
  const pnKeys = ['id', 'number', 'tenantId', 'assignedUserId', 'extensionId', 'routingType', 'isActive', 'label', 'ringGroupId'];

  for (const label of ['Symplore', 'Asuitech']) {
    const bundle = label === 'Symplore' ? sym : asu;
    if (!bundle) continue;

    console.log(`\n========== ${label} FULL RECORDS ==========`);

    console.log('\n[Users]');
    for (const u of bundle.users) {
      console.log(JSON.stringify(pick(u, userKeys), null, 2));
    }

    console.log('\n[Extensions]');
    for (const e of bundle.extensions) {
      const row = pick(e, extKeys);
      row.user_telnyxSipUsername = e.user?.telnyxSipUsername ?? null;
      row.user_sipRegistered = e.user?.sipRegistered ?? null;
      row.user_softphoneOnlineAt = e.user?.softphoneOnlineAt ?? null;
      row.security = e.security ? pick(e.security, secKeys) : null;
      row.devices = (e.devices || []).map((d) => pick(d, ['deviceType', 'deviceName', 'status', 'lastRegistrationAt']));
      console.log(JSON.stringify(row, null, 2));
    }

    console.log('\n[PhoneNumbers / AssignedNumbers]');
    for (const pn of bundle.phoneNumbers) {
      const row = pick(pn, pnKeys);
      row.assignedUser_email = pn.assignedUser?.email ?? null;
      row.extensionNumber = pn.extension?.extensionNumber ?? null;
      console.log(JSON.stringify(row, null, 2));
    }
  }

  console.log('\n========== resolveExtensionRingTargets TRACE ==========');

  for (const { label, bundle } of [
    { label: 'Symplore', bundle: sym },
    { label: 'Asuitech', bundle: asu },
  ]) {
    if (!bundle) continue;
    console.log(`\n--- ${label} ---`);
    for (const ext of bundle.extensions) {
      if (ext.status !== 'ACTIVE') continue;
      console.log(`\nExtension ${ext.extensionNumber} (${ext.displayName}):`);
      const { steps } = await traceRingTargets(prisma, bundle.tenant, ext, connectionId);
      for (const s of steps) {
        console.log(`  ${s.step}:`, typeof s.value === 'object' ? JSON.stringify(s.value) : s.value);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
