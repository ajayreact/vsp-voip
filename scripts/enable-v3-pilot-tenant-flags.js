#!/usr/bin/env node
/**
 * Enable V3 telephony feature flags for a single pilot tenant (production canary).
 *
 * Usage:
 *   npx tsx scripts/enable-v3-pilot-tenant-flags.js --tenant-id=<uuid>
 *   npx tsx scripts/enable-v3-pilot-tenant-flags.js --tenant-name=Acme
 *   npx tsx scripts/enable-v3-pilot-tenant-flags.js --extension=100
 *
 * On EC2 (use tsx — plain node cannot load generated Prisma client):
 *   docker compose exec -T api npx tsx scripts/enable-v3-pilot-tenant-flags.js --extension=100
 */
require('dotenv').config();

const { PrismaClient } = require('../generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const featureFlags = require('../lib/telephony-v3/FeatureFlags/featureFlagService');

function createPrisma() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

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

async function resolveTenantId(prisma) {
  const tenantId = parseArg('tenant-id') || process.env.V3_PILOT_TENANT_ID?.trim();
  if (tenantId) {
    const row = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
    if (!row) throw new Error(`Tenant not found for id ${tenantId}`);
    return row;
  }

  const extensionNumber = parseArg('extension');
  if (extensionNumber) {
    const ext = await prisma.extension.findFirst({
      where: { extensionNumber: String(extensionNumber), status: 'ACTIVE' },
      select: { tenantId: true, extensionNumber: true, tenant: { select: { id: true, name: true } } },
    });
    if (!ext?.tenant) {
      throw new Error(`No ACTIVE extension ${extensionNumber} found`);
    }
    return { id: ext.tenant.id, name: ext.tenant.name, viaExtension: ext.extensionNumber };
  }

  const tenantName = parseArg('tenant-name');
  if (tenantName) {
    const row = await prisma.tenant.findFirst({
      where: { name: { contains: tenantName, mode: 'insensitive' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    if (!row) {
      await listTenantsHint(prisma, tenantName);
      throw new Error(`Tenant not found matching name "${tenantName}"`);
    }
    return row;
  }

  await listTenantsHint(prisma);
  throw new Error('Provide --tenant-id, --tenant-name, or --extension (e.g. --extension=100)');
}

async function listTenantsHint(prisma, attemptedName = null) {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: { name: 'asc' },
    take: 20,
  });
  console.error('\nAvailable tenants (first 20):');
  for (const t of tenants) {
    console.error(`  - ${t.name} (${t.id}) active=${t.isActive !== false}`);
  }
  if (attemptedName) {
    console.error(`\nNo match for "${attemptedName}". Try --extension=100 or --tenant-id=<uuid> from above.`);
  } else {
    console.error('\nExample: npx tsx scripts/enable-v3-pilot-tenant-flags.js --extension=100');
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const checkOnly = process.argv.includes('--check-only');
  const prisma = createPrisma();

  try {
    const tenant = await resolveTenantId(prisma);

    const before = await prisma.v3FeatureFlag.findUnique({ where: { tenantId: tenant.id } });

    console.log('=== V3 pilot tenant feature flags ===');
    console.log('Tenant:', tenant.name, tenant.id, tenant.viaExtension ? `(via ext ${tenant.viaExtension})` : '');
    console.log('Check only:', checkOnly);
    console.log('Dry run:', dryRun);
    console.log('\nCurrent flags:', before || '(no V3FeatureFlag row — defaults apply: all false)');

    if (checkOnly) {
      return;
    }

    if (dryRun) {
      console.log('\nWould apply:', PILOT_PATCH);
      return;
    }

    const row = await featureFlags.upsertTenantFlags(tenant.id, PILOT_PATCH);
    await featureFlags.invalidateFlags(tenant.id);

    console.log('\nAfter:', row);
    console.log('\nPilot tenant V3 flags enabled. Restart api + telephony-v3-worker if calls fail immediately.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
