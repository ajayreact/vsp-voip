const { logger } = require('../../logger');
const { isFeatureEnabled } = require('../featureFlags');
const { getTenantAiSettings } = require('../tenantSettings');
const { findSummary } = require('../modules/summaryStore');
const { enqueueSummaryGeneration } = require('../modules/summaryEngine');
const { fetchEntityAudio } = require('./audioSource');
const { runTranscription, isTranscriptionFeatureEnabled } = require('./gateway');
const {
  findTranscript,
  upsertTranscriptPending,
  markTranscriptProcessing,
  markTranscriptCompleted,
  markTranscriptFailed,
} = require('./transcriptStore');
const { scheduleTranscriptionJob } = require('./transcriptionQueue');
const { AiTranscriptionError } = require('./errors');

async function getEntityTranscript(prisma, tenantId, entityType, entityId) {
  const settings = await getTenantAiSettings(prisma, tenantId);
  const available = isTranscriptionFeatureEnabled(settings, entityType);
  const record = await findTranscript(prisma, tenantId, entityType, entityId);

  if (!available) {
    return { status: 'unavailable', reason: 'feature_disabled', transcript: record };
  }
  if (!record) {
    return { status: 'not_generated', transcript: null };
  }
  return { status: record.status, transcript: record };
}

async function maybeTriggerAutomaticSummary(prisma, params) {
  const { tenantId, entityType, entityId, userId, transcript, tenantName } = params;
  if (entityType === 'meeting') return;

  const settings = await getTenantAiSettings(prisma, tenantId);
  if (!isFeatureEnabled(settings, 'automatic_summary')) return;

  const summaryFeature =
    entityType === 'voicemail' ? 'voicemail_summary' : entityType === 'call' ? 'call_summary' : null;
  if (!summaryFeature || !isFeatureEnabled(settings, summaryFeature)) return;

  const existingSummary = await findSummary(prisma, tenantId, entityType, entityId);
  if (existingSummary?.status === 'completed' || existingSummary?.status === 'processing') {
    return;
  }

  await enqueueSummaryGeneration(prisma, {
    tenantId,
    entityType,
    entityId,
    userId,
    transcript,
    tenantName,
  });

  logger.info('ai_automatic_summary_enqueued', { tenantId, entityType, entityId });
}

async function executeTranscription(prisma, params) {
  const { tenantId, entityType, entityId, userId, tenantName } = params;

  const existing = await findTranscript(prisma, tenantId, entityType, entityId);
  if (existing?.status === 'completed' && existing.transcript?.trim()) {
    return existing;
  }
  if (existing?.status === 'processing') {
    return existing;
  }

  const audioSource = await fetchEntityAudio(prisma, tenantId, entityType, entityId);
  await upsertTranscriptPending(prisma, {
    tenantId,
    entityType,
    entityId,
    durationSeconds: audioSource.durationSeconds,
  });
  await markTranscriptProcessing(prisma, tenantId, entityType, entityId);

  try {
    const result = await runTranscription(prisma, {
      tenantId,
      userId,
      entityType,
      entityId,
      audioBuffer: audioSource.audioBuffer,
      contentType: audioSource.contentType,
      fileName: audioSource.fileName,
      durationSeconds: audioSource.durationSeconds,
    });

    const record = await markTranscriptCompleted(prisma, tenantId, entityType, entityId, {
      transcript: result.transcript,
      confidence: result.confidence,
      detectedLanguage: result.detectedLanguage,
      provider: result.provider,
      model: result.model,
      durationSeconds: result.durationSeconds ?? audioSource.durationSeconds,
      processingTimeMs: result.processingTimeMs,
      retryCount: result.retryCount ?? 0,
    });

    if (record?.transcript?.trim()) {
      await maybeTriggerAutomaticSummary(prisma, {
        tenantId,
        entityType,
        entityId,
        userId,
        transcript: record.transcript,
        tenantName,
      });
    }

    return record;
  } catch (error) {
    await markTranscriptFailed(prisma, tenantId, entityType, entityId, error);
    throw error;
  }
}

function enqueueTranscription(prisma, params) {
  const { tenantId, entityType, entityId } = params;

  return upsertTranscriptPending(prisma, {
    tenantId,
    entityType,
    entityId,
    durationSeconds: params.durationSeconds,
  }).then((record) => {
    scheduleTranscriptionJob(`${entityType}:${entityId}`, async () => {
      try {
        await executeTranscription(prisma, params);
      } catch (error) {
        logger.warn('ai_transcription_enqueue_failed', {
          tenantId,
          entityType,
          entityId,
          message: error.message,
        });
      }
    });
    return record;
  });
}

async function requestTranscription(prisma, params) {
  const { async: runAsync = true } = params;
  const existing = await findTranscript(prisma, params.tenantId, params.entityType, params.entityId);
  if (existing?.status === 'completed' && existing.transcript?.trim()) {
    return { queued: false, duplicate: true, transcript: existing };
  }

  if (runAsync) {
    const record = await enqueueTranscription(prisma, params);
    return { queued: true, transcript: record };
  }

  const transcript = await executeTranscription(prisma, params);
  return { queued: false, transcript };
}

module.exports = {
  getEntityTranscript,
  executeTranscription,
  enqueueTranscription,
  requestTranscription,
  maybeTriggerAutomaticSummary,
};
