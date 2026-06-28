#!/usr/bin/env node
/**
 * Field-by-field inbound routing audit for two DIDs (DB + Telnyx + ring targets).
 *
 * Usage:
 *   node scripts/audit-inbound-did-pair.js
 *   node scripts/audit-inbound-did-pair.js +13136505581 +13099880196
 *
 * On server:
 *   docker compose exec api node scripts/audit-inbound-did-pair.js
 */
require('dotenv').config();

const axios = require('axios');
const { normalizePhoneNumber } = require('../lib/phone');
const { isTenantOperational } = require('../lib/tenantGuard');
const { getCachedTenant } = require('../lib/tenantCache');
const { resolveRingTargets, resolveExtensionForPhoneRecord } = require('../lib/inboundRouting');
const { resolveExtensionInboundPolicy } = require('../lib/extensionInbound');
const { applyNumberRoutingToGreeting } = require('../lib/numberRouting');
const { resolveDestination, resolveEffectiveRoutingType } = require('../lib/numberRouting');
const { getCredentialConnectionId } = require('../lib/telnyxConfig');
const { loadPlatformSettings } = require('../lib/platformSettings');
const { getCallControlApplicationId } = require('../lib/telnyxCallControlSetup');

const DEFAULT_WORKING = '+13136505581';
const DEFAULT_BROKEN = '+13099880196';

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();
const EXPECTED_CALL_CONTROL_ID = process.env.TELNYX_CALL_CONTROL_APP_ID?.trim() || null;

