function mapTranscriptRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    tenantId: record.tenantId,
    entityType: record.entityType,
    entityId: record.entityId,
    status: record.status,
    transcript: record.transcript || null,
    confidence: record.confidence ?? null,
    detectedLanguage: record.detectedLanguage || null,
    provider: record.provider || null,
    model: record.model || null,
    durationSeconds: record.durationSeconds ?? null,
    processingTimeMs: record.processingTimeMs ?? null,
    errorCode: record.errorCode || null,
    errorMessage: record.errorMessage || null,
    retryCount: record.retryCount || 0,
    createdAt: record.createdAt?.toISOString?.() || record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt,
  };
}

async function findTranscript(prisma, tenantId, entityType, entityId) {
  if (!prisma?.aiTranscript) return null;
  const record = await prisma.aiTranscript.findUnique({
    where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
  });
  return mapTranscriptRecord(record);
}

async function upsertTranscriptPending(prisma, { tenantId, entityType, entityId, durationSeconds }) {
  if (!prisma?.aiTranscript) {
    return mapTranscriptRecord({
      tenantId,
      entityType,
      entityId,
      status: 'pending',
      durationSeconds,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const record = await prisma.aiTranscript.upsert({
    where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    create: { tenantId, entityType, entityId, status: 'pending', durationSeconds: durationSeconds ?? null },
    update: {
      status: 'pending',
      durationSeconds: durationSeconds ?? undefined,
      errorCode: null,
      errorMessage: null,
    },
  });
  return mapTranscriptRecord(record);
}

async function markTranscriptProcessing(prisma, tenantId, entityType, entityId) {
  if (!prisma?.aiTranscript) return null;
  const record = await prisma.aiTranscript.update({
    where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    data: { status: 'processing' },
  });
  return mapTranscriptRecord(record);
}

async function markTranscriptCompleted(prisma, tenantId, entityType, entityId, payload) {
  if (!prisma?.aiTranscript) return null;
  const record = await prisma.aiTranscript.update({
    where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    data: {
      status: 'completed',
      transcript: payload.transcript,
      confidence: payload.confidence,
      detectedLanguage: payload.detectedLanguage,
      provider: payload.provider,
      model: payload.model,
      durationSeconds: payload.durationSeconds,
      processingTimeMs: payload.processingTimeMs,
      errorCode: null,
      errorMessage: null,
      retryCount: payload.retryCount ?? 0,
    },
  });
  return mapTranscriptRecord(record);
}

async function markTranscriptFailed(prisma, tenantId, entityType, entityId, error, retryCount = 0) {
  if (!prisma?.aiTranscript) return null;
  const record = await prisma.aiTranscript.update({
    where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    data: {
      status: 'failed',
      errorCode: error.code || 'AI_TRANSCRIPTION_ERROR',
      errorMessage: error.message || 'Transcription failed',
      retryCount,
    },
  });
  return mapTranscriptRecord(record);
}

async function getStoredTranscriptText(prisma, tenantId, entityType, entityId) {
  const record = await findTranscript(prisma, tenantId, entityType, entityId);
  if (record?.status === 'completed' && record.transcript?.trim()) {
    return record.transcript.trim();
  }
  return null;
}

module.exports = {
  mapTranscriptRecord,
  findTranscript,
  upsertTranscriptPending,
  markTranscriptProcessing,
  markTranscriptCompleted,
  markTranscriptFailed,
  getStoredTranscriptText,
};
