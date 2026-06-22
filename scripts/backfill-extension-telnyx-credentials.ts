import 'dotenv/config';

type Args = {
  tenantId: string | null;
  allTenants: boolean;
  dryRun: boolean;
  force: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let tenantId: string | null = null;
  let allTenants = false;
  let dryRun = false;
  let force = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--all-tenants') allTenants = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--force') force = true;
    else if (arg === '--tenant-id') tenantId = args[i + 1] || null;
  }

  return { tenantId, allTenants, dryRun, force };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { tenantId, allTenants, dryRun, force } = parseArgs();

  if (!tenantId && !allTenants) {
    console.error('Usage: npx tsx scripts/backfill-extension-telnyx-credentials.ts --tenant-id <uuid>');
    console.error('   or: npx tsx scripts/backfill-extension-telnyx-credentials.ts --all-tenants');
    console.error('Options: --dry-run  --force (recreate existing credentials)');
    process.exit(1);
  }

  const { PrismaClient } = await import('../generated/prisma/client.js');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { ensureExtensionTelnyxCredential } = await import('../lib/extensionSip.js');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const extensions = await prisma.extension.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: 'ACTIVE',
        sipEnabled: true,
      },
      orderBy: [{ tenantId: 'asc' }, { extensionNumber: 'asc' }],
    });

    console.log(`=== Extension Telnyx credential backfill ===`);
    console.log(`Extensions matched: ${extensions.length}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}${force ? ' (force recreate)' : ''}\n`);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const extension of extensions) {
      const label = `Ext ${extension.extensionNumber} (${extension.id.slice(0, 8)}…)`;

      if (extension.telnyxCredentialId && extension.telnyxSipUsername && !force) {
        console.log(`SKIP  ${label} — already has Telnyx credential ${extension.telnyxSipUsername}`);
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`PLAN  ${label} — would ${force ? 'recreate' : 'create'} Telnyx desk credential`);
        created += 1;
        continue;
      }

      try {
        const updated = await ensureExtensionTelnyxCredential(prisma, extension, { forceRecreate: force });
        console.log(`OK    ${label} → ${updated?.telnyxSipUsername || '—'}`);
        created += 1;
        await sleep(300);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`FAIL  ${label} — ${message}`);
        failed += 1;
      }
    }

    console.log('\n=== Summary ===');
    console.log(JSON.stringify({ total: extensions.length, created, skipped, failed }, null, 2));

    if (failed > 0) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
