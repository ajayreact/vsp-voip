import 'dotenv/config';

const EXTENSIONS = ['101', '102', '103'];

async function main() {
  const {
    parseInternalExtensionDestination,
    loadTargetExtension,
    resolveCallerFromAddress,
  } = await import('../lib/internalExtensionDial.js');
  const { resolveExtensionRingTargets, formatTargetDialTo } = await import('../lib/inboundRouting.js');
  const { resolveExtensionCallPolicy } = await import('../lib/extensionInbound.js');

  const { PrismaClient } = await import('../generated/prisma/client.js');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { loadCredentialConnectionId } = await import('../lib/telnyxSipProfile.js');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const connectionId = await loadCredentialConnectionId(prisma);
    const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!tenant) {
      console.error('No tenant found');
      process.exit(1);
    }

    console.log('=== Internal Extension Dial validation ===\n');
    console.log(`Tenant: ${tenant.name} (${tenant.id})\n`);

    let pass = 0;
    let fail = 0;

    console.log('── Destination parsing');
    for (const ext of ['101', '102', 'sip:103@sip.telnyx.com', '+15551234567']) {
      const parsed = parseInternalExtensionDestination(ext);
      console.log(`  ${ext.padEnd(28)} → ${parsed ?? '(PSTN / external)'}`);
    }
    console.log('');

    for (const extensionNumber of EXTENSIONS) {
      console.log('─'.repeat(72));
      console.log(`Extension ${extensionNumber}`);

      const extension = await loadTargetExtension(prisma, tenant.id, extensionNumber);
      if (!extension) {
        console.log('  SKIP — extension not found or inactive\n');
        fail += 1;
        continue;
      }

      const resolution = await resolveExtensionRingTargets(prisma, extension, connectionId);
      const targets = resolution?.targets || [];

      console.log(`  Display:   ${extension.displayName}`);
      console.log(`  Employee:  ${extension.user?.name || '—'}`);
      console.log(`  Strategy:  ${resolution?.strategy}`);
      console.log(`  Targets (${targets.length}):`);

      for (const target of targets) {
        console.log(`    • ${target.type.toUpperCase()} — ${target.label} → ${formatTargetDialTo(target)}`);
      }

      const policy = await resolveExtensionCallPolicy(
        prisma,
        tenant,
        extension,
        'ext:101',
        { credentialConnectionId: connectionId, trigger: 'internal' },
      );
      console.log(`  Policy (internal from ext:101): ${policy?.action}${policy?.reason ? ` — ${policy.reason}` : ''}`);

      if (targets.length > 0) {
        pass += 1;
      } else {
        fail += 1;
      }
      console.log('');
    }

    console.log('── Caller resolution (desk + app SIP usernames)');
    const samples = await prisma.extension.findMany({
      where: { tenantId: tenant.id, status: 'ACTIVE', extensionNumber: { in: ['101', '102'] } },
      select: { extensionNumber: true, telnyxSipUsername: true, user: { select: { telnyxSipUsername: true } } },
      take: 2,
    });

    for (const sample of samples) {
      if (sample.telnyxSipUsername) {
        const deskCaller = await resolveCallerFromAddress(prisma, `sip:${sample.telnyxSipUsername}@sip.telnyx.com`);
        console.log(
          `  Desk ${sample.extensionNumber}: tenant=${deskCaller?.tenantId ? 'OK' : 'FAIL'} ext=${deskCaller?.callerExtension?.extensionNumber || '—'}`,
        );
      }
      if (sample.user?.telnyxSipUsername) {
        const appCaller = await resolveCallerFromAddress(prisma, `sip:${sample.user.telnyxSipUsername}@sip.telnyx.com`);
        console.log(
          `  App  ${sample.extensionNumber}: tenant=${appCaller?.tenantId ? 'OK' : 'FAIL'} ext=${appCaller?.callerExtension?.extensionNumber || '—'}`,
        );
      }
    }

    console.log('\n── Summary');
    console.log(`  Extensions with ring targets: ${pass}/${EXTENSIONS.length}`);
    console.log(fail === 0 ? '\nPASS — internal dial prerequisites met' : '\nWARN — some extensions missing targets');
    process.exit(fail === 0 ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
