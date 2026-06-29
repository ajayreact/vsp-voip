const { runCompletion, streamCompletion } = require('../gateway');
const { isFeatureEnabled } = require('../featureFlags');
const { getTenantAiSettings } = require('../tenantSettings');
const { AiDisabledError } = require('../errors');
const { classifyIntent, SUGGESTED_PROMPTS } = require('./intents');
const { executeSearchPlan } = require('./searchService');
const { buildAssistantContext, buildAssistantMessages } = require('./contextBuilder');
const { parseAssistantResponse, normalizeAssistantResponse } = require('./responseParser');
const { getCachedResponse, setCachedResponse } = require('./queryCache');

async function assertAssistantReady(prisma, tenantId) {
  const settings = await getTenantAiSettings(prisma, tenantId);
  if (!isFeatureEnabled(settings, 'ai_assistant')) {
    throw new AiDisabledError('AI Assistant is not enabled for this organization');
  }
  return settings;
}

async function runAssistantQuery(prisma, params) {
  const { tenantId, userId, question, tenantName, useCache = true } = params;
  const settings = await assertAssistantReady(prisma, tenantId);

  if (useCache) {
    const cached = getCachedResponse(tenantId, question);
    if (cached) return { ...cached, cached: true };
  }

  const { intent, filters } = classifyIntent(question);
  const searchData = await executeSearchPlan(prisma, tenantId, intent, filters);
  const contextJson = buildAssistantContext({ question, intent, searchData });
  const messages = buildAssistantMessages({ question, contextJson, tenantName });

  const completion = await runCompletion(prisma, {
    tenantId,
    userId,
    feature: 'ai_assistant',
    module: 'ai_assistant',
    operation: 'assistant_query',
    messages,
    metadata: { intent },
  });

  const parsed = parseAssistantResponse(completion.content);
  const response = normalizeAssistantResponse(parsed, {
    intent,
    searchData,
    provider: completion.provider,
    model: completion.model,
  });

  if (useCache) setCachedResponse(tenantId, question, response);
  return response;
}

async function* runAssistantStream(prisma, params) {
  const { tenantId, userId, question, tenantName } = params;
  const settings = await assertAssistantReady(prisma, tenantId);

  const { intent, filters } = classifyIntent(question);
  const searchData = await executeSearchPlan(prisma, tenantId, intent, filters);
  const contextJson = buildAssistantContext({ question, intent, searchData });
  const messages = buildAssistantMessages({ question, contextJson, tenantName });

  yield { type: 'meta', intent, sources: searchData.sources || [], stats: searchData.stats || null };

  if (!settings.streamingEnabled) {
    const response = await runAssistantQuery(prisma, { ...params, useCache: false });
    yield { type: 'done', ...response };
    return;
  }

  let content = '';
  for await (const chunk of streamCompletion(prisma, {
    tenantId,
    userId,
    feature: 'ai_assistant',
    module: 'ai_assistant',
    operation: 'assistant_stream',
    messages,
    metadata: { intent },
  })) {
    if (chunk.type === 'delta' && chunk.content) {
      content += chunk.content;
      yield { type: 'delta', content: chunk.content };
    }
    if (chunk.type === 'done') {
      const parsed = parseAssistantResponse(content);
      const response = normalizeAssistantResponse(parsed, {
        intent,
        searchData,
        provider: chunk.provider,
        model: chunk.model,
      });
      setCachedResponse(tenantId, question, response);
      yield { type: 'done', ...response };
    }
  }
}

function getSuggestedPrompts() {
  return SUGGESTED_PROMPTS;
}

module.exports = {
  assertAssistantReady,
  runAssistantQuery,
  runAssistantStream,
  getSuggestedPrompts,
};
