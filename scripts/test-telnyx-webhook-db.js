require('dotenv').config();

const { getPrisma } = require('../db');

async function simulateTelnyxWebhookDbPath() {
  const prisma = await getPrisma();

  const phoneRecord = await prisma.phoneNumber.findFirst({
    where: { isActive: true },
    include: { tenant: true },
  });

  if (!phoneRecord) {
    throw new Error('No active phone numbers found to simulate webhook routing.');
  }

  const tenant = phoneRecord.tenant;
  const greeting = tenant
    ? await prisma.greeting.findUnique({ where: { tenantId: tenant.id } })
    : null;

  console.log(JSON.stringify({
    ok: true,
    to: phoneRecord.number,
    tenantId: tenant?.id ?? null,
    tenantName: tenant?.name ?? null,
    greetingConfigured: Boolean(greeting),
  }, null, 2));
}

simulateTelnyxWebhookDbPath().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
