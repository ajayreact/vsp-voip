#!/usr/bin/env node
/**
 * One-time cleanup for legacy soft-deleted desk phone provisioning records.
 *
 * Background: V3DeskDevice previously "deleted" a device by setting
 * status='REMOVED' instead of actually deleting the row. Because
 * (tenantId, macAddress) is a DB-level unique constraint, those leftover
 * REMOVED rows silently blocked re-adding the same physical phone (the
 * "device cannot be recreated" symptom). deviceService.removeDevice() now
 * hard-deletes on every new delete, and deviceService.createDevice() self-heals
 * by purging a stale REMOVED row on next add — but any REMOVED rows already
 * sitting in production from before this fix should be cleaned up explicitly
 * so re-adding those exact MACs works immediately without waiting on an
 * "Add Device" attempt to trigger the self-heal path.
 *
 * Dry-run by default. Pass --apply to actually delete.
 *
 * Usage:
 *   node scripts/cleanup-removed-desk-devices.js
 *   node scripts/cleanup-removed-desk-devices.js --apply
 *   node scripts/cleanup-removed-desk-devices.js --apply --tenant-id=<uuid>
 */
require('dotenv').config();

const { getPrisma, disconnectPrisma } = require('../db');

function argValue(flag) {
  const withEquals = process.argv.find((a) => a.startsWith(`--${flag}=`));
  if (withEquals) return withEquals.split('=').slice(1).join('=');
  return null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const tenantId = argValue('tenant-id');

  const prisma = await getPrisma();
  const where = { status: 'REMOVED', ...(tenantId ? { tenantId } : {}) };
  const stale = await prisma.v3DeskDevice.findMany({ where });

  if (!stale.length) {
    console.log('No REMOVED desk device rows found. Nothing to clean up.');
    return;
  }

  console.log(`Found ${stale.length} REMOVED desk device row(s)${tenantId ? ` for tenant ${tenantId}` : ''}:`);
  for (const d of stale) {
    console.log(`  - id=${d.id} tenantId=${d.tenantId} vendor=${d.vendor} mac=${d.macAddress || 'n/a'} removedAt=${d.removedAt?.toISOString?.() || 'n/a'}`);
  }

  if (!apply) {
    console.log('\nDry run only — no changes made. Re-run with --apply to delete these rows.');
    return;
  }

  let deleted = 0;
  for (const d of stale) {
    await prisma.v3RuntimeLink.deleteMany({ where: { tenantId: d.tenantId, v3EntityType: 'device', v3EntityId: d.id } });
    await prisma.v3DeskDevice.delete({ where: { id: d.id } });
    deleted += 1;
  }
  console.log(`\nDeleted ${deleted} REMOVED desk device row(s). Affected MAC addresses can now be re-added.`);
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectPrisma());
