/**
 * Backfill Conversation + Message rows from legacy SmsMessage records.
 * Run: npx tsx scripts/backfill-messaging-from-sms.js
 */
require('dotenv').config();
const { getPrisma } = require('../db');
const { findOrCreateConversation, updateConversationPreview } = require('../lib/messaging/ConversationService');
const { syncLegacySmsFromMessage } = require('../lib/messaging/legacySync');
const { mapChannelStatus } = require('../lib/messaging/mappers');

function toDirection(value) {
  return String(value).toLowerCase() === 'outbound' ? 'OUTBOUND' : 'INBOUND';
}

function toStatus(value) {
  return mapChannelStatus(value) || 'RECEIVED';
}

async function main() {
  const prisma = await getPrisma();
  const tenantNumbers = await prisma.phoneNumber.findMany({
    select: { tenantId: true, number: true },
  });
  const numbersByTenant = tenantNumbers.reduce((acc, row) => {
    if (!acc[row.tenantId]) acc[row.tenantId] = [];
    acc[row.tenantId].push(row.number);
    return acc;
  }, {});

  const legacyMessages = await prisma.smsMessage.findMany({
    where: { messageId: null },
    orderBy: { createdAt: 'asc' },
  });

  let created = 0;
  for (const legacy of legacyMessages) {
    const tenantNumberList = numbersByTenant[legacy.tenantId] || [];
    const numberSet = new Set(tenantNumberList);
    const from = legacy.from;
    const to = legacy.to;

    let peer;
    let line;
    if (numberSet.has(to)) {
      peer = from;
      line = to;
    } else if (numberSet.has(from)) {
      peer = to;
      line = from;
    } else {
      continue;
    }

    const conversation = await findOrCreateConversation(prisma, {
      tenantId: legacy.tenantId,
      peer,
      line,
    });

    const telnyxMessageId = legacy.telnyxMessageId || undefined;
    if (telnyxMessageId) {
      const existing = await prisma.message.findUnique({ where: { telnyxMessageId } });
      if (existing) {
        await prisma.smsMessage.update({
          where: { id: legacy.id },
          data: { messageId: existing.id },
        });
        continue;
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        tenantId: legacy.tenantId,
        telnyxMessageId,
        from: legacy.from,
        to: legacy.to,
        body: legacy.body,
        direction: toDirection(legacy.direction),
        messageType: 'SMS',
        status: toStatus(legacy.status),
        deliveryError: legacy.deliveryError,
        readAt: legacy.isRead || legacy.direction === 'outbound' ? legacy.createdAt : null,
        createdAt: legacy.createdAt,
      },
    });

    await prisma.messageStatus.create({
      data: {
        messageId: message.id,
        status: message.status,
        source: 'backfill',
      },
    });

    await prisma.smsMessage.update({
      where: { id: legacy.id },
      data: { messageId: message.id },
    });

    await updateConversationPreview(prisma, conversation.id, message);
    await syncLegacySmsFromMessage(prisma, { ...message, legacySms: legacy });
    created += 1;
  }

  console.log(`Backfill complete. Created ${created} messages from ${legacyMessages.length} legacy rows.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
