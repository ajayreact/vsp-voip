const { normalizePhoneNumber } = require('../phone');
const { mapConversationRecord, mapMessageRecord } = require('./mappers');

function resolveConversationParties(from, to, tenantNumbers) {
  const numberSet = new Set(tenantNumbers.map((n) => normalizePhoneNumber(n)).filter(Boolean));
  const normalizedFrom = normalizePhoneNumber(from);
  const normalizedTo = normalizePhoneNumber(to);
  if (!normalizedFrom || !normalizedTo) return null;

  if (numberSet.has(normalizedTo)) return { peer: normalizedFrom, line: normalizedTo };
  if (numberSet.has(normalizedFrom)) return { peer: normalizedTo, line: normalizedFrom };
  return null;
}

async function findOrCreateConversation(prisma, { tenantId, peer, line, type = 'CUSTOMER' }) {
  const normalizedPeer = normalizePhoneNumber(peer);
  const normalizedLine = normalizePhoneNumber(line);
  if (!normalizedPeer || !normalizedLine) {
    throw Object.assign(new Error('Invalid peer or line phone number'), { status: 400 });
  }

  return prisma.conversation.upsert({
    where: {
      tenantId_peer_line: {
        tenantId,
        peer: normalizedPeer,
        line: normalizedLine,
      },
    },
    create: {
      tenantId,
      peer: normalizedPeer,
      line: normalizedLine,
      type,
    },
    update: {},
  });
}

async function ensureParticipant(prisma, conversationId, userId) {
  return prisma.conversationParticipant.upsert({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    create: {
      conversationId,
      userId,
      role: 'agent',
    },
    update: {},
  });
}

async function updateConversationPreview(prisma, conversationId, message) {
  const preview = (message.body || '').slice(0, 160) || (message.messageType === 'MMS' ? '[MMS]' : '');
  return prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: message.createdAt || new Date(),
      lastMessagePreview: preview,
    },
  });
}

async function listConversations(prisma, tenantId, userId, options = {}) {
  const limit = Math.min(Number(options.limit) || 50, 200);
  const cursor = options.cursor || null;

  const where = { tenantId };
  if (cursor) {
    const cursorConv = await prisma.conversation.findFirst({
      where: { id: cursor, tenantId },
      select: { lastMessageAt: true },
    });
    if (cursorConv?.lastMessageAt) {
      where.lastMessageAt = { lt: cursorConv.lastMessageAt };
    }
  }

  const conversations = await prisma.conversation.findMany({
    where,
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { attachments: true },
      },
      participants: userId
        ? { where: { userId }, take: 1 }
        : false,
    },
  });

  return conversations.map((conversation) => {
    const participant = userId && Array.isArray(conversation.participants)
      ? conversation.participants[0]
      : null;
    const lastMessage = conversation.messages[0] || null;
    return mapConversationRecord(conversation, {
      unreadCount: participant?.unreadCount ?? 0,
      lastMessage,
    });
  });
}

async function getConversationById(prisma, conversationId, tenantId) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });
  if (!conversation) {
    throw Object.assign(new Error('Conversation not found'), { status: 404 });
  }
  return conversation;
}

async function getConversationMessages(prisma, conversationId, tenantId, options = {}) {
  await getConversationById(prisma, conversationId, tenantId);

  const limit = Math.min(Number(options.limit) || 50, 200);
  const cursor = options.cursor || null;
  const where = { conversationId, tenantId };

  if (cursor) {
    const cursorMessage = await prisma.message.findFirst({
      where: { id: cursor, conversationId },
      select: { createdAt: true },
    });
    if (cursorMessage) {
      where.createdAt = { lt: cursorMessage.createdAt };
    }
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { attachments: true },
  });

  return messages.reverse().map(mapMessageRecord);
}

async function markConversationRead(prisma, { conversationId, tenantId, userId }) {
  const conversation = await getConversationById(prisma, conversationId, tenantId);
  await ensureParticipant(prisma, conversation.id, userId);

  const now = new Date();
  await prisma.message.updateMany({
    where: {
      conversationId: conversation.id,
      tenantId,
      direction: 'INBOUND',
      readAt: null,
    },
    data: { readAt: now },
  });

  await prisma.smsMessage.updateMany({
    where: {
      tenantId,
      direction: 'inbound',
      isRead: false,
      from: conversation.peer,
      to: conversation.line,
    },
    data: { isRead: true },
  });

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId: conversation.id, userId },
    },
    data: {
      lastReadAt: now,
      unreadCount: 0,
    },
  });

  return { conversationId: conversation.id, readAt: now };
}

async function buildLegacyConversationsFromMessages(prisma, tenantId, tenantNumbers) {
  const conversations = await listConversations(prisma, tenantId, null, { limit: 500 });
  return conversations.map((item) => ({
    peer: item.peer,
    line: item.line,
    lastMessage: item.lastMessage
      ? {
        id: item.lastMessage.id,
        tenantId: item.tenantId,
        telnyxMessageId: item.lastMessage.telnyxMessageId,
        from: item.lastMessage.from,
        to: item.lastMessage.to,
        body: item.lastMessage.body || '',
        direction: item.lastMessage.direction === 'OUTBOUND' ? 'outbound' : 'inbound',
        status: String(item.lastMessage.status || '').toLowerCase(),
        deliveryError: item.lastMessage.deliveryError,
        isRead: Boolean(item.lastMessage.readAt || item.lastMessage.direction === 'OUTBOUND'),
        createdAt: item.lastMessage.createdAt,
      }
      : null,
    unreadCount: item.unreadCount,
  })).filter((item) => item.lastMessage);
}

module.exports = {
  resolveConversationParties,
  findOrCreateConversation,
  ensureParticipant,
  updateConversationPreview,
  listConversations,
  getConversationById,
  getConversationMessages,
  markConversationRead,
  buildLegacyConversationsFromMessages,
};
