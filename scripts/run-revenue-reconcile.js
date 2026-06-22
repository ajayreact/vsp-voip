#!/usr/bin/env node
/**
 * Reconcile legacy bank orders and print report.
 * Usage: npm run revenue:reconcile [-- --dry-run]
 */
const { getPrisma } = require('../db');
const { reconcileLegacyRevenueRecords } = require('../lib/revenueReconcile');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const prisma = await getPrisma();
  const report = await reconcileLegacyRevenueRecords(prisma, { dryRun });
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
  process.exit(report.errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
