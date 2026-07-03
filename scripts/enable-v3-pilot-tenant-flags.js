#!/usr/bin/env node
/**
 * Enable V3 telephony feature flags for a single pilot tenant (production canary).
 *
 * Usage:
 *   node scripts/enable-v3-pilot-tenant-flags.js --tenant-id=<uuid>
 *   node scripts/enable-v3-pilot-tenant-flags.js --tenant-name=vspinternal
 *   node scripts/enable-v3-pilot-tenant-flags.js --tenant-name=vspinternal --dry-run
 *
 * On EC2:
 *   docker compose exec -T api node scripts/enable-v3-pilot-tenant-flags.js --tenant-name=vspinternal
 */
require('dotenv').config();

const { getPrisma } = require('../db');
const featureFlags = require('../lib/telephony-v3/FeatureFlags/featureFlagService');

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

  const tenantName = parseArg('tenant-name') || 'vspinternal';
  const row = await prisma.tenant.findFirst({
    where: { name: { contains: tenantName, mode: 'insensitive' } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  if (!row) throw new Error(`Tenant not found matching name "${tenantName}"`);
  return row;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const checkOnly = process.argv.includes('--check-only');
  const prisma = await getPrisma();
  const tenant = await resolveTenantId(prisma);

  const before = await prisma.v3FeatureFlag.findUnique({ where: { tenantId: tenant.id } });

  console.log('=== V3 pilot tenant feature flags ===');
  console.log('Tenant:', tenant.name, tenant.id);
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
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    try {
      const prisma = await getPrisma();
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  });
