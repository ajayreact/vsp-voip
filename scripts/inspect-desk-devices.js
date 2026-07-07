#!/usr/bin/env node
/**
 * Read-only inspection of V3DeskDevice rows for a given tenant, plus a
 * cross-tenant duplicate-MAC scan.
 *
 * Usage:
 *   docker compose exec -T api npx tsx scripts/inspect-desk-devices.js --tenant-id <uuid>
 *   docker compose exec -T api npx tsx scripts/inspect-desk-devices.js --mac <MAC>
 */
require('dotenv').config();
const { getPrisma } = require('../db');

function parseArgs() {
  const args = process.argv.slice(2);
  let tenantId = null;
  let mac = null;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--tenant-id') tenantId = args[i + 1] || null;
    if (args[i] === '--mac') mac = args[i + 1] || null;
  }
  return { tenantId, mac };
}

(async () => {
  const { tenantId, mac } = parseArgs();
  const prisma = await getPrisma();

  console.log('=== V3DeskDevice inspection ===\n');

  if (tenantId) {
    const devices = await prisma.v3DeskDevice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`--- Devices for tenant ${tenantId} (count=${devices.length}) ---`);
    console.log(JSON.stringify(devices, null, 2));
  }

  if (mac) {
    const normalized = String(mac).replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    const matches = await prisma.v3DeskDevice.findMany({
      where: { macAddress: normalized },
      include: { tenant: { select: { id: true, name: true } } },
    });
    console.log(`\n--- All rows matching MAC ${normalized} (count=${matches.length}) ---`);
    console.log(JSON.stringify(matches, null, 2));
    if (matches.length > 1) {
      console.log('\n*** DUPLICATE MAC ACROSS TENANTS DETECTED ***');
    }
  }

  console.log('\n--- Cross-tenant duplicate MAC scan (status != REMOVED) ---');
  const all = await prisma.v3DeskDevice.findMany({
    where: { status: { not: 'REMOVED' }, macAddress: { not: null } },
    select: { macAddress: true, tenantId: true, id: true, status: true, extensionId: true },
  });
  const byMac = new Map();
  for (const row of all) {
    if (!byMac.has(row.macAddress)) byMac.set(row.macAddress, []);
    byMac.get(row.macAddress).push(row);
  }
  const dupes = [...byMac.entries()].filter(([, rows]) => rows.length > 1);
  if (dupes.length === 0) {
    console.log('No duplicate MAC addresses found across tenants.');
  } else {
    for (const [macAddr, rows] of dupes) {
      console.log(`MAC ${macAddr} appears in ${rows.length} rows:`);
      console.log(JSON.stringify(rows, null, 2));
    }
  }

  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
