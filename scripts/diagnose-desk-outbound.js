#!/usr/bin/env node
/**
 * Diagnose Grandstream / desk phone outbound (Park Outbound Pattern 1).
 *
 * Usage:
 *   node scripts/diagnose-desk-outbound.js
 *   node scripts/diagnose-desk-outbound.js --extension 101
 *
 * On the server while placing a failing desk call:
 *   docker compose logs api --tail=100 -f | grep -E "parked outbound|extension.initiated|Parked WebRTC|caller not resolved|connection_id_mismatch"
 */

require('dotenv').config();

async function main() {
  const extensionNumber = process.argv.includes('--extension')
    ? process.argv[process.argv.indexOf('--extension') + 1]
    : '101';

  const { PrismaClient } = require('../generated/prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { loadPlatformSettings } = require('../lib/platformSettings');
  const { getCredentialConnectionId } = require('../lib/telnyxConfig');
  const { getCallControlApplicationId } = require('../lib/telnyxCallControlSetup');
  const { getCredentialConnection } = require('../lib/telnyxRecordingSetup');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const platform = await loadPlatformSettings(prisma);
    const credentialConnectionId = getCredentialConnectionId(platform);
    const callControlApplicationId = getCallControlApplicationId(platform);
    const apiPublic = process.env.API_PUBLIC_URL?.replace(/\/$/, '') || '(not set)';

    console.log('=== Desk outbound diagnostics ===\n');
    console.log('API_PUBLIC_URL:', apiPublic);
    console.log('Credential connection ID (platform):', credentialConnectionId || 'MISSING');
    console.log('Call Control application ID:', callControlApplicationId || 'MISSING');
    console.log('Expected voice webhook:', apiPublic !== '(not set)' ? `${apiPublic}/webhook/voice` : '—');
    console.log('Expected call-control webhook:', apiPublic !== '(not set)' ? `${apiPublic}/webhook/call-control` : '—');
    console.log('');

    if (credentialConnectionId) {
      const connection = await getCredentialConnection(credentialConnectionId);
      console.log('Telnyx credential connection:');
      console.log('  webhook_event_url:', connection?.webhook_event_url || 'MISSING');
      console.log('  call_parking_enabled:', connection?.outbound?.call_parking_enabled === true ? 'true' : 'false');
      console.log('  outbound_voice_profile_id:', connection?.outbound?.outbound_voice_profile_id || 'MISSING');
      console.log('  sip_uri_calling_preference:', connection?.sip_uri_calling_preference || '—');
      console.log('');
    }

    const extension = await prisma.extension.findFirst({
      where: { extensionNumber: String(extensionNumber), status: 'ACTIVE' },
      include: {
        user: true,
        security: true,
        primaryPhoneNumber: true,
      },
    });

    if (!extension) {
      console.error(`Extension ${extensionNumber} not found`);
      process.exit(1);
    }

    console.log(`Extension ${extension.extensionNumber} (${extension.displayName})`);
    console.log('  tenantId:', extension.tenantId);
    console.log('  userId:', extension.userId || 'UNASSIGNED');
    console.log('  user.telnyxSipUsername:', extension.user?.telnyxSipUsername || 'MISSING');
    console.log('  user.sipRegistered:', extension.user?.sipRegistered === true ? 'true' : 'false');
    console.log('  legacy ext.telnyxSipUsername:', extension.telnyxSipUsername || '—');
    console.log('  outboundCallerId:', extension.security?.outboundCallerId || '—');
    console.log('  primary DID:', extension.primaryPhoneNumber?.number || '—');
    console.log('');
    console.log('Grandstream MUST use SIP User ID = user.telnyxSipUsername (not extension number).');
    console.log('');
    console.log('While placing a desk outbound call, watch API logs for:');
    console.log('  [INTERNAL CALL] parked outbound payload');
    console.log('  [INTERNAL CALL] extension.initiated { callerResolved: true }');
    console.log('  OR: Parked WebRTC outbound skipped: { reason: ... }');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
