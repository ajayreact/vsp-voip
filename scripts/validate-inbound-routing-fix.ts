#!/usr/bin/env node
/**
 * Validate inbound ring targets for production DIDs after routing fix.
 * Usage: npx tsx scripts/validate-inbound-routing-fix.ts
 */
import 'dotenv/config';

const TARGET_NUMBERS = ['+13099880196', '+17748123836', '+19563961388'];

async function main() {
  const { getPrisma } = await import('../db.js');
  const {
    resolveRingTargets,
    resolveEffectiveUserId,
    hasAppRingTargets,
    hasSipRingTargets,
    formatTargetDialTo,
  } = await import('../lib/inboundRouting.js');
  const { applyNumberRoutingToGreeting } = await import('../lib/numberRouting.js');
  const { loadCredentialConnectionId } = await import('../lib/softphone.js');

  const prisma = await getPrisma();
  const connectionId = await loadCredentialConnectionId(prisma);

  let failures = 0;

  console.log('=== Inbound routing fix validation ===\n');

  for (const number of TARGET_NUMBERS) {
    const phone = await prisma.phoneNumber.findFirst({
      where: { number },
      include: {
        extension: { select: { extensionNumber: true, userId: true, displayName: true } },
      },
    });

    console.log('─'.repeat(72));
    console.log(`DID: ${number}`);

    if (!phone) {
      console.log('  SKIP — not in database\n');
      failures += 1;
      continue;
    }

    let greeting = await prisma.greeting.findUnique({ where: { tenantId: phone.tenantId } });
    greeting = applyNumberRoutingToGreeting(greeting, phone);

    const effectiveUserId = resolveEffectiveUserId(phone.extension, phone);
    const resolved = await resolveRingTargets(
      prisma,
      phone.tenantId,
      greeting,
      phone,
      connectionId,
    );

    const appTargets = resolved.targets.filter((t) => t.type === 'app');
    const sipTargets = resolved.targets.filter((t) => t.type === 'sip');

    console.log(`  Extension: ${phone.extension?.extensionNumber || '—'} (${phone.extension?.displayName || '—'})`);
    console.log(`  extension.userId: ${phone.extension?.userId ?? 'null'}`);
    console.log(`  assignedUserId: ${phone.assignedUserId ?? 'null'}`);
    console.log(`  effectiveUserId: ${effectiveUserId ?? 'null'}`);
    console.log(`  APP targets: ${appTargets.length}`);
    for (const t of appTargets) {
      console.log(`    • ${t.label} → ${formatTargetDialTo(t)}`);
    }
    console.log(`  SIP targets: ${sipTargets.length}`);
    for (const t of sipTargets) {
      console.log(`    • ${t.label} → ${formatTargetDialTo(t)}`);
    }

    if (number === '+17748123836') {
      if (!hasAppRingTargets(resolved.targets)) {
        console.log('  FAIL — expected admin APP target via assignedUserId');
        failures += 1;
      } else {
        console.log('  PASS — admin APP target present');
      }
    }

    if (number === '+19563961388') {
      if (!hasAppRingTargets(resolved.targets) || !hasSipRingTargets(resolved.targets)) {
        console.log('  FAIL — expected desk SIP + admin APP targets');
        failures += 1;
      } else {
        console.log('  PASS — desk SIP + admin APP targets');
      }
    }

    if (number === '+13099880196') {
      if (!hasAppRingTargets(resolved.targets)) {
        console.log('  WARN — no APP target (assign employee to extension 103 in DB)');
      } else {
        console.log('  PASS — APP target present');
      }
    }

    console.log('');
  }

  await prisma.$disconnect();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
