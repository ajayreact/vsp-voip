#!/usr/bin/env node
/**
 * Diagnose Telnyx WebRTC outbound readiness (Credential Connection + OVP).
 * Run on EC2: node scripts/diagnose-telnyx-outbound.js
 */
require('dotenv').config();

const axios = require('axios');
const { getPrisma } = require('../db');
const { loadPlatformSettings } = require('../lib/platformSettings');
const { getCredentialConnectionId } = require('../lib/telnyxConfig');
const {
  getCredentialConnection,
  getOutboundVoiceProfileId,
} = require('../lib/telnyxRecordingSetup');
const { getCallControlSetupStatus } = require('../lib/telnyxCallControlSetup');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();

async function main() {
  console.log('=== VSP Phone — Telnyx Outbound Diagnostic ===\n');

  if (!TELNYX_API_KEY) {
    console.error('FAIL: TELNYX_API_KEY is not set');
    process.exit(1);
  }

  const prisma = await getPrisma();
  const platform = await loadPlatformSettings(prisma);
  const credentialConnectionId = getCredentialConnectionId(platform);
  const callControl = await getCallControlSetupStatus(prisma);

  console.log('Environment:');
  console.log('  API_PUBLIC_URL:', process.env.API_PUBLIC_URL || '(not set)');
  console.log('  TELNYX_CREDENTIAL_CONNECTION_ID:', process.env.TELNYX_CREDENTIAL_CONNECTION_ID || '(from DB)');
  console.log('  TELNYX_OUTBOUND_VOICE_PROFILE_ID:', process.env.TELNYX_OUTBOUND_VOICE_PROFILE_ID || '(not set)');
  console.log('  TELNYX_CALL_CONTROL_APP_ID:', process.env.TELNYX_CALL_CONTROL_APP_ID || '(from DB)');
  console.log('');

  console.log('Credential Connection (WebRTC outbound):');
  console.log('  ID:', credentialConnectionId || 'MISSING');
  if (!credentialConnectionId) {
    console.error('\nFAIL: No credential connection configured.');
    process.exit(1);
  }

  const connection = await getCredentialConnection(credentialConnectionId);
  console.log('  Name:', connection?.connection_name || connection?.name || '(unknown)');
  console.log('  Webhook:', connection?.webhook_event_url || '(none)');
  const ovpId = connection?.outbound?.outbound_voice_profile_id || null;
  console.log('  Outbound Voice Profile ID:', ovpId || 'MISSING — outbound calls will NOT connect');

  if (!ovpId) {
    console.log('\n  FIX: Telnyx Portal → VSP-SIP-Trunk → Outbound → select VSP-Outbound');
    console.log('  OR set TELNYX_OUTBOUND_VOICE_PROFILE_ID=2982164000495633730 in .env and restart API');
  }

  console.log('\nCall Control Application (inbound PSTN):');
  console.log('  ID:', callControl.applicationId || 'MISSING');
  console.log('  Name:', callControl.applicationName || '(unknown)');
  console.log('  Webhook configured:', callControl.applicationWebhookConfigured);
  console.log('  Webhook URL:', callControl.callControlWebhookUrl);

  console.log('\nSample tenant numbers (should stay on Call Control app, not credential connection):');
  const numbers = await prisma.phoneNumber.findMany({
    take: 5,
    select: { number: true, tenantId: true },
  });

  for (const row of numbers) {
    try {
      const res = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
        headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, Accept: 'application/json' },
        params: { 'filter[phone_number]': row.number },
      });
      const telnyx = res.data?.data?.[0];
      const onCallControl = telnyx?.connection_id === callControl.applicationId;
      console.log(
        `  ${row.number}: connection_id=${telnyx?.connection_id || '?'} ${onCallControl ? '(OK on Call Control)' : '(WRONG — should be on Call Control app)'}`,
      );
    } catch (err) {
      console.log(`  ${row.number}: could not query Telnyx (${err.message})`);
    }
  }

  const outboundReady = Boolean(credentialConnectionId && ovpId);
  console.log('\n=== Result ===');
  if (outboundReady) {
    console.log('PASS: Outbound WebRTC should work. If calls still fail, check browser console for [VSP Softphone] logs.');
  } else {
    console.log('FAIL: Outbound not ready — assign Outbound Voice Profile on credential connection.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
