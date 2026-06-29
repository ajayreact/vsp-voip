const { listExtensions } = require('../../extensions');
const { startOfUtcDay } = require('./intents');

function mapCallResult(call) {
  return {
    type: 'call',
    id: call.id,
    title: `${call.direction === 'inbound' ? 'From' : 'To'} ${call.from}`,
    subtitle: `${call.status || 'unknown'} · ${call.durationSeconds ?? 0}s`,
    meta: {
      direction: call.direction,
      status: call.status,
      from: call.from,
      to: call.to,
      createdAt: call.createdAt,
    },
  };
}

function mapVoicemailResult(vm) {
  return {
    type: 'voicemail',
    id: vm.id,
    title: `Voicemail from ${vm.from}`,
    subtitle: `${vm.durationSeconds ?? 0}s · ${vm.isRead ? 'Read' : 'New'}`,
    meta: { from: vm.from, to: vm.to, createdAt: vm.createdAt, isRead: vm.isRead },
  };
}

function mapMessageResult(message, conversation) {
  return {
    type: 'message',
    id: message.id,
    title: conversation?.peer || message.from,
    subtitle: (message.body || '').slice(0, 120),
    meta: {
      conversationId: message.conversationId,
      direction: message.direction,
      createdAt: message.createdAt,
    },
  };
}

function mapContactResult(ext) {
  return {
    type: 'contact',
    id: ext.id,
    title: ext.displayName || ext.extensionNumber,
    subtitle: ext.extensionNumber,
    meta: { email: ext.email, extensionNumber: ext.extensionNumber },
  };
}

function mapSummaryResult(summary) {
  const result = summary.result || {};
  return {
    type: 'summary',
    id: summary.id,
    title: `${summary.entityType} summary`,
    subtitle: result.summary || result.executiveSummary || result.conversationSummary || '',
    meta: {
      entityType: summary.entityType,
      entityId: summary.entityId,
      priority: result.priority,
      sentiment: result.sentiment,
    },
  };
}

async function searchCalls(prisma, tenantId, filters = {}) {
  const where = { tenantId };
  if (filters.status === 'missed') {
    where.status = { contains: 'miss', mode: 'insensitive' };
  }
  if (filters.today) {
    where.createdAt = { gte: startOfUtcDay() };
  }
  if (filters.query) {
    where.OR = [
      { from: { contains: filters.query, mode: 'insensitive' } },
      { to: { contains: filters.query, mode: 'insensitive' } },
    ];
  }

  const calls = await prisma.callLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 25,
  });
  return calls.map(mapCallResult);
}

async function searchVoicemails(prisma, tenantId, filters = {}) {
  const where = { tenantId };
  if (filters.today) where.createdAt = { gte: startOfUtcDay() };
  if (filters.query) {
    where.OR = [
      { from: { contains: filters.query, mode: 'insensitive' } },
      { to: { contains: filters.query, mode: 'insensitive' } },
    ];
  }

  const voicemails = await prisma.voicemail.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 25,
  });
  return voicemails.map(mapVoicemailResult);
}

async function searchMessages(prisma, tenantId, filters = {}) {
  const where = { tenantId };
  if (filters.unreadOnly) {
    where.readAt = null;
    where.direction = 'INBOUND';
  }
  if (filters.today) {
    where.createdAt = { gte: startOfUtcDay() };
  }
  if (filters.query) {
    where.body = { contains: filters.query, mode: 'insensitive' };
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 30,
    include: { conversation: true },
  });

  return messages.map((msg) => mapMessageResult(msg, msg.conversation));
}

