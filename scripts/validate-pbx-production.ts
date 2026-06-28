#!/usr/bin/env node
/**
 * PBX production hardening validation — resolution + wiring checks.
 * npm run validate:pbx-production
 *
 * Ring-target severity (per extension / route):
 *   PASS    — at least one dial target (desk sip OR app/WebRTC)
 *   WARNING — reachable via desk only (no app/WebRTC; employee optional)
 *   FAIL    — zero dial targets
 *
 * Exit 0 when no failures (warnings allowed). Live PSTN/WebRTC E2E is out of scope.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const failures = [];
const warnings = [];

function fail(scenario, message) {
  failures.push({ scenario, message });
}

function warn(scenario, message) {
  warnings.push({ scenario, message });
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/**
 * @param {string} scenario
 * @param {string} label
 * @param {Array<{ type?: string }>} targets
 */
function assertRingTargets(scenario, label, targets) {
  const list = Array.isArray(targets) ? targets : [];
  const hasSip = list.some((t) => t.type === 'sip');
  const hasApp = list.some((t) => t.type === 'app');

  if (list.length === 0) {
    fail(scenario, `${label}: no ring targets (desk or app)`);
    return { hasSip, hasApp, count: 0 };
  }

  if (!hasApp) {
    const deskNote = hasSip ? 'desk SIP only' : 'non-app targets only';
    warn(
      scenario,
      `${label}: no mobile/WebRTC (app) target — ${deskNote}; employee assignment optional for desk-only extensions`,
    );
  }

  return { hasSip, hasApp, count: list.length };
}

