const { getAiConfig } = require('../config');
const { AiPolicyError } = require('../errors');
const { getEntitySummary, enqueueSummaryGeneration, executeSummaryGeneration } = require('./summaryEngine');

function getMessageSummaryThreshold() {
  return getAiConfig().messageSummaryMinMessages ?? 10;
}

function buildConversationTranscript(messages) {
  return messages
    .map((msg) => {
      const role = msg.direction === 'OUTBOUND' ? 'Agent' : 'Customer';
      const body = String(msg.body || '').trim();
      if (!body) return null;
      return `${role}: ${body}`;
    })
    .filter(Boolean)
    .join('\n');
}

async function loadConversation(prisma, tenantId, conversationId) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });
  if (!conversation) {
    throw new AiPolicyError('Conversation not found', 'CONVERSATION_NOT_FOUND', { status: 404 });
  }
  return conversation;
}

async function loadConversationMessages(prisma, tenantId, conversationId, limit = 200) {
  return prisma.message.findMany({
    where: { conversationId, tenantId },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      body: true,
      direction: true,
      createdAt: true,
    },
  });
}

async function getMessageSummary(prisma, tenantId, conversationId) {
  return getEntitySummary(prisma, tenantId, 'conversation', conversationId);
}

async function requestMessageSummary(prisma, params) {
  const {
    tenantId,
    conversationId,
    userId,
    transcript: transcriptOverride,
    async: runAsync = true,
    force = false,
  } = params;

  await loadConversation(prisma, tenantId, conversationId);
  const messages = await loadConversationMessages(prisma, tenantId, conversationId);
  const threshold = getMessageSummaryThreshold();

  if (!force && messages.length < threshold) {
    throw new AiPolicyError(
      `Conversation must have at least ${threshold} messages for AI summary`,
      'MESSAGE_THRESHOLD_NOT_MET',
      { status: 409, messageCount: messages.length, threshold },
    );
  }

  const transcript = transcriptOverride?.trim() || buildConversationTranscript(messages);
  if (!transcript.trim()) {
    throw new AiPolicyError('Conversation has no message content to summarize', 'EMPTY_CONVERSATION', {
      status: 409,
    });
  }

  const jobParams = {
    tenantId,
    entityType: 'conversation',
    entityId: conversationId,
    userId,
    transcript,
    messageCount: messages.length,
    tenantName: params.tenantName,
    variables: { messageCount: messages.length },
  };

  if (runAsync) {
    const record = await enqueueSummaryGeneration(prisma, jobParams);
    return { queued: true, summary: record, messageCount: messages.length };
  }

  const summary = await executeSummaryGeneration(prisma, jobParams);
  return { queued: false, summary, messageCount: messages.length };
}

module.exports = {
  getMessageSummaryThreshold,
  buildConversationTranscript,
  getMessageSummary,
  requestMessageSummary,
};
