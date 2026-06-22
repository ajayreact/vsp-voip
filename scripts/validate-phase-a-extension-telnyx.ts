import 'dotenv/config';

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

async function main() {
  const { PrismaClient } = await import('../generated/prisma/client.js');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { ensureExtensionTelnyxCredential, buildExtensionSipProfile } = await import('../lib/extensionSip.js');
  const { loadTelnyxConnectionContext } = await import('../lib/telnyxSipProfile.js');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const results: CheckResult[] = [];

  try {
    // 1. Schema columns exist
    const sample = await prisma.extension.findFirst({
      select: {
        id: true,
        telnyxCredentialId: true,
        telnyxSipUsername: true,
        telnyxSipPassword: true,
        sipRegistered: true,
        sipRegistrationCheckedAt: true,
        sipRegistrationSource: true,
      },
    });
    results.push({
      name: 'schema.extension_telnyx_columns',
      ok: sample !== undefined,
      detail: sample !== undefined ? 'Extension Telnyx columns readable' : 'No extensions in database',
    });

    const connectionContext = await loadTelnyxConnectionContext(prisma);
    results.push({
      name: 'telnyx.credential_connection',
      ok: Boolean(connectionContext.credentialConnectionId),
      detail: connectionContext.credentialConnectionId
        ? `connectionId=${connectionContext.credentialConnectionId}`
        : 'TELNYX_CREDENTIAL_CONNECTION_ID not configured',
    });

    const extensions = await prisma.extension.findMany({
      where: { status: 'ACTIVE', sipEnabled: true },
      include: { user: { select: { id: true, telnyxSipUsername: true, telnyxCredentialId: true } } },
      orderBy: { extensionNumber: 'asc' },
    });

    let withTelnyx = 0;
    let missingTelnyx = 0;
    let deskRegistered = 0;

    console.log('=== Phase A validation: Extension Telnyx credentials ===\n');

    for (const extension of extensions) {
      const hasTelnyx = Boolean(extension.telnyxCredentialId && extension.telnyxSipUsername);
      if (hasTelnyx) withTelnyx += 1;
      else missingTelnyx += 1;
      if (extension.sipRegistered) deskRegistered += 1;

      const profile = buildExtensionSipProfile(extension, connectionContext);
      const userCredSeparate = extension.user?.telnyxSipUsername
        && extension.telnyxSipUsername
        && extension.user.telnyxSipUsername !== extension.telnyxSipUsername;

      console.log(`Extension ${extension.extensionNumber} — ${extension.displayName}`);
      console.log(`  telnyxCredentialId: ${extension.telnyxCredentialId || '— MISSING —'}`);
      console.log(`  telnyxSipUsername:  ${extension.telnyxSipUsername || '— MISSING —'}`);
      console.log(`  telnyxSipPassword:  ${extension.telnyxSipPassword ? '(set)' : '—'}`);
      console.log(`  deskRegistered:     ${extension.sipRegistered === true ? 'YES' : 'no'}`);
      console.log(`  SIP profile user:   ${profile.sipUsername || '—'}`);
      console.log(`  Employee app cred:  ${extension.user?.telnyxSipUsername || '— (none)'}`);
      console.log(`  Credentials split:  ${userCredSeparate ? 'YES (desk ≠ app)' : extension.user ? 'check' : 'n/a'}`);
      console.log('');
    }

    results.push({
      name: 'extensions.with_telnyx_credential',
      ok: missingTelnyx === 0 || extensions.length === 0,
      detail: `${withTelnyx}/${extensions.length} active sip-enabled extensions have Telnyx desk credentials`,
    });

    results.push({
      name: 'extensions.desk_registration_tracking',
      ok: true,
      detail: `${deskRegistered}/${extensions.length} extensions report sipRegistered=true`,
    });

    // Lazy provisioning smoke test (dry) on first extension missing cred
    const needsCred = extensions.find((e) => !e.telnyxCredentialId);
    if (needsCred && connectionContext.credentialConnectionId && process.env.PHASE_A_PROVISION_TEST === '1') {
      try {
        const updated = await ensureExtensionTelnyxCredential(prisma, needsCred);
        results.push({
          name: 'provision.smoke_test',
          ok: Boolean(updated?.telnyxCredentialId),
          detail: `Provisioned ${needsCred.extensionNumber} → ${updated?.telnyxSipUsername}`,
        });
      } catch (error) {
        results.push({
          name: 'provision.smoke_test',
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log('=== Checklist ===');
    let allOk = true;
    for (const row of results) {
      const mark = row.ok ? 'PASS' : 'FAIL';
      if (!row.ok) allOk = false;
      console.log(`${mark}  ${row.name} — ${row.detail}`);
    }

    if (missingTelnyx > 0) {
      console.log('\nHint: run backfill');
      console.log('  npx tsx scripts/backfill-extension-telnyx-credentials.ts --all-tenants');
    }

    process.exit(allOk && missingTelnyx === 0 ? 0 : missingTelnyx > 0 ? 2 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