async function main() {
  const { PrismaClient } = await import('../generated/prisma/client.js');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const {
      resolveExtensionForPhoneRecord,
      resolveExtensionRingTargets,
      formatTargetDialTo,
    } = await import('../lib/inboundRouting.js');
    const { resolveRingGroupEntityTargets } = await import('../lib/ringGroupRouter.js');
    const { parseInternalExtensionDestination } = await import('../lib/internalExtensionDial.js');
    const {
      buildVoicemailClientStateFromSession,
      resolveExtensionIdForVoicemail,
      extensionVoicemailWhereClause,
    } = await import('../lib/voicemail.js');
    const { loadCredentialConnectionId } = await import('../lib/telnyxSipProfile.js');

    const connectionId = await loadCredentialConnectionId(prisma);
    const tenant = await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    if (!tenant) {
      fail('setup', 'No active tenant in database');
      printResults();
      process.exit(1);
    }

    // --- 1. PSTN → DID → Extension ---
    const pstnDid = process.env.PBX_VALIDATE_DID || '+19563961388';
    const phone = await prisma.phoneNumber.findFirst({
      where: { tenantId: tenant.id, number: pstnDid },
    });
    if (!phone) {
      fail('1 PSTN → DID → Extension', `DID ${pstnDid} not found for tenant`);
    } else {
      const extension = await resolveExtensionForPhoneRecord(prisma, tenant.id, phone);
      if (!extension) {
        fail('1 PSTN → DID → Extension', `DID ${pstnDid} not linked to an extension`);
      } else {
        const resolution = await resolveExtensionRingTargets(prisma, extension, connectionId);
        assertRingTargets(
          '1 PSTN → DID → Extension',
          `Extension ${extension.extensionNumber} (${extension.displayName})`,
          resolution?.targets,
        );
        const ccSrc = read('lib/inboundCallControl.js');
        if (!ccSrc.includes('voicemailExtensionId')) {
          fail('1 PSTN → DID → Extension', 'inboundCallControl missing voicemailExtensionId on session');
        }
      }
    }

    // --- 2. PSTN → Ring Group ---
    const ringGroup = await prisma.ringGroup.findFirst({
      where: { tenantId: tenant.id, isActive: true },
      include: {
        members: {
          where: { isActive: true },
          include: { extension: { include: { user: true } } },
        },
      },
    });
    if (!ringGroup) {
      warn('2 PSTN → Ring Group', 'No active ring group in tenant (skip route test)');
    } else if (ringGroup.members.length === 0) {
      fail('2 PSTN → Ring Group', `Ring group "${ringGroup.name}" has no members`);
    } else {
      const rgPhone = await prisma.phoneNumber.findFirst({
        where: { tenantId: tenant.id, ringGroupId: ringGroup.id },
      });
      if (!rgPhone) {
        warn('2 PSTN → Ring Group', `No DID assigned to ring group "${ringGroup.name}"`);
      }
      const rgResolution = await resolveRingGroupEntityTargets(prisma, ringGroup, connectionId);
      const rgTargets = rgResolution?.targets || [];
      assertRingTargets(
        '2 PSTN → Ring Group',
        `Ring group "${ringGroup.name}"`,
        rgTargets,
      );

      for (const member of ringGroup.members) {
        const ext = member.extension;
        if (!ext || ext.status !== 'ACTIVE') continue;
        const memberResolution = await resolveExtensionRingTargets(prisma, ext, connectionId);
        assertRingTargets(
          '2 PSTN → Ring Group',
          `Member extension ${ext.extensionNumber}`,
          memberResolution?.targets,
        );
      }

      const memberCount = new Set(rgTargets.map((t) => t.extensionId).filter(Boolean)).size;
      if (memberCount < 2 && ringGroup.members.length >= 2) {
        fail(
          '2 PSTN → Ring Group',
          'Multiple members configured but aggregated targets cover fewer than 2 extensions',
        );
      }
    }

    // --- 3. Extension → Extension ---
    if (parseInternalExtensionDestination('102') !== '102') {
      fail('3 Extension → Extension', 'parseInternalExtensionDestination failed for 102');
    }
    const ext101 = await prisma.extension.findFirst({
      where: { tenantId: tenant.id, extensionNumber: '101', status: 'ACTIVE' },
    });
    const ext102 = await prisma.extension.findFirst({
      where: { tenantId: tenant.id, extensionNumber: '102', status: 'ACTIVE' },
    });
    if (!ext101) fail('3 Extension → Extension', 'Extension 101 not found');
    if (!ext102) fail('3 Extension → Extension', 'Extension 102 not found (create for E2E)');
    const internalSrc = read('lib/internalExtensionDial.js');
    if (!internalSrc.includes('voicemailExtensionId')) {
      fail('3 Extension → Extension', 'internalExtensionDial missing voicemailExtensionId');
    }
    if (ext102) {
      const vmInternal = buildVoicemailClientStateFromSession({
        tenantId: tenant.id,
        from: 'ext:101',
        to: 'ext:102',
        targetExtensionId: ext102.id,
        callKind: 'internal',
      });
      const vmParsed = JSON.parse(Buffer.from(vmInternal, 'base64').toString('utf8'));
      if (!vmParsed.extensionId) {
        fail('3 Extension → Extension', 'Voicemail client state missing extensionId for internal call');
      }
    }

    // --- 4. Desk SIP → Extension ---
    if (ext101) {
      const deskResolution = await resolveExtensionRingTargets(prisma, ext101, connectionId);
      const deskTargets = deskResolution?.targets || [];
      const sipTarget = deskTargets.find((t) => t.type === 'sip');
      if (!sipTarget) {
        warn('4 Desk SIP → Extension', 'Extension 101 has no desk SIP target (may be app-only)');
      } else {
        const dialTo = formatTargetDialTo(sipTarget);
        if (!dialTo || !String(dialTo).includes('sip:')) {
          fail('4 Desk SIP → Extension', 'Desk SIP dialTo URI not formatted for extension 101');
        }
      }
    }

    // --- 5. Mobile → Extension ---
    const mobileSrc = read('mobile-rn/src/calling/dialNormalization.ts');
    if (!mobileSrc.includes('isExtensionDialInput')) {
      fail('5 Mobile → Extension', 'mobile-rn missing isExtensionDialInput');
    } else {
      pass('5 Mobile → Extension', 'mobile-rn extension dial detection present');
    }
    if (ext102) {
      const mobileResolution = await resolveExtensionRingTargets(prisma, ext102, connectionId);
      assertRingTargets(
        '5 Mobile → Extension',
        'Extension 102',
        mobileResolution?.targets,
      );
    }

    // --- 6. No-answer → Voicemail ---
    const schema = read('prisma/schema.prisma');
    if (!schema.includes('extensionId') || !schema.includes('model Voicemail')) {
      fail('6 No-answer → Voicemail', 'Voicemail.extensionId missing from schema');
    }
    const vmSrc = read('lib/voicemail.js');
    if (!vmSrc.includes('buildVoicemailClientStateFromSession')) {
      fail('6 No-answer → Voicemail', 'buildVoicemailClientStateFromSession not implemented');
    }
    if (!vmSrc.includes('extensionVoicemailWhereClause')) {
      fail('6 No-answer → Voicemail', 'extensionVoicemailWhereClause not implemented');
    }
    const ccVm = read('lib/inboundCallControl.js');
    if (!ccVm.includes('buildVoicemailClientStateFromSession')) {
      fail('6 No-answer → Voicemail', 'inboundCallControl not using buildVoicemailClientStateFromSession');
    }
    if (ext101) {
      const resolvedExtId = await resolveExtensionIdForVoicemail(prisma, tenant.id, {
        extensionId: ext101.id,
        to: 'ext:101',
      });
      if (resolvedExtId !== ext101.id) {
        fail('6 No-answer → Voicemail', 'resolveExtensionIdForVoicemail failed for ext:101');
      }
      const where = extensionVoicemailWhereClause(tenant.id, ext101.id, []);
      if (!where.OR?.some((clause) => clause.extensionId)) {
        fail('6 No-answer → Voicemail', 'extensionVoicemailWhereClause missing extensionId filter');
      }
    }
    if (ringGroup) {
      const rgVmState = buildVoicemailClientStateFromSession({
        tenantId: tenant.id,
        from: '+15551234567',
        to: pstnDid,
        ringGroupId: ringGroup.id,
        voicemailExtensionId: ringGroup.members.length === 1
          ? ringGroup.members[0].extensionId
          : null,
      });
      const rgVmParsed = JSON.parse(Buffer.from(rgVmState, 'base64').toString('utf8'));
      if (!rgVmParsed.ringGroupId) {
        fail('6 No-answer → Voicemail', 'Ring group voicemail client state missing ringGroupId');
      }
    }

    printResults();
    process.exit(failures.length === 0 ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

function printResults() {
  if (warnings.length > 0) {
    console.log('PBX PRODUCTION VALIDATION — WARNINGS\n');
    for (const item of warnings) {
      console.log(`[WARN] [${item.scenario}] ${item.message}`);
    }
    console.log('');
  }

  if (failures.length > 0) {
    console.log('PBX PRODUCTION VALIDATION — FAILURES\n');
    for (const item of failures) {
      console.log(`[FAIL] [${item.scenario}] ${item.message}`);
    }
    console.log(`\n${failures.length} failure(s), ${warnings.length} warning(s)`);
    return;
  }

  if (warnings.length === 0) {
    console.log('PBX PRODUCTION VALIDATION — PASS (no failures or warnings)');
  } else {
    console.log(`PBX PRODUCTION VALIDATION — PASS with ${warnings.length} warning(s)`);
  }
}

main().catch((error) => {
  fail('setup', error.message || String(error));
  printResults();
  process.exit(1);
});
