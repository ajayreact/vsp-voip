const { runCompletion } = require('../gateway');
const { renderPromptVersion } = require('../promptManager');
const { parseAiJsonResponse, normalizeStructuredSummary } = require('./structuredOutput');
const {
  findSummary,
  upsertSummaryPending,
  markSummaryProcessing,
  markSummaryCompleted,
  markSummaryFailed,
} = require('./summaryStore');
const { scheduleSummaryJob } = require('./summaryQueue');
const { AiPolicyError } = require('../errors');
const { isPlatformAiEnabled, isTenantAiEnabled, isFeatureEnabled } = require('../featureFlags');
const { getTenantAiSettings } = require('../tenantSettings');

const FEATURE_BY_ENTITY = {
  voicemail: 'voicemail_summary',
  call: 'call_summary',
  conversation: 'message_summary',
};

const PROMPT_BY_ENTITY = {
  voicemail: { name: 'voicemail_summary', version: 1 },
  call: { name: 'call_summary', version: 1 },
  conversation: { name: 'message_summary', version: 1 },
};

async function resolveSummaryAvailability(prisma, tenantId, entityType) {
  if (!isPlatformAiEnabled()) {
    return { available: false, reason: 'platform_disabled' };
  }
  const settings = await getTenantAiSettings(prisma, tenantId);
  if (!isTenantAiEnabled(settings)) {
    return { available: false, reason: 'tenant_disabled' };
  }
  const feature = FEATURE_BY_ENTITY[entityType];
  if (!isFeatureEnabled(settings, feature)) {
    return { available: false, reason: 'feature_disabled', feature };
  }
  return { available: true, settings, feature };
}

async function getEntitySummary(prisma, tenantId, entityType, entityId) {
  const availability = await resolveSummaryAvailability(prisma, tenantId, entityType);
  const record = await findSummary(prisma, tenantId, entityType, entityId);

  if (!availability.available) {
    return {
      status: 'unavailable',
      reason: availability.reason,
      feature: availability.feature || null,
      summary: record,
    };
  }

  if (!record) {
    return { status: 'not_generated', summary: null };
  }

  return { status: record.status, summary: record };
}

async function executeSummaryGeneration(prisma, params) {
  const {
    tenantId,
    entityType,
    entityId,
    userId,
    transcript,
    tenantName,
    messageCount,
    variables = {},
  } = params;

  const availability = await resolveSummaryAvailability(prisma, tenantId, entityType);
  if (!availability.available) {
    throw new AiPolicyError('AI summary feature is not available', 'AI_FEATURE_UNAVAILABLE', {
      reason: availability.reason,
    });
  }

  await upsertSummaryPending(prisma, {
    tenantId,
    entityType,
    entityId,
    transcript,
    messageCount,
  });
  await markSummaryProcessing(prisma, tenantId, entityType, entityId);

  const promptMeta = PROMPT_BY_ENTITY[entityType];
  const userPrompt = renderPromptVersion(promptMeta.name, promptMeta.version, {
    transcript,
    tenantName: tenantName || 'Organization',
    ...variables,
  });

  const messages = [
    {
      role: 'system',
      content:
        'You are VSP Phone enterprise AI. Respond with ONLY valid JSON. Never use markdown or code fences.',
    },
    { role: 'user', content: userPrompt },
  ];

  const completion = await runCompletion(prisma, {
    tenantId,
    userId,
    feature: availability.feature,
    module: availability.feature,
    operation: `${entityType}_summary`,
    messages,
    metadata: { entityType, entityId },
  });

  if (!completion.content?.trim()) {
    throw new AiPolicyError('AI provider returned empty summary', 'AI_EMPTY_RESPONSE');
  }

  const parsed = parseAiJsonResponse(completion.content);
  const result = normalizeStructuredSummary(parsed, {
    provider: completion.provider,
    model: completion.model,
    moduleType: entityType,
  });

  return markSummaryCompleted(prisma, tenantId, entityType, entityId, {
    result,
    provider: result.provider,
    model: result.model,
    confidence: result.confidence,
    retryCount: 0,
  });
}

function enqueueSummaryGeneration(prisma, params) {
  const { tenantId, entityType, entityId } = params;

  return upsertSummaryPending(prisma, {
    tenantId,
    entityType,
    entityId,
    transcript: params.transcript,
    messageCount: params.messageCount,
  }).then((record) => {
    scheduleSummaryJob(`${entityType}:${entityId}`, async () => {
      try {
        await executeSummaryGeneration(prisma, params);
      } catch (error) {
        await markSummaryFailed(prisma, tenantId, entityType, entityId, error);
      }
    });
    return record;
  });
}

module.exports = {
  FEATURE_BY_ENTITY,
  resolveSummaryAvailability,
  getEntitySummary,
  executeSummaryGeneration,
  enqueueSummaryGeneration,
};
