const { ensureParticipant } = require('./ConversationService');

async function incrementUnreadForConversation(prisma, conversationId) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { tenantId: true },
  });
  if (!conversation) return;

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { id: true },
  });

  if (!participants.length) {
    const tenantUsers = await prisma.user.findMany({
      where: { tenantId: conversation.tenantId },
      select: { id: true },
    });
    await Promise.all(tenantUsers.map((user) => ensureParticipant(prisma, conversationId, user.id)));
  }

  await prisma.conversationParticipant.updateMany({
    where: { conversationId },
    data: { unreadCount: { increment: 1 } },
  });
}

async function notifyInboundMessage(prisma, { tenantId, conversationId, message }) {
  await incrementUnreadForConversation(prisma, conversationId);

  console.log('📩 Inbound message notification', {
    tenantId,
    conversationId,
    messageId: message.id,
    from: message.from,
    preview: (message.body || '[MMS]').slice(0, 80),
  });

  return { notified: true };
}

async function getUnreadCountForUser(prisma, tenantId, userId) {
  const aggregate = await prisma.conversationParticipant.aggregate({
    where: {
      userId,
      conversation: { tenantId },
    },
    _sum: { unreadCount: true },
  });
  return aggregate._sum.unreadCount || 0;
}

module.exports = {
  incrementUnreadForConversation,
  notifyInboundMessage,
  getUnreadCountForUser,
};
