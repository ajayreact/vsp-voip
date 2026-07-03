#!/usr/bin/env node
/**
 * Production Telnyx audit, auto-fix, and support report.
 *
 * Usage:
 *   npx tsx scripts/production-telnyx-audit-fix.js --audit
 *   npx tsx scripts/production-telnyx-audit-fix.js --fix
 *   npx tsx scripts/production-telnyx-audit-fix.js --fix --force-number-resync
 *   npx tsx scripts/production-telnyx-audit-fix.js --support-report --tenant-id=8bbcdbdf-6377-44a0-bd84-ac6a34d5de96
 *   npx tsx scripts/production-telnyx-audit-fix.js --enable-v3-flags --tenant-id=8bbcdbdf-6377-44a0-bd84-ac6a34d5de96
 *
 * EC2:
 *   docker compose exec -T api npx tsx scripts/production-telnyx-audit-fix.js --fix --tenant-id=8bbcdbdf-6377-44a0-bd84-ac6a34d5de96
 */
require('dotenv').config();

const { PrismaClient } = require('../generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const featureFlags = require('../lib/telephony-v3/FeatureFlags/featureFlagService');
const {
  auditTelnyxProduction,
  fixTelnyxProduction,
  formatSupportReport,
} = require('../lib/telnyxProductionSetup');

const PILOT_PATCH = {
  engineEnabled: true,
  deskEnabled: true,
  pstnEnabled: true,
  mobileEnabled: true,
  observeOnly: false,
};

function parseArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function createPrisma() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

async function enableV3Flags(prisma, tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  await featureFlags.upsertTenantFlags(tenantId, PILOT_PATCH);
  const flags = await featureFlags.getTenantFlags(tenantId);
  return { tenant, flags };
}

async function main() {
  const doAudit = process.argv.includes('--audit') || (!process.argv.includes('--fix') && !process.argv.includes('--support-report') && !process.argv.includes('--enable-v3-flags'));
  const doFix = process.argv.includes('--fix');
  const doReport = process.argv.includes('--support-report');
  const doFlags = process.argv.includes('--enable-v3-flags');
  const forceResync = process.argv.includes('--force-number-resync');
  const tenantId = parseArg('tenant-id') || process.env.V3_PILOT_TENANT_ID?.trim() || null;

  const prisma = createPrisma();

  try {
    if (doFlags) {
      if (!tenantId) throw new Error('--enable-v3-flags requires --tenant-id');
      const result = await enableV3Flags(prisma, tenantId);
      console.log('V3FeatureFlag enabled for', result.tenant.name, result.tenant.id);
      console.log(JSON.stringify(result.flags, null, 2));
    }

    if (doFix) {
      console.log('=== Applying Telnyx production fixes ===\n');
      const fixResult = await fixTelnyxProduction(prisma, { forceNumberResync: forceResync });
      console.log(JSON.stringify(fixResult, null, 2));
      console.log('\nRestart API + worker after fix: docker compose restart api telephony-v3-worker');
    }

    let audit = null;
    if (doAudit || doReport) {
      console.log('=== Telnyx production audit ===\n');
      audit = await auditTelnyxProduction(prisma, { tenantId });
      console.log(JSON.stringify(audit, null, 2));

      if (audit.issues.length) {
        console.log('\n=== ISSUES ===');
        for (const issue of audit.issues) console.log(`  - ${issue}`);
      } else {
        console.log('\nNo config issues detected in audit.');
      }

      if (audit.pstnNotFoundLikelyCarrier) {
        console.log('\n⚠️  Numbers are active on Call Control but zero inbound CDRs.');
        console.log('   PSTN "Not Found" is likely Telnyx carrier/LRN provisioning — open support ticket.');
        console.log('   Run with --support-report to generate ticket text.');
      }
    }

    if (doReport && audit) {
      console.log('\n' + formatSupportReport(audit));
    }

    if (doAudit && audit && auditHasBlockingIssues(audit) && !doFix) {
      console.log('\nRun with --fix to apply safe Telnyx API corrections.');
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

function auditHasBlockingIssues(audit) {
  const fixable = audit.issues.filter((i) => !i.includes('zero CDRs') && !i.includes('carrier'));
  return fixable.length > 0;
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
