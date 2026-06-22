require('dotenv').config();
const { getPrisma } = require('../db');
const { syncSmsMessageStatuses } = require('../lib/sms');
const { getMessagingSetupStatus } = require('../lib/telnyxMessagingSetup');

async function main() {
  const prisma = await getPrisma();
  const numbers = await prisma.phoneNumber.findMany({ select: { number: true } });
  const setup = await getMessagingSetupStatus(prisma, numbers.map((item) => item.number));

  console.log('\n=== SMS messaging setup ===');
  console.log(JSON.stringify(setup, null, 2));

  const messages = await prisma.smsMessage.findMany({
    where: { direction: 'outbound' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log('\n=== Recent outbound messages (after Telnyx sync) ===');
  const synced = await syncSmsMessageStatuses(prisma, messages);
  for (const message of synced) {
    console.log(
      [
        message.createdAt.toISOString(),
        message.from,
        '->',
        message.to,
        `[${message.status}]`,
        message.deliveryError || '',
        message.body.slice(0, 40),
      ].join(' '),
    );
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
