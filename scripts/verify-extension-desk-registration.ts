import 'dotenv/config';

/**
 * Verifies Phase A desk credential provisioning and registration tracking.
 *
 * Usage:
 *   npx tsx scripts/verify-extension-desk-registration.ts
 *   npx tsx scripts/verify-extension-desk-registration.ts --extension-number 101
 *   npx tsx scripts/verify-extension-desk-registration.ts --poll-seconds 120
 *   npx tsx scripts/verify-extension-desk-registration.ts --simulate-webhook
 *
 * For live desk phone test, register in Zoiper/Linphone using printed settings, then run with --poll-seconds 120.
 */

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  let extensionNumber = '101';
  let pollSeconds = 0;
  let simulateWebhook = false;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--extension-number') extensionNumber = args[i + 1] || extensionNumber;
    if (args[i] === '--poll-seconds') pollSeconds = Number(args[i + 1] || 0);
    if (args[i] === '--simulate-webhook') simulateWebhook = true;
  }

  return { extensionNumber, pollSeconds, simulateWebhook };
}

async function main() {
  const { extensionNumber, pollSeconds, simulateWebhook } = parseArgs();

  const { PrismaClient } = await import('../generated/prisma/client.js');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { getTelephonyCredential } = await import('../lib/telnyxCallControl.js');
  const { checkTelephonyCredentialRegistration } = await import('../lib/voiceTelemetry.js');
  const { loadTelnyxConnectionContext } = await import('../lib/telnyxSipProfile.js');
  const { handleTelnyxVoiceTelemetryEvent } = await import('../lib/voiceTelemetry.js');
  const { DEFAULT_SIP_SERVER, DEFAULT_SIP_PORT, DEFAULT_SIP_PORT_TLS } = await import('../lib/telnyxSipProfile.js');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const extension = await prisma.extension.findFirst({
      where: { extensionNumber, status: 'ACTIVE' },
    });

    if (!extension) {
      console.error(`Extension ${extensionNumber} not found`);
      process.exit(1);
    }

    console.log('=== Extension desk SIP verification ===\n');
    console.log(`Extension: ${extension.extensionNumber} — ${extension.displayName}`);
    console.log(`telnyxCredentialId: ${extension.telnyxCredentialId || 'MISSING'}`);
    console.log(`telnyxSipUsername:  ${extension.telnyxSipUsername || 'MISSING'}`);
    console.log(`telnyxSipPassword:  ${extension.telnyxSipPassword ? '(set)' : 'MISSING'}`);
    console.log(`sipRegistered (DB): ${extension.sipRegistered === true ? 'true' : 'false'}\n`);

    if (!extension.telnyxCredentialId || !extension.telnyxSipUsername || !extension.telnyxSipPassword) {
      console.error('FAIL — Extension missing Telnyx desk credentials. Run backfill first.');
      process.exit(1);
    }

    // 1. Telnyx credential exists
    const telnyxCred = await getTelephonyCredential(extension.telnyxCredentialId);
    console.log('PASS — Telnyx credential API');
    console.log(`  id: ${telnyxCred?.id}`);
    console.log(`  sip_username: ${telnyxCred?.sip_username}`);
    console.log(`  tag: ${telnyxCred?.tag || '—'}\n`);

    if (telnyxCred?.sip_username !== extension.telnyxSipUsername) {
      console.warn('WARN — DB telnyxSipUsername differs from Telnyx API');
    }

    const connectionContext = await loadTelnyxConnectionContext(prisma);
    const connectionId = connectionContext.credentialConnectionId;

    console.log('--- Zoiper / Linphone manual setup ---');
    console.log(`Account name:   Ext ${extension.extensionNumber}`);
    console.log(`Username:       ${extension.telnyxSipUsername}`);
    console.log(`Password:       ${extension.telnyxSipPassword}`);
    console.log(`Domain/Server:  ${DEFAULT_SIP_SERVER}`);
    console.log(`Port:           ${DEFAULT_SIP_PORT} (UDP) or ${DEFAULT_SIP_PORT_TLS} (TLS)`);
    console.log(`Transport:      UDP (or TLS)`);
    console.log(`Auth ID:        ${extension.telnyxSipUsername}`);
    console.log('Register the account, then re-run with --poll-seconds 60\n');

    if (simulateWebhook) {
      console.log('--- Simulating Telnyx registration webhook (tracking pipeline test) ---');
      await handleTelnyxVoiceTelemetryEvent(prisma, {
        data: {
          event_type: 'registration.success',
          payload: {
            sip_username: extension.telnyxSipUsername,
            registered: true,
            status: 'Registered',
          },
        },
      });
      const afterWebhook = await prisma.extension.findUnique({ where: { id: extension.id } });
      if (afterWebhook?.sipRegistered === true) {
        console.log('PASS — Extension.sipRegistered=true after webhook simulation\n');
      } else {
        console.error('FAIL — Webhook did not set Extension.sipRegistered');
        process.exit(1);
      }
    }

    async function checkRegistration() {
      if (connectionId) {
        const telnyx = await checkTelephonyCredentialRegistration(connectionId, extension.telnyxSipUsername!);
        if (telnyx?.status) {
          console.log(`Telnyx registration status: ${telnyx.status}`);
          return String(telnyx.status).toLowerCase() === 'registered';
        }
      }
      const row = await prisma.extension.findUnique({ where: { id: extension.id } });
      return row?.sipRegistered === true;
    }

    if (pollSeconds > 0) {
      console.log(`--- Polling registration for ${pollSeconds}s ---`);
      const deadline = Date.now() + pollSeconds * 1000;
      while (Date.now() < deadline) {
        if (await checkRegistration()) {
          const row = await prisma.extension.findUnique({ where: { id: extension.id } });
          console.log('\nPASS — Desk phone registered');
          console.log(`  Extension.sipRegistered: ${row?.sipRegistered}`);
          console.log(`  sipRegistrationSource:   ${row?.sipRegistrationSource || '—'}`);
          process.exit(0);
        }
        await sleep(5000);
      }
      console.error('\nFAIL — No registration detected within poll window. Register Zoiper/Linphone and retry.');
      process.exit(2);
    }

    const registeredNow = await checkRegistration();
    if (registeredNow) {
      console.log('PASS — Desk credential currently registered');
      process.exit(0);
    }

    console.log('INFO — Not registered yet. Use Zoiper/Linphone settings above, or run:');
    console.log(`  npx tsx scripts/verify-extension-desk-registration.ts --extension-number ${extensionNumber} --poll-seconds 120`);
    console.log('Tracking pipeline test (no SIP client):');
    console.log(`  npx tsx scripts/verify-extension-desk-registration.ts --extension-number ${extensionNumber} --simulate-webhook`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