async function searchContacts(prisma, tenantId, filters = {}) {
  const extensions = await listExtensions(prisma, tenantId);
  const query = String(filters.query || '').toLowerCase();
  const filtered = extensions.filter((ext) => {
    if (!query) return true;
    const haystack = [
      ext.displayName,
      ext.extensionNumber,
      ext.email,
      ext.user?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
  return filtered.slice(0, filters.limit || 25).map(mapContactResult);
}

async function searchAiSummaries(prisma, tenantId, filters = {}) {
  if (!prisma.aiSummary) return [];
  const summaries = await prisma.aiSummary.findMany({
    where: { tenantId, status: 'completed' },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  const query = String(filters.query || filters.priority || '').toLowerCase();
  return summaries
    .filter((row) => {
      if (filters.priority) {
        const priority = row.result?.priority;
        return String(priority || '').toLowerCase() === String(filters.priority).toLowerCase();
      }
      if (!query) return true;
      const text = JSON.stringify(row.result || {}).toLowerCase();
      return text.includes(query);
    })
    .slice(0, filters.limit || 20)
    .map(mapSummaryResult);
}

async function searchAiTranscripts(prisma, tenantId, filters = {}) {
  if (!prisma.aiTranscript) return [];
  const rows = await prisma.aiTranscript.findMany({
    where: { tenantId, status: 'completed' },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  const query = String(filters.query || '').toLowerCase();
  return rows
    .filter((row) => !query || String(row.transcript || '').toLowerCase().includes(query))
    .slice(0, filters.limit || 15)
    .map((row) => ({
      type: 'transcript',
      id: row.id,
      title: `${row.entityType} transcript`,
      subtitle: String(row.transcript || '').slice(0, 120),
      meta: { entityType: row.entityType, entityId: row.entityId, confidence: row.confidence },
    }));
}

async function getDailySummaryData(prisma, tenantId) {
  const since = startOfUtcDay();
  const [calls, voicemails, messages, summaries] = await Promise.all([
    searchCalls(prisma, tenantId, { today: true, limit: 10 }),
    searchVoicemails(prisma, tenantId, { today: true, limit: 10 }),
    searchMessages(prisma, tenantId, { today: true, limit: 10 }),
    searchAiSummaries(prisma, tenantId, { limit: 10 }),
  ]);

  return {
    calls,
    voicemails,
    messages,
    summaries,
    stats: {
      callCount: calls.length,
      voicemailCount: voicemails.length,
      messageCount: messages.length,
    },
  };
}

async function executeSearchPlan(prisma, tenantId, intent, filters = {}) {
  switch (intent) {
    case 'search_calls':
      return {
        results: await searchCalls(prisma, tenantId, filters),
        sources: ['callLog'],
      };
    case 'search_messages':
      return {
        results: await searchMessages(prisma, tenantId, filters),
        sources: ['messages'],
      };
    case 'search_voicemails':
      return {
        results: await searchVoicemails(prisma, tenantId, filters),
        sources: ['voicemail'],
      };
    case 'search_contacts':
      return {
        results: await searchContacts(prisma, tenantId, filters),
        sources: ['extensions'],
      };
    case 'daily_summary':
      return {
        ...(await getDailySummaryData(prisma, tenantId)),
        sources: ['callLog', 'voicemail', 'messages', 'aiSummary'],
      };
    case 'customer_summary': {
      const query = filters.customer || filters.query;
      const [calls, voicemails, messages, summaries, transcripts] = await Promise.all([
        searchCalls(prisma, tenantId, { query, limit: 10 }),
        searchVoicemails(prisma, tenantId, { query, limit: 10 }),
        searchMessages(prisma, tenantId, { query, limit: 10 }),
        searchAiSummaries(prisma, tenantId, { query, limit: 10 }),
        searchAiTranscripts(prisma, tenantId, { query, limit: 10 }),
      ]);
      return { calls, voicemails, messages, summaries, transcripts, results: [...calls, ...voicemails, ...messages], sources: ['multi'] };
    }
    case 'follow_up_detection':
    case 'callback_recommendations':
    case 'priority_detection': {
      const summaries = await searchAiSummaries(prisma, tenantId, {
        priority: intent === 'priority_detection' ? filters.priority || 'High' : undefined,
        query: filters.query,
        limit: 25,
      });
      const voicemails = intent === 'callback_recommendations'
        ? await searchVoicemails(prisma, tenantId, { today: filters.today, limit: 15 })
        : [];
      return { results: summaries, voicemails, summaries, sources: ['aiSummary', 'voicemail'] };
    }
    case 'conversation_search': {
      const [messages, transcripts, summaries] = await Promise.all([
        searchMessages(prisma, tenantId, { query: filters.query, limit: 20 }),
        searchAiTranscripts(prisma, tenantId, { query: filters.query, limit: 10 }),
        searchAiSummaries(prisma, tenantId, { query: filters.query, limit: 10 }),
      ]);
      return { results: messages, transcripts, summaries, sources: ['messages', 'aiTranscript', 'aiSummary'] };
    }
    default: {
      const query = filters.query;
      const [calls, voicemails, messages, summaries, transcripts] = await Promise.all([
        searchCalls(prisma, tenantId, { query, limit: 8 }),
        searchVoicemails(prisma, tenantId, { query, limit: 8 }),
        searchMessages(prisma, tenantId, { query, limit: 8 }),
        searchAiSummaries(prisma, tenantId, { query, limit: 8 }),
        searchAiTranscripts(prisma, tenantId, { query, limit: 8 }),
      ]);
      return {
        results: [...calls, ...voicemails, ...messages].slice(0, 20),
        summaries,
        transcripts,
        sources: ['callLog', 'voicemail', 'messages', 'aiSummary', 'aiTranscript'],
      };
    }
  }
}

module.exports = {
  searchCalls,
  searchVoicemails,
  searchMessages,
  searchContacts,
  searchAiSummaries,
  searchAiTranscripts,
  getDailySummaryData,
  executeSearchPlan,
};
