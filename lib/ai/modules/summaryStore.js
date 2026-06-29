const SUMMARY_STATUSES = ['pending', 'processing', 'completed', 'failed'];

function mapSummaryRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    tenantId: record.tenantId,
    entityType: record.entityType,
    entityId: record.entityId,
    status: record.status,
    result: record.result || null,
    provider: record.provider || null,
    model: record.model || null,
    confidence: record.confidence ?? null,
    messageCount: record.messageCount ?? null,
    errorCode: record.errorCode || null,
    errorMessage: record.errorMessage || null,
    retryCount: record.retryCount || 0,
    generatedAt: record.generatedAt?.toISOString?.() || record.generatedAt || null,
    createdAt: record.createdAt?.toISOString?.() || record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt,
  };
}

async function findSummary(prisma, tenantId, entityType, entityId) {
  if (!prisma?.aiSummary) return null;
  const record = await prisma.aiSummary.findUnique({
    where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
  });
  return mapSummaryRecord(record);
}

async function upsertSummaryPending(prisma, { tenantId, entityType, entityId, transcript, messageCount }) {
  if (!prisma?.aiSummary) {
    return mapSummaryRecord({
      tenantId,
      entityType,
      entityId,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const record = await prisma.aiSummary.upsert({
    where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    create: {
      tenantId,
      entityType,
      entityId,
      status: 'pending',
      transcript: transcript || null,
      messageCount: messageCount ?? null,
    },
    update: {
      status: 'pending',
      transcript: transcript || undefined,
      messageCount: messageCount ?? undefined,
      errorCode: null,
      errorMessage: null,
    },
  });
  return mapSummaryRecord(record);
}

async function markSummaryProcessing(prisma, tenantId, entityType, entityId) {
  if (!prisma?.aiSummary) return null;
  const record = await prisma.aiSummary.update({
    where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    data: { status: 'processing' },
  });
  return mapSummaryRecord(record);
}

async function markSummaryCompleted(prisma, tenantId, entityType, entityId, payload) {
  if (!prisma?.aiSummary) return null;
  const record = await prisma.aiSummary.update({
    where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    data: {
      status: 'completed',
      result: payload.result,
      provider: payload.provider,
      model: payload.model,
      confidence: payload.confidence,
      generatedAt: new Date(),
      errorCode: null,
      errorMessage: null,
      retryCount: payload.retryCount ?? 0,
    },
  });
  return mapSummaryRecord(record);
}

async function markSummaryFailed(prisma, tenantId, entityType, entityId, error, retryCount = 0) {
  if (!prisma?.aiSummary) return null;
  const record = await prisma.aiSummary.update({
    where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    data: {
      status: 'failed',
      errorCode: error.code || 'AI_ERROR',
      errorMessage: error.message || 'Summary generation failed',
      retryCount,
    },
  });
  return mapSummaryRecord(record);
}

module.exports = {
  SUMMARY_STATUSES,
  mapSummaryRecord,
  findSummary,
  upsertSummaryPending,
  markSummaryProcessing,
  markSummaryCompleted,
  markSummaryFailed,
};
