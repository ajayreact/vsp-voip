#!/usr/bin/env node
/**
 * Ring group routing final validation — per-member desk SIP + app/WebRTC targets.
 * npm run validate:ring-group-routing
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function summarizeTargets(targets, formatTargetDialTo) {
  const list = Array.isArray(targets) ? targets : [];
  const desk = list.filter((t) => t.type === 'sip');
  const app = list.filter((t) => t.type === 'app');
  return {
    count: list.length,
    deskSip: desk.length > 0,
    mobileWebRtc: app.length > 0,
    deskDialTos: desk.map((t) => formatTargetDialTo(t)).filter(Boolean),
    appDialTos: app.map((t) => formatTargetDialTo(t)).filter(Boolean),
    types: list.map((t) => t.type),
  };
}

async function main() {
  const routerSrc = read('lib/ringGroupRouter.js');
  const inboundSrc = read('lib/inboundRouting.js');

  const staticChecks = [];
  const usesResolveExtensionRingTargets =
    routerSrc.includes('resolveExtensionRingTargets(')
    && /for\s*\(\s*const\s+member\s+of\s+orderedMembers/.test(routerSrc);
  const usesLegacyMemberHelper = /extensionMemberToTarget\s*\(/.test(routerSrc + inboundSrc);

  staticChecks.push({
    check: 'ringGroupRouter uses resolveExtensionRingTargets() per member',
    pass: usesResolveExtensionRingTargets,
  });
  staticChecks.push({
    check: 'extensionMemberToTarget() not used (removed / never wired)',
    pass: !usesLegacyMemberHelper,
  });
  staticChecks.push({
    check: 'resolveExtensionRingTargets includes desk SIP (type: sip)',
    pass: inboundSrc.includes("type: 'sip'") && inboundSrc.includes('telnyxSipUsername'),
  });
  staticChecks.push({
    check: 'resolveExtensionRingTargets includes app/WebRTC (type: app)',
    pass: inboundSrc.includes("type: 'app'") && inboundSrc.includes('ensureAppUserDialReady'),
  });

  console.log('RING GROUP ROUTING — STATIC CODE REVIEW\n');
  for (const row of staticChecks) {
    console.log(`  [${row.pass ? 'PASS' : 'FAIL'}] ${row.check}`);
  }

  const {
    resolveExtensionRingTargets,
    formatTargetDialTo,
    resolveRingTargets,
  } = await import('../lib/inboundRouting.js');
  const { resolveRingGroupEntityTargets } = await import('../lib/ringGroupRouter.js');
  const { loadCredentialConnectionId } = await import('../lib/telnyxSipProfile.js');
  const { PrismaClient } = await import('../generated/prisma/client.js');
  const { PrismaPg } = await import('@prisma/adapter-pg');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  let exitCode = staticChecks.some((c) => !c.pass) ? 1 : 0;

  try {
    const connectionId = await loadCredentialConnectionId(prisma);
    const tenant = await prisma.tenant.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!tenant) {
      console.log('\n[WARN] No active tenant — skipping DB member resolution');
      process.exit(exitCode);
    }

    const groups = await prisma.ringGroup.findMany({
      where: { tenantId: tenant.id, isActive: true },
      include: {
        members: {
          where: { isActive: true },
          include: { extension: { include: { user: true } } },
          orderBy: { priority: 'asc' },
        },
        phoneNumbers: { select: { number: true, routingType: true } },
      },
      orderBy: { name: 'asc' },
    });

    console.log(`\nRING GROUP ROUTING — TENANT "${tenant.name}" (${groups.length} active group(s))\n`);

    if (groups.length === 0) {
      console.log('  [WARN] No active ring groups in tenant — create one for live member tests');
    }

    for (const group of groups) {
      console.log(`── Ring group: ${group.name} (${group.id})`);
      console.log(`   Strategy: ${group.ringStrategy} | Members: ${group.members.length}`);
      if (group.phoneNumbers.length) {
        console.log(`   DIDs: ${group.phoneNumbers.map((p) => p.number).join(', ')}`);
      }

      const aggregated = await resolveRingGroupEntityTargets(prisma, group, connectionId);
      const aggSummary = summarizeTargets(aggregated.targets, formatTargetDialTo);
      console.log(`   Aggregated targets: ${aggSummary.count} (resolver: resolveRingGroupEntityTargets → resolveExtensionRingTargets)`);
      console.log(`   Desk SIP in group: ${aggSummary.deskSip ? 'YES' : 'NO'} | Mobile/WebRTC in group: ${aggSummary.mobileWebRtc ? 'YES' : 'NO'}`);

      if (group.members.length === 0) {
        console.log('   [FAIL] No active members\n');
        exitCode = 1;
        continue;
      }

      for (const member of group.members) {
        const ext = member.extension;
        if (!ext) {
          console.log(`   [FAIL] Member ${member.id}: extension missing`);
          exitCode = 1;
          continue;
        }
        if (ext.status !== 'ACTIVE') {
          console.log(`   [SKIP] Ext ${ext.extensionNumber}: inactive`);
          continue;
        }

        const resolution = await resolveExtensionRingTargets(prisma, ext, connectionId);
        const summary = summarizeTargets(resolution?.targets, formatTargetDialTo);
        const resolver = 'resolveExtensionRingTargets()';

        console.log(`   Member ext ${ext.extensionNumber} (${ext.displayName || '—'}) via ${resolver}:`);
        console.log(`     Desk SIP:      ${summary.deskSip ? 'YES' : 'NO'}${summary.deskDialTos.length ? ` → ${summary.deskDialTos.join(', ')}` : ''}`);
        console.log(`     Mobile/WebRTC: ${summary.mobileWebRtc ? 'YES' : 'NO'}${summary.appDialTos.length ? ` → ${summary.appDialTos.join(', ')}` : ''}`);
        console.log(`     Employee:      ${ext.userId ? (ext.user?.name || ext.userId) : 'none (desk-only OK)'}`);

        if (!summary.deskSip && ext.sipEnabled !== false && !ext.telnyxSipUsername) {
          console.log('     [WARN] Desk SIP expected but Extension.telnyxSipUsername missing');
        }
        if (!summary.count) {
          console.log('     [FAIL] Zero dial targets for member');
          exitCode = 1;
        }
      }

      // Inbound path smoke: DID assigned to this ring group
      const rgPhone = group.phoneNumbers[0];
      if (rgPhone) {
        const greeting = await prisma.greeting.findUnique({ where: { tenantId: tenant.id } });
        const inbound = await resolveRingTargets(
          prisma,
          tenant.id,
          greeting || {},
          { ringGroupId: group.id, routingType: 'ring_group', tenantId: tenant.id },
          connectionId,
        );
        const inboundSummary = summarizeTargets(inbound.targets, formatTargetDialTo);
        console.log(`   Inbound resolveRingTargets (DID → ring group): ${inboundSummary.count} target(s), desk=${inboundSummary.deskSip}, app=${inboundSummary.mobileWebRtc}`);
        if (inboundSummary.count !== aggSummary.count) {
          console.log('     [FAIL] Inbound path target count differs from resolveRingGroupEntityTargets');
          exitCode = 1;
        }
      }

      console.log('');
    }

    console.log('ROUTING PATH (Call Control inbound):');
    console.log('  PSTN/DID → handleCallInitiated → resolveRingTargets');
    console.log('    → resolveEntityRingGroup → resolveRingGroupEntityTargets');
    console.log('      → per member: resolveExtensionRingTargets');
    console.log('        → desk: type=sip (Extension.telnyxSipUsername)');
    console.log('        → mobile + WebRTC: type=app (User.telnyxSipUsername, shared credential)');
    console.log('    → startConnectFlow → dialSingleTarget / dialAllTargetsSimultaneously');
    console.log('      → formatTargetDialTo → Telnyx dialDestination\n');

    if (exitCode === 0) {
      console.log('RING GROUP ROUTING VALIDATION — PASS');
    } else {
      console.log('RING GROUP ROUTING VALIDATION — FAIL (see member rows above)');
    }
  } finally {
    await prisma.$disconnect();
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
