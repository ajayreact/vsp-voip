import 'dotenv/config';

const TARGET_NUMBERS = ['+19563961388', '+17748123836', '+13099880196'];

function formatUs(number: string): string {
  const d = number.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return number;
}

async function main() {
  const {
    resolveExtensionForPhoneRecord,
    resolveExtensionRingTargets,
    formatTargetDialTo,
  } = await import('../lib/inboundRouting.js');

  const { PrismaClient } = await import('../generated/prisma/client.js');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { loadCredentialConnectionId } = await import('../lib/telnyxSipProfile.js');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const connectionId = await loadCredentialConnectionId(prisma);

    console.log('=== Phase B validation: resolveExtensionRingTargets ===\n');

    let pass = 0;
    let fail = 0;

    for (const number of TARGET_NUMBERS) {
      const phone = await prisma.phoneNumber.findFirst({
        where: { number },
        include: { tenant: { select: { id: true, name: true } } },
      });

      console.log('─'.repeat(72));
      console.log(`DID: ${formatUs(number)}`);

      if (!phone) {
        console.log('  SKIP — not in database\n');
        continue;
      }

      const extension = await resolveExtensionForPhoneRecord(prisma, phone.tenantId, phone);
      if (!extension) {
        console.log('  Extension: none');
        console.log('  Targets:   (none — tenant default or unassigned)\n');
        continue;
      }

      const resolution = await resolveExtensionRingTargets(prisma, extension, connectionId);
      const targets = resolution?.targets || [];

      console.log(`  Extension: ${extension.extensionNumber} — ${extension.displayName}`);
      console.log(`  Employee:  ${extension.user?.name || '—'}`);
      console.log(`  multiDeviceEnabled: ${extension.multiDeviceEnabled !== false}`);
      console.log(`  Strategy:  ${resolution?.strategy}`);
      console.log(`  Targets (${targets.length}):`);

      for (const target of targets) {
        const dialTo = formatTargetDialTo(target);
        console.log(`    • ${target.type.toUpperCase()} — ${target.label} → ${dialTo}`);
      }

      if (targets.length === 0) {
        console.log('    (none)');
        fail += 1;
      } else {
        pass += 1;
      }

      const hasDesk = targets.some((t) => t.type === 'sip');
      const hasApp = targets.some((t) => t.type === 'app');

      if (extension.sipEnabled !== false && extension.telnyxSipUsername && !hasDesk) {
        console.log('  FAIL — desk credential expected but missing from targets');
        fail += 1;
        pass -= 1;
      }

      if (extension.userId && extension.user?.telnyxSipUsername && !hasApp) {
        console.log('  FAIL — employee app credential expected but missing from targets');
        fail += 1;
        pass -= 1;
      }

      if (targets.length > 1) {
        const expected = extension.multiDeviceEnabled !== false ? 'simultaneous' : 'sequential';
        if (resolution?.strategy === expected) {
          console.log(`  PASS — strategy matches multiDeviceEnabled (${expected})`);
        } else {
          console.log(`  FAIL — expected strategy ${expected}, got ${resolution?.strategy}`);
          fail += 1;
        }
      }

      console.log('');
    }

    console.log('=== Summary ===');
    console.log(`DIDs with ring targets: ${pass}`);
    console.log(`Failures: ${fail}`);
    console.log('\nRouting flow:');
    console.log('  DID → Extension → resolveExtensionRingTargets()');
    console.log('    → sip (desk Telnyx credential)');
    console.log('    → app (employee Telnyx credential — mobile/WebRTC unchanged)');

    process.exit(fail > 0 ? 1 : 0);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
