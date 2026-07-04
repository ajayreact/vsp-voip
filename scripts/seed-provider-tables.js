/**
 * Backfill script for the multi-provider telephony architecture (Phase 4).
 *
 * Idempotent and safe to re-run:
 *  - Upserts the `telnyx` Provider row (also inserted by the migration's
 *    seed statement; this is a defensive no-op if it already exists).
 *  - Inserts one `TenantProvider` row per existing tenant that does not
 *    already have one, pointing at the `telnyx` provider with
 *    isPrimary = true. This is what makes `ProviderResolver.resolve()`
 *    behavior-neutral (== Telnyx) for every tenant that existed before
 *    this initiative shipped.
 *
 * Usage: node scripts/seed-provider-tables.js
 */

const { getPrisma, disconnectPrisma } = require('../db');

const TELNYX_PROVIDER_KEY = 'telnyx';
const TELNYX_CAPABILITIES = {
  voice: true,
  sip: true,
  numbers: true,
  recording: true,
  ivr: true,
  queue: true,
  ringGroups: true,
  conference: true,
  messaging: true,
};

async function ensureTelnyxProvider(prisma) {
  const provider = await prisma.provider.upsert({
    where: { key: TELNYX_PROVIDER_KEY },
    update: {},
    create: {
      id: TELNYX_PROVIDER_KEY,
      key: TELNYX_PROVIDER_KEY,
      displayName: 'Telnyx',
      isActive: true,
      capabilities: TELNYX_CAPABILITIES,
    },
  });
  return provider;
}

async function backfillTenantProviders(prisma, provider) {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  let created = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    const existing = await prisma.tenantProvider.findUnique({
      where: { tenantId_providerId: { tenantId: tenant.id, providerId: provider.id } },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const hasAnyProvider = await prisma.tenantProvider.findFirst({
      where: { tenantId: tenant.id },
    });

    await prisma.tenantProvider.create({
      data: {
        tenantId: tenant.id,
        providerId: provider.id,
        isPrimary: !hasAnyProvider,
        isActive: true,
      },
    });
    created += 1;
  }

  return { total: tenants.length, created, skipped };
}

async function main() {
  const prisma = await getPrisma();

  console.log('[seed-provider-tables] Ensuring telnyx Provider row exists...');
  const provider = await ensureTelnyxProvider(prisma);
  console.log(`[seed-provider-tables] Provider ready: id=${provider.id} key=${provider.key}`);

  console.log('[seed-provider-tables] Backfilling TenantProvider rows for existing tenants...');
  const result = await backfillTenantProviders(prisma, provider);
  console.log(
    `[seed-provider-tables] Done. tenants=${result.total} created=${result.created} already-existed=${result.skipped}`,
  );
}

main()
  .catch((error) => {
    console.error('[seed-provider-tables] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
