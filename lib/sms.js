const {
  getMessagingProfileId,
  getSmsWebhookUrl,
  isSmsWebhookReachable,
} = require('./messaging/telnyxProfile');
const {
  buildLegacyConversationsFromMessages,
  markConversationRead,
  listConversations,
  getConversationById,
  getConversationMessages,
  resolveConversationParties,
  findOrCreateConversation,
} = require('./messaging/ConversationService');
const {
  sendMessage,
  syncMessageStatuses,
  saveInboundFromWebhook,
  updateOutboundFromWebhook,
} = require('./messaging/MessagingService');
const { handleTelnyxMessagingEvent } = require('./messaging/WebhookService');
const { mapLegacySmsMessage } = require('./messaging/mappers');
const { legacyStatus } = require('./messaging/legacySync');

const PENDING_SMS_STATUSES = new Set(['queued', 'sending', 'sent']);

function isPendingSmsStatus(status) {
  return PENDING_SMS_STATUSES.has(String(status || '').toLowerCase());
}

function conversationKey(peer, line) {
  return `${line}|${peer}`;
}

function mapSmsMessage(message) {
  if (message.direction === 'inbound' || message.direction === 'outbound') {
    return {
      id: message.id,
      tenantId: message.tenantId,
      telnyxMessageId: message.telnyxMessageId,
      from: message.from,
      to: message.to,
      body: message.body,
      direction: message.direction,
      status: message.status,
      deliveryError: message.deliveryError || null,
      isRead: message.isRead,
      createdAt: message.createdAt,
    };
  }
  return mapLegacySmsMessage({ ...message, legacySms: message.legacySms });
}

async function buildConversations(prisma, tenantId, tenantNumbers) {
  const hasConversations = await prisma.conversation.count({ where: { tenantId } });
  if (hasConversations > 0) {
    return buildLegacyConversationsFromMessages(prisma, tenantId);
  }

  const messages = await prisma.smsMessage.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const conversations = new Map();
  for (const message of messages) {
    const parties = resolveConversationParties(message.from, message.to, tenantNumbers);
    if (!parties) continue;

    const key = conversationKey(parties.peer, parties.line);
    const existing = conversations.get(key);
    if (existing) {
      if (message.direction === 'inbound' && !message.isRead) {
        existing.unreadCount += 1;
      }
      continue;
    }

    conversations.set(key, {
      peer: parties.peer,
      line: parties.line,
      lastMessage: mapSmsMessage(message),
      unreadCount: message.direction === 'inbound' && !message.isRead ? 1 : 0,
    });
  }

  return Array.from(conversations.values()).sort(
    (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime(),
  );
}

async function saveInboundSmsFromEvent(prisma, payload) {
  const result = await handleTelnyxMessagingEvent(prisma, {
    data: { event_type: 'message.received', payload },
  });
  if (!result) return null;

  const legacy = await prisma.smsMessage.findFirst({
    where: { messageId: result.id },
  });
  if (legacy) return legacy;

  return prisma.smsMessage.findFirst({ where: { telnyxMessageId: result.telnyxMessageId } });
}

async function upsertOutboundSmsStatus(prisma, payload) {
  const updated = await updateOutboundFromWebhook(prisma, payload);
  if (!updated) return null;

  return prisma.smsMessage.findFirst({
    where: { messageId: updated.id },
  });
}

async function syncSmsMessageStatuses(prisma, messages) {
  const messageIds = messages.map((item) => item.messageId).filter(Boolean);
  if (messageIds.length) {
    const platformMessages = await prisma.message.findMany({
      where: { id: { in: messageIds } },
      include: { attachments: true, legacySms: true },
    });
    const synced = await syncMessageStatuses(prisma, platformMessages);
    const syncedById = new Map(synced.map((item) => [item.id, item]));
    return messages.map((legacy) => {
      const platform = legacy.messageId ? syncedById.get(legacy.messageId) : null;
      if (platform?.legacySms) return platform.legacySms;
      if (platform) {
        return {
          ...legacy,
          status: legacyStatus(platform.status),
          deliveryError: platform.deliveryError,
        };
      }
      return legacy;
    });
  }

  return messages;
}

async function sendSmsMessage({
  prisma,
  platform,
  tenantId,
  from,
  to,
  text,
  userId,
}) {
  const sent = await sendMessage({
    prisma,
    platform,
    tenantId,
    userId,
    from,
    to,
    text,
  });

  const legacy = await prisma.smsMessage.findFirst({
    where: { messageId: sent.id },
  });
  if (legacy) return legacy;

  return {
    id: sent.id,
    tenantId: sent.tenantId,
    telnyxMessageId: sent.telnyxMessageId,
    from: sent.from,
    to: sent.to,
    body: sent.body || '',
    direction: 'outbound',
    status: legacyStatus(sent.status),
    deliveryError: sent.deliveryError,
    isRead: true,
    createdAt: sent.createdAt,
  };
}

async function handleTelnyxSmsEvent(prisma, body) {
  const result = await handleTelnyxMessagingEvent(prisma, body);
  if (!result) return null;

  if (result.direction === 'INBOUND' || result.direction === 'OUTBOUND') {
    const legacy = await prisma.smsMessage.findFirst({
      where: { OR: [{ messageId: result.id }, { telnyxMessageId: result.telnyxMessageId || undefined }] },
    });
    if (legacy) return legacy;
  }

  return result;
}

module.exports = {
  getMessagingProfileId,
  getSmsWebhookUrl,
  isSmsWebhookReachable,
  isPendingSmsStatus,
  mapSmsMessage,
  buildConversations,
  resolveConversationParties,
  conversationKey,
  saveInboundSmsFromEvent,
  upsertOutboundSmsStatus,
  syncSmsMessageStatuses,
  sendSmsMessage,
  handleTelnyxSmsEvent,
  findOrCreateConversation,
  listConversations,
  getConversationById,
  getConversationMessages,
  markConversationRead,
};
