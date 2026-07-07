#!/usr/bin/env node
/**
 * Issue 3 diagnostics — "calling an offline desk phone plays the default
 * greeting instead of an internal-extension-unavailable message."
 *
 * Read-only. Prints exactly which routing decision resolveInboundContext /
 * resolveRingTargets (lib/inboundCallControl.js, lib/inboundRouting.js) will
 * make for a given DID: does the DID resolve directly to an extension
 * (PhoneNumber.extensionId / routingType=direct_user), or does it fall back
 * to the tenant's general greeting/IVR/ring-group flow (in which case a
 * no-answer/offline target plays the generic tenant noAnswerMessage instead
 * of an extension-specific message)?
 *
 * Usage:
 *   npx tsx scripts/diagnose-internal-did-fallback.js --tenant-id=<uuid> --did=+15551234567
 *   npx tsx scripts/diagnose-internal-did-fallback.js --tenant-id=<uuid> --extension=101
 *
 * EC2:
 *   docker compose exec -T api npx tsx scripts/diagnose-internal-did-fallback.js \
 *     --tenant-id=8bbcdbdf-6377-44a0-bd84-ac6a34d5de96 --extension=101
 */
require('dotenv').config();

function parseArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function main() {
  const tenantId = parseArg('tenant-id') || process.env.V3_PILOT_TENANT_ID?.trim() || null;
  const did = parseArg('did');
  const extensionNumber = parseArg('extension');

  if (!tenantId) {
    console.error('Required: --tenant-id=<uuid> (or V3_PILOT_TENANT_ID in env)');
    process.exit(2);
  }
  if (!did && !extensionNumber) {
    console.error('Required: --did=<E164> or --extension=<number>');
    process.exit(2);
  }

  const { getPrisma } = require('../db');
  const { normalizePhoneNumber } = require('../lib/phone');
  const { normalizeRoutingType, resolveEffectiveRoutingType } = require('../lib/numberRouting');

  const prisma = await getPrisma();

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
    if (!tenant) {
      console.error(`Tenant not found: ${tenantId}`);
      process.exit(1);
    }
    console.log('=== Internal DID fallback diagnostics ===\n');
    console.log('Tenant:', tenant.name, tenant.id);

    let phoneRecord = null;
    if (did) {
      const normalized = normalizePhoneNumber(did);
      phoneRecord = await prisma.phoneNumber.findFirst({
        where: { tenantId, number: normalized },
      });
      if (!phoneRecord) {
        console.error(`No PhoneNumber row found for ${normalized} under this tenant.`);
      }
    }

    let extension = null;
    if (extensionNumber) {
      extension = await prisma.extension.findFirst({
        where: { tenantId, extensionNumber: String(extensionNumber), status: 'ACTIVE' },
        include: { user: true, primaryPhoneNumber: true },
      });
      if (!extension) {
        console.error(`No ACTIVE extension ${extensionNumber} found for this tenant.`);
      } else if (!phoneRecord) {
        phoneRecord = extension.primaryPhoneNumber
          || await prisma.phoneNumber.findFirst({ where: { tenantId, extensionId: extension.id } });
      }
    }

    console.log('\n--- PhoneNumber (DID) row ---');
    if (!phoneRecord) {
      console.log('  ⚠️  No PhoneNumber row resolved for this DID/extension.');
      console.log('      A caller dialing this number cannot be tied to any extension at all —');
      console.log('      it will always fall through to the tenant default greeting/IVR, online or offline.');
    } else {
      console.log('  number:', phoneRecord.number);
      console.log('  routingType (raw):', phoneRecord.routingType || '(null → tenant_default)');
      console.log('  extensionId:', phoneRecord.extensionId || '(not set)');
      console.log('  assignedUserId:', phoneRecord.assignedUserId || '(not set)');
      console.log('  ringGroupId:', phoneRecord.ringGroupId || '(not set)');
      console.log('  forwardDestination:', phoneRecord.forwardDestination || '(not set)');
    }

    const greeting = await prisma.greeting.findUnique({ where: { tenantId } });
    console.log('\n--- Tenant Greeting ---');
    if (!greeting) {
      console.log('  ⚠️  No Greeting row for this tenant (defaults apply).');
    } else {
      console.log('  ivrEnabled:', greeting.ivrEnabled === true);
      console.log('  ringGroupEnabled:', greeting.ringGroupEnabled === true);
      console.log('  ringGroupMembers (legacy JSON):', greeting.ringGroupMembers ? '(configured — see raw column)' : '(none)');
      console.log('  voicemailEnabled:', greeting.voicemailEnabled !== false);
      console.log('  message (connect):', JSON.stringify(greeting.message || '(default: Welcome to {company}...)'));
      console.log('  noAnswerMessage:', JSON.stringify(greeting.noAnswerMessage || '(default: Sorry, no one is available at {company} right now. Goodbye.)'));
    }

    const effectiveRoutingType = phoneRecord
      ? resolveEffectiveRoutingType(phoneRecord, greeting)
      : (greeting?.ivrEnabled ? 'ivr' : greeting?.ringGroupEnabled ? 'ring_group' : 'tenant_default');

    console.log('\n--- Verdict ---');
    console.log('  effectiveRoutingType:', effectiveRoutingType);

    const directToExtension = Boolean(
      phoneRecord?.extensionId
      || (normalizeRoutingType(phoneRecord?.routingType) === 'direct_user' && phoneRecord?.assignedUserId),
    );

    if (directToExtension) {
      console.log('  ✅ This DID resolves DIRECTLY to an extension (phoneRecord.extensionId or direct_user).');
      console.log('     resolveRingTargets() will build a real dial target for the desk phone regardless of');
      console.log('     online/offline state — an offline phone should fail the DIAL attempt and hit');
      console.log('     routeToVoicemailOrHangup(fallbackTrigger: "no_answer"), NOT the general greeting/IVR.');
      console.log('     If the caller instead hears the tenant greeting/IVR, capture server logs for');
      console.log('     "ring-first: deferring" / "Call Control dial" / "Routing to voicemail" during a live');
      console.log('     test call to confirm at which step it diverges.');
    } else {
      console.log('  ⚠️  This DID does NOT resolve directly to an extension at the PhoneNumber level.');
      console.log('     It will be routed via the tenant default greeting/IVR/ring-group JSON path.');
      console.log('     Root cause candidate: the DID needs routingType=direct_user + extensionId (or');
      console.log('     assignedUserId) set so it always targets the extension — see');
      console.log('     docs/vsp/pbx/08-did-routing.md "Target priority".');
    }

    if (extension) {
      console.log('\n--- Extension ---');
      console.log('  extensionNumber:', extension.extensionNumber);
      console.log('  displayName:', extension.displayName);
      console.log('  user.telnyxSipUsername:', extension.user?.telnyxSipUsername || 'MISSING');
      console.log('  user.sipRegistered:', extension.user?.sipRegistered === true);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(2);
});
