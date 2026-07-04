#!/usr/bin/env node
/**
 * Deterministic Telnyx production configuration verifier — expected vs actual API.
 *
 * Usage:
 *   npx tsx scripts/verify-telnyx-production-config.js --tenant-id=<uuid>
 *   npx tsx scripts/verify-telnyx-production-config.js --tenant-id=<uuid> --extensions=100,101
 *   npx tsx scripts/verify-telnyx-production-config.js --tenant-id=<uuid> --json
 *   npx tsx scripts/verify-telnyx-production-config.js --tenant-id=<uuid> --fix
 *   npx tsx scripts/verify-telnyx-production-config.js --tenant-id=<uuid> --support-report
 *
 * EC2:
 *   docker compose exec -T api npx tsx scripts/verify-telnyx-production-config.js \
 *     --tenant-id=8bbcdbdf-6377-44a0-bd84-ac6a34d5de96 --extensions=100,101
 */
require('dotenv').config();

const { PrismaClient } = require('../generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const {
  verifyTelnyxProductionConfig,
  formatVerificationReport,
  formatTelnyxSupportReport,
  applyAutoFixes,
} = require('../lib/telnyxConfigVerification');

function parseArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function createPrisma() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

async function main() {
  const tenantId = parseArg('tenant-id') || process.env.V3_PILOT_TENANT_ID?.trim() || null;
  const extArg = parseArg('extensions');
  const extensionNumbers = extArg ? extArg.split(',').map((s) => s.trim()).filter(Boolean) : ['100', '101'];
  const asJson = process.argv.includes('--json');
  const doFix = process.argv.includes('--fix');
  const supportReport = process.argv.includes('--support-report');

  if (!tenantId) {
    console.error('Required: --tenant-id=<uuid> (or V3_PILOT_TENANT_ID in env)');
    process.exit(2);
  }

  const prisma = createPrisma();

  try {
    if (doFix) {
      console.log('Applying auto-fixes via Telnyx API...\n');
      const fixResult = await applyAutoFixes(prisma);
      console.log(JSON.stringify(fixResult, null, 2));
      console.log('\nRe-running verification after fix...\n');
    }

    const report = await verifyTelnyxProductionConfig(prisma, { tenantId, extensionNumbers });

    if (supportReport) {
      if (!report.telnyxSupportEligible) {
        console.error('Support report blocked: configuration mismatches exist or traffic observed.');
        console.error(`Failed checks: ${report.summary.failed}`);
        if (asJson) console.log(JSON.stringify(report, null, 2));
        else console.log(formatVerificationReport(report));
        process.exit(1);
      }
      console.log(formatTelnyxSupportReport(report));
      process.exit(0);
    }

    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatVerificationReport(report));
    }

    process.exit(report.summary.failed > 0 ? 1 : 0);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(2);
});