async function getPrisma() {
  const { PrismaClient } = require('../generated/prisma/client.js');
  const { PrismaPg } = require('@prisma/adapter-pg');
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

async function lookupTelnyxNumber(e164) {
  if (!TELNYX_API_KEY) return { error: 'TELNYX_API_KEY not set' };
  try {
    const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, Accept: 'application/json' },
      params: { 'filter[phone_number]': e164 },
      timeout: 15000,
    });
    const row = response.data?.data?.[0];
    if (!row) return { error: 'NOT_FOUND_IN_TELNYX' };
    return {
      telnyxId: row.id,
      connectionId: row.connection_id || null,
      status: row.status || null,
      onCallControlApp: row.connection_id === EXPECTED_CALL_CONTROL_ID,
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function loadDidAudit(prisma, platform, rawNumber) {
  const normalized = normalizePhoneNumber(rawNumber);
  const variants = [...new Set([rawNumber, normalized].filter(Boolean))];

  let phoneRecord = null;
  let matchedAs = null;
  for (const candidate of variants) {
    const row = await prisma.phoneNumber.findUnique({
      where: { number: candidate },
      include: {
        tenant: true,
        extension: {
          include: {
            user: true,
            security: true,
            forwarding: true,
            primaryPhoneNumber: { select: { id: true, number: true } },
          },
        },
        assignedUser: true,
        ringGroup: { select: { id: true, name: true, isActive: true } },
      },
    });
    if (row) {
      phoneRecord = row;
      matchedAs = candidate;
      break;
    }
  }

  const cachedTenant = normalized ? await getCachedTenant(normalized) : null;
  const telnyx = normalized ? await lookupTelnyxNumber(normalized) : { error: 'invalid number' };

  let greeting = null;
  let ringTargets = null;
  let extPolicy = null;
  let routingDestination = null;
  let effectiveRoutingType = null;

  if (phoneRecord?.tenantId) {
    greeting = await prisma.greeting.findUnique({ where: { tenantId: phoneRecord.tenantId } });
    const effectiveGreeting = greeting && phoneRecord
      ? applyNumberRoutingToGreeting(greeting, phoneRecord)
      : greeting;

    const credentialConnectionId = getCredentialConnectionId(platform);
    ringTargets = await resolveRingTargets(
      prisma,
      phoneRecord.tenantId,
      effectiveGreeting || {},
      phoneRecord,
      credentialConnectionId,
    );

    extPolicy = await resolveExtensionInboundPolicy(
      prisma,
      phoneRecord.tenant,
      phoneRecord,
      '+15555550100',
      { credentialConnectionId },
    );

    effectiveRoutingType = resolveEffectiveRoutingType(phoneRecord, effectiveGreeting);
    routingDestination = resolveDestination(
      phoneRecord,
      effectiveGreeting,
      phoneRecord.assignedUser,
      phoneRecord.ringGroup,
      phoneRecord.extension,
    );
  }

  const extensionViaRouting = phoneRecord?.tenantId
    ? await resolveExtensionForPhoneRecord(prisma, phoneRecord.tenantId, phoneRecord)
    : null;

  const tenantOperational = phoneRecord?.tenant
    ? isTenantOperational(phoneRecord.tenant)
    : null;

  return {
    input: rawNumber,
    normalized,
    matchedAs,
    inDatabase: Boolean(phoneRecord),
    cachedTenantId: cachedTenant?.id ?? null,
    cacheMatchesDb: cachedTenant?.id && phoneRecord?.tenantId
      ? cachedTenant.id === phoneRecord.tenantId
      : null,
    tenantOperational,
    phoneNumber: phoneRecord ? {
      id: phoneRecord.id,
      number: phoneRecord.number,
      tenantId: phoneRecord.tenantId,
      isActive: phoneRecord.isActive,
      routingType: phoneRecord.routingType,
      extensionId: phoneRecord.extensionId,
      assignedUserId: phoneRecord.assignedUserId,
      ringGroupId: phoneRecord.ringGroupId,
      forwardDestination: phoneRecord.forwardDestination,
      label: phoneRecord.label,
      effectiveRoutingType,
      routingDestination,
    } : null,
    tenant: phoneRecord?.tenant ? {
      id: phoneRecord.tenant.id,
      name: phoneRecord.tenant.name,
      isActive: phoneRecord.tenant.isActive,
      billingStatus: phoneRecord.tenant.billingStatus,
      billingGraceUntil: phoneRecord.tenant.billingGraceUntil,
    } : null,
    extension: phoneRecord?.extension ? {
      id: phoneRecord.extension.id,
      extensionNumber: phoneRecord.extension.extensionNumber,
      displayName: phoneRecord.extension.displayName,
      status: phoneRecord.extension.status,
      userId: phoneRecord.extension.userId,
      primaryPhoneNumberId: phoneRecord.extension.primaryPhoneNumberId,
      primaryDid: phoneRecord.extension.primaryPhoneNumber?.number ?? null,
      webrtcEnabled: phoneRecord.extension.webrtcEnabled,
      sipEnabled: phoneRecord.extension.sipEnabled,
      doNotDisturb: phoneRecord.extension.doNotDisturb,
      dndInboundAction: phoneRecord.extension.dndInboundAction,
      callScreeningEnabled: phoneRecord.extension.callScreeningEnabled,
      telnyxSipUsername: phoneRecord.extension.telnyxSipUsername,
      securityBlockAnonymous: phoneRecord.extension.security?.blockAnonymous ?? null,
      securityAfterHoursAction: phoneRecord.extension.security?.afterHoursAction ?? null,
    } : null,
    extensionViaRouting: extensionViaRouting ? {
      id: extensionViaRouting.id,
      extensionNumber: extensionViaRouting.extensionNumber,
      status: extensionViaRouting.status,
      userId: extensionViaRouting.userId,
    } : null,
    employee: phoneRecord?.extension?.user || phoneRecord?.assignedUser ? {
      id: (phoneRecord.extension?.user || phoneRecord.assignedUser).id,
      name: (phoneRecord.extension?.user || phoneRecord.assignedUser).name,
      email: (phoneRecord.extension?.user || phoneRecord.assignedUser).email,
      telnyxSipUsername: (phoneRecord.extension?.user || phoneRecord.assignedUser).telnyxSipUsername,
      telnyxCredentialId: (phoneRecord.extension?.user || phoneRecord.assignedUser).telnyxCredentialId,
    } : null,
    ringTargets: ringTargets ? {
      targetCount: ringTargets.targets?.length ?? 0,
      strategy: ringTargets.strategy,
      ringTimeout: ringTargets.ringTimeout,
      appTargets: (ringTargets.targets || []).filter((t) => t.type === 'app').map((t) => ({
        userId: t.user?.id,
        sipUsername: t.user?.telnyxSipUsername,
        label: t.label,
      })),
      sipTargets: (ringTargets.targets || []).filter((t) => t.type === 'sip').map((t) => ({
        sipUsername: t.sipUsername,
        label: t.label,
      })),
    } : null,
    extensionPolicy: extPolicy ? {
      action: extPolicy.action,
      reason: extPolicy.reason ?? null,
    } : null,
    telnyx,
    expectedCallControlAppId: EXPECTED_CALL_CONTROL_ID,
    pipelineChecks: {
      dbRecordExists: Boolean(phoneRecord),
      tenantAssigned: Boolean(phoneRecord?.tenantId),
      numberActive: phoneRecord?.isActive !== false,
      tenantOperational,
      telnyxNumberExists: !telnyx.error,
      telnyxOnCallControlApp: telnyx.onCallControlApp === true,
      hasRingTargets: (ringTargets?.targets?.length ?? 0) > 0,
      extensionActive: phoneRecord?.extension?.status === 'ACTIVE',
      employeeHasSipUsername: Boolean(
        phoneRecord?.extension?.user?.telnyxSipUsername
        || phoneRecord?.assignedUser?.telnyxSipUsername,
      ),
      policyAllowsRing: !extPolicy || extPolicy.action === 'ring' || extPolicy.action === 'screen',
    },
  };
}

function diffField(label, a, b) {
  const same = JSON.stringify(a) === JSON.stringify(b);
  return { label, working: a, broken: b, same };
}

function compareAudits(working, broken) {
  const fields = [
    'normalized',
    'matchedAs',
    'inDatabase',
    'cachedTenantId',
    'cacheMatchesDb',
    'tenantOperational',
  ];

  const phoneFields = [
    'number', 'tenantId', 'isActive', 'routingType', 'extensionId',
    'assignedUserId', 'ringGroupId', 'forwardDestination', 'effectiveRoutingType',
  ];

  const extFields = [
    'extensionNumber', 'status', 'userId', 'webrtcEnabled', 'sipEnabled',
    'doNotDisturb', 'primaryDid',
  ];

  const telnyxFields = ['connectionId', 'onCallControlApp', 'status'];

  const diffs = [];

  for (const key of fields) {
    diffs.push(diffField(key, working[key], broken[key]));
  }

  for (const key of phoneFields) {
    diffs.push(diffField(`phoneNumber.${key}`, working.phoneNumber?.[key] ?? null, broken.phoneNumber?.[key] ?? null));
  }

  for (const key of extFields) {
    diffs.push(diffField(`extension.${key}`, working.extension?.[key] ?? null, broken.extension?.[key] ?? null));
  }

  for (const key of telnyxFields) {
    diffs.push(diffField(`telnyx.${key}`, working.telnyx?.[key] ?? working.telnyx?.error ?? null, broken.telnyx?.[key] ?? broken.telnyx?.error ?? null));
  }

  diffs.push(diffField('ringTargets.targetCount', working.ringTargets?.targetCount ?? 0, broken.ringTargets?.targetCount ?? 0));
  diffs.push(diffField('extensionPolicy.action', working.extensionPolicy?.action ?? null, broken.extensionPolicy?.action ?? null));

  return diffs.filter((row) => !row.same);
}

async function auditExtension100(prisma, tenantId) {
  if (!tenantId) return null;
  const ext = await prisma.extension.findFirst({
    where: { tenantId, extensionNumber: '100' },
    include: {
      user: { select: { id: true, name: true, email: true, telnyxSipUsername: true } },
      phoneNumbers: { select: { id: true, number: true, isActive: true, routingType: true } },
      primaryPhoneNumber: { select: { id: true, number: true } },
      security: true,
    },
  });
  if (!ext) return { found: false };
  return {
    found: true,
    id: ext.id,
    status: ext.status,
    displayName: ext.displayName,
    userId: ext.userId,
    employee: ext.user,
    webrtcEnabled: ext.webrtcEnabled,
    sipEnabled: ext.sipEnabled,
    doNotDisturb: ext.doNotDisturb,
    assignedDids: ext.phoneNumbers.map((p) => p.number),
    primaryDid: ext.primaryPhoneNumber?.number ?? null,
    inboundDisabledFlags: {
      statusInactive: ext.status !== 'ACTIVE',
      webrtcDisabled: ext.webrtcEnabled === false,
      sipDisabled: ext.sipEnabled === false,
      note: 'No global inboundDisabled column — check status, DND, security.afterHoursAction, extPolicy',
    },
  };
}

async function main() {
  const args = process.argv.slice(2).map((n) => normalizePhoneNumber(n)).filter(Boolean);
  const workingNumber = args[0] || DEFAULT_WORKING;
  const brokenNumber = args[1] || DEFAULT_BROKEN;

  if (!process.env.DATABASE_URL) {
    console.error('FAIL: DATABASE_URL is not set');
    process.exit(1);
  }

  const prisma = await getPrisma();
  const platform = await loadPlatformSettings(prisma);

  console.log('=== VSP Inbound DID Pair Audit ===\n');
  console.log('Working DID:', workingNumber);
  console.log('Broken DID:', brokenNumber);
  console.log('Expected Telnyx Call Control app:', EXPECTED_CALL_CONTROL_ID || '(not configured)');
  console.log('');

  const [working, broken] = await Promise.all([
    loadDidAudit(prisma, platform, workingNumber),
    loadDidAudit(prisma, platform, brokenNumber),
  ]);

  console.log('--- WORKING DID ---');
  console.log(JSON.stringify(working, null, 2));
  console.log('\n--- BROKEN DID ---');
  console.log(JSON.stringify(broken, null, 2));

  const diffs = compareAudits(working, broken);
  console.log('\n--- FIELD DIFFERENCES (working vs broken) ---');
  if (!diffs.length) {
    console.log('No DB/Telnyx field differences — issue may be Telnyx webhook delivery or runtime cache.');
  } else {
    for (const row of diffs) {
      console.log(`* ${row.label}`);
      console.log(`    working: ${JSON.stringify(row.working)}`);
      console.log(`    broken:  ${JSON.stringify(row.broken)}`);
    }
  }

  const tenantId = broken.tenant?.id || working.tenant?.id;
  const ext100 = await auditExtension100(prisma, tenantId);
  console.log('\n--- EXTENSION 100 ---');
  console.log(JSON.stringify(ext100, null, 2));

  console.log('\n--- DIAGNOSIS ---');
  if (!broken.inDatabase) {
    console.log('FAIL: Broken DID has no phone_numbers row (or E.164 mismatch). Check normalizePhoneNumber vs DB storage.');
  } else if (broken.telnyx.error === 'NOT_FOUND_IN_TELNYX') {
    console.log('FAIL: Broken DID not in Telnyx account — inbound cannot arrive. Sync numbers from Telnyx Portal.');
  } else if (broken.telnyx.onCallControlApp === false) {
    console.log('FAIL: Broken DID is NOT on VSP Call Control app in Telnyx — webhooks will not hit /webhook/call-control.');
    console.log('     Fix: Telnyx Portal → Numbers → assign to Call Control app, or restart API to run syncPhoneNumbersToCallControlApp.');
  } else if (!broken.pipelineChecks.hasRingTargets) {
    console.log('FAIL: Broken DID resolves to zero ring targets — check extension assignment, SIP username, webrtcEnabled.');
  } else if (broken.extensionPolicy?.action === 'block') {
    console.log(`FAIL: Extension policy blocks inbound: ${broken.extensionPolicy.reason}`);
  } else if (!broken.pipelineChecks.tenantOperational) {
    console.log('FAIL: Tenant suspended or billing not operational for broken DID.');
  } else if (!broken.pipelineChecks.numberActive) {
    console.log('FAIL: phone_numbers.isActive is false for broken DID.');
  } else {
    console.log('DB + Telnyx routing look OK for broken DID. If calls still fail, check live webhooks:');
    console.log('  docker compose logs api --since=10m | grep -E "\\[INBOUND ROUTING\\]|Call Control event"');
    console.log('Place a test call to the broken DID — if no webhook log appears, issue is Telnyx-side (connection/webhook URL).');
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
