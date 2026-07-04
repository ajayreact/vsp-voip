const { logger } = require('../../logger');
const { getAiConfig } = require('../config');
const { isPlatformAiEnabled, isTenantAiEnabled, isFeatureEnabled } = require('../featureFlags');
const { getTenantAiSettings } = require('../tenantSettings');
const { getTenantSpendMicrosToday, getTenantSpendMicrosThisMonth, logAiUsage } = require('../usageLogger');
const { microsToCents } = require('../costTracker');
const { AiBudgetExceededError } = require('../errors');
const { getTranscriptionConfig, validateSttProviderConfiguration } = require('./config');
const { AiTranscriptionDisabledError, AiTranscriptionProviderError } = require('./errors');
const { transcriptionProviderManager } = require('./providerManager');
const { calculateSttCostMicros } = require('./costTracker');

const ENTITY_FEATURE = {
  voicemail: 'voicemail_transcription',
  call: 'call_transcription',
  meeting: 'transcription',
};

function isTranscriptionFeatureEnabled(settings, entityType) {
  if (!isPlatformAiEnabled() || !isTenantAiEnabled(settings)) return false;
  if (!isFeatureEnabled(settings, 'transcription')) return false;
  const entityFeature = ENTITY_FEATURE[entityType] || 'transcription';
  return isFeatureEnabled(settings, entityFeature);
}

async function assertTranscriptionReady(prisma, tenantId, entityType) {
  if (!isPlatformAiEnabled()) {
    throw new AiTranscriptionDisabledError('AI platform is disabled');
  }
  const settings = await getTenantAiSettings(prisma, tenantId);
  if (!isTenantAiEnabled(settings)) {
    throw new AiTranscriptionDisabledError();
  }
  if (!isTranscriptionFeatureEnabled(settings, entityType)) {
    throw new AiTranscriptionDisabledError(`Transcription is not enabled for ${entityType}`);
  }

  if (settings.dailyBudgetCents != null) {
    const spentToday = await getTenantSpendMicrosToday(prisma, tenantId);
    if (microsToCents(spentToday) >= settings.dailyBudgetCents) {
      throw new AiBudgetExceededError('Daily AI budget exceeded for this organization');
    }
  }
  if (settings.monthlyBudgetCents != null) {
    const spentMonth = await getTenantSpendMicrosThisMonth(prisma, tenantId);
    if (microsToCents(spentMonth) >= settings.monthlyBudgetCents) {
      throw new AiBudgetExceededError('Monthly AI budget exceeded for this organization');
    }
  }

  return settings;
}

async function withSttRetry(fn, { maxRetries }) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const retryable = error.code === 'AI_TRANSCRIPTION_PROVIDER_ERROR'
        && [429, 502, 503, 504].includes(error.status || 0);
      if (!retryable || attempt >= maxRetries) break;
      const delay = getTranscriptionConfig().retryBaseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/**
 * Transcription Gateway — sole entry point for STT providers.
 * Only audio buffers are sent externally; never credentials or JWTs.
 */
async function runTranscription(prisma, params) {
  const started = Date.now();
  const settings = await assertTranscriptionReady(prisma, params.tenantId, params.entityType);
  const sttConfig = getTranscriptionConfig();
  const providerName = sttConfig.provider || 'noop';
  const model = params.model || sttConfig.defaultModel;
  const detectLanguage = isFeatureEnabled(settings, 'language_detection');

  const configStatus = validateSttProviderConfiguration(providerName);
  if (!configStatus.valid && providerName !== 'noop') {
    throw new AiTranscriptionProviderError(
      `STT provider ${providerName} is not configured`,
      providerName,
      503,
      { missing: configStatus.missing },
    );
  }

  if (!params.audioBuffer?.length) {
    throw new AiTranscriptionProviderError('Audio buffer is required', providerName, 400);
  }

  let retryCount = 0;
  try {
    const provider = transcriptionProviderManager.getProvider(providerName);
    const result = await withSttRetry(
      async (attempt) => {
        retryCount = attempt;
        return provider.transcribe({
          audioBuffer: params.audioBuffer,
          contentType: params.contentType,
          fileName: params.fileName,
          model,
          language: detectLanguage ? undefined : (params.language || sttConfig.defaultLanguage),
          detectLanguage,
          durationSeconds: params.durationSeconds,
        });
      },
      { maxRetries: sttConfig.maxRetries },
    );

    const costMicros = calculateSttCostMicros(result.model || model, result.durationSeconds ?? params.durationSeconds ?? 0);
    await logAiUsage(prisma, {
      tenantId: params.tenantId,
      userId: params.userId,
      operation: 'transcription',
      module: params.entityType ? `${params.entityType}_transcription` : 'transcription',
      provider: result.provider || providerName,
      model: result.model || model,
      status: 'success',
      latencyMs: Date.now() - started,
      costMicros,
      retryCount,
      metadata: {
        entityType: params.entityType,
        entityId: params.entityId,
        durationSeconds: result.durationSeconds ?? params.durationSeconds ?? null,
        detectedLanguage: result.detectedLanguage || null,
        confidence: result.confidence ?? null,
      },
    });

    return {
      ...result,
      processingTimeMs: Date.now() - started,
      retryCount,
    };
  } catch (error) {
    await logAiUsage(prisma, {
      tenantId: params.tenantId,
      userId: params.userId,
      operation: 'transcription',
      module: params.entityType ? `${params.entityType}_transcription` : 'transcription',
      provider: providerName,
      model,
      status: 'error',
      errorCode: error.code || 'AI_TRANSCRIPTION_ERROR',
      latencyMs: Date.now() - started,
      retryCount,
      metadata: { entityType: params.entityType, entityId: params.entityId },
    });
    logger.warn('ai_transcription_failed', {
      tenantId: params.tenantId,
      provider: providerName,
      code: error.code,
      message: error.message,
    });
    throw error;
  }
}

module.exports = {
  ENTITY_FEATURE,
  isTranscriptionFeatureEnabled,
  assertTranscriptionReady,
  runTranscription,
};
