import 'dotenv/config';

async function main() {
  const { PrismaClient } = await import('../generated/prisma/client.js');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const ext = await prisma.extension.findFirst({
      where: { extensionNumber: '102', status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            telnyxSipUsername: true,
            telnyxCredentialId: true,
            softphoneOnlineAt: true,
            sipRegistered: true,
            sipRegistrationCheckedAt: true,
          },
        },
        tenant: { select: { id: true, name: true } },
      },
    });

    if (!ext) {
      console.log(JSON.stringify({ found: false, message: 'Extension 102 not found or inactive' }, null, 2));
      return;
    }

    const { resolveExtensionRingTargets } = await import('../lib/inboundRouting.js');
    const { loadCredentialConnectionId } = await import('../lib/telnyxSipProfile.js');
    const connId = await loadCredentialConnectionId(prisma);
    const resolution = await resolveExtensionRingTargets(prisma, ext, connId);

    console.log(JSON.stringify({
      tenant: ext.tenant?.name,
      assignedEmployee: ext.user
        ? { id: ext.user.id, name: ext.user.name, email: ext.user.email }
        : null,
      userTelnyxSipUsername: ext.user?.telnyxSipUsername ?? null,
      userSipRegistered: ext.user?.sipRegistered ?? null,
      userSoftphoneOnlineAt: ext.user?.softphoneOnlineAt?.toISOString?.() ?? null,
      extensionTelnyxSipUsername: ext.telnyxSipUsername ?? null,
      extensionSipRegistered: ext.sipRegistered ?? null,
      webrtcEnabled: ext.webrtcEnabled,
      sipEnabled: ext.sipEnabled,
      userId: ext.userId,
      ringTargets: resolution?.targets?.map((t) => ({
        type: t.type,
        label: t.label,
        dial: t.type === 'sip' ? t.sipUsername : t.user?.telnyxSipUsername,
      })),
      hasAppTarget: resolution?.targets?.some((t) => t.type === 'app') ?? false,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
