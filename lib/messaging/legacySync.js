const { mapChannelStatus } = require('./mappers');

function legacyDirection(direction) {
  return direction === 'OUTBOUND' ? 'outbound' : 'inbound';
}

function legacyStatus(status) {
  return String(status || 'received').toLowerCase();
}

async function syncLegacySmsFromMessage(prisma, message) {
  if (!message?.id) return null;

  const data = {
    tenantId: message.tenantId,
    telnyxMessageId: message.telnyxMessageId,
    from: message.from,
    to: message.to,
    body: message.body || '',
    direction: legacyDirection(message.direction),
    status: legacyStatus(message.status),
    deliveryError: message.deliveryError || null,
    isRead: Boolean(message.readAt || message.direction === 'OUTBOUND'),
    messageId: message.id,
  };

  const existing = message.legacySms
    || (message.telnyxMessageId
      ? await prisma.smsMessage.findUnique({ where: { telnyxMessageId: message.telnyxMessageId } })
      : null)
    || (await prisma.smsMessage.findUnique({ where: { messageId: message.id } }));

  if (existing) {
    return prisma.smsMessage.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.smsMessage.create({ data });
}

async function applyLegacyStatusToMessage(prisma, telnyxMessageId, status, deliveryError) {
  const channelStatus = mapChannelStatus(status);
  const legacy = await prisma.smsMessage.findUnique({ where: { telnyxMessageId } });
  if (!legacy?.messageId) return null;

  const update = { status: legacyStatus(channelStatus || status) };
  if (deliveryError) update.deliveryError = deliveryError;

  await prisma.smsMessage.update({
    where: { id: legacy.id },
    data: update,
  });

  return prisma.message.update({
    where: { id: legacy.messageId },
    data: {
      status: channelStatus || undefined,
      deliveryError: deliveryError || undefined,
      deliveredAt: channelStatus === 'DELIVERED' ? new Date() : undefined,
    },
  });
}

module.exports = {
  syncLegacySmsFromMessage,
  applyLegacyStatusToMessage,
  legacyDirection,
  legacyStatus,
};
