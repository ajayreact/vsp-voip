const { logger } = require('../logger');
const { calculateCostMicros, microsToCents, summarizeCosts } = require('./costTracker');
const { getAiConfig } = require('./config');
const {
  AiDisabledError,
  AiFeatureDisabledError,
  AiBudgetExceededError,
  AiRedactionError,
  AiPolicyError,
} = require('./errors');
const { withAiRetry } = require('./retry');
const { assertSafeForProvider, sanitizeMessages } = require('./redaction');
const {
  isPlatformAiEnabled,
  isTenantAiEnabled,
  isFeatureEnabled,
  resolveProviderName,
  resolveModelName,
  assertAllowedProvider,
  assertAllowedModel,
  validateTenantPolicies,
} = require('./featureFlags');
const { providerManager } = require('./providerManager');
const { getTenantAiSettings } = require('./tenantSettings');
const {
  logAiUsage,
  getTenantSpendMicrosThisMonth,
  getTenantSpendMicrosToday,
} = require('./usageLogger');
const { recordProviderSuccess, recordProviderFailure } = require('./healthMonitor');
const { getFailoverChain, shouldFailover } = require('./failover');
const { validateProviderConfiguration } = require('./config');

async function assertAiReady(prisma, tenantId, { feature } = {}) {
  if (!isPlatformAiEnabled()) {
    throw new AiDisabledError('AI platform is disabled');
  }

  const settings = await getTenantAiSettings(prisma, tenantId);
  if (!isTenantAiEnabled(settings)) {
    throw new AiDisabledError();
  }

  const policyErrors = validateTenantPolicies(settings);
  if (policyErrors.length) {
    throw new AiPolicyError('Invalid tenant AI policy configuration', 'AI_POLICY_INVALID', {
      errors: policyErrors,
    });
  }

  if (feature && !isFeatureEnabled(settings, feature)) {
    throw new AiFeatureDisabledError(feature);
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

function prepareMessages(messages, settings) {
  if (settings.piiRedactionEnabled && !assertSafeForProvider(messages)) {
    throw new AiRedactionError();
  }
  return settings.piiRedactionEnabled ? sanitizeMessages(messages) : messages;
}

function resolveRequestOptions(settings, params) {
  const providerName = resolveProviderName(settings);
  const model = resolveModelName(settings, params.model || getAiConfig().defaultModel);
  const temperature = params.temperature ?? settings.temperature ?? 0.2;
  const maxTokens = params.maxTokens ?? settings.maxTokens ?? undefined;

  if (!assertAllowedProvider(settings, providerName)) {
    throw new AiPolicyError(`Provider "${providerName}" is not allowed for this tenant`, 'AI_PROVIDER_NOT_ALLOWED');
  }
  if (!assertAllowedModel(settings, model)) {
    throw new AiPolicyError(`Model "${model}" is not allowed for this tenant`, 'AI_MODEL_NOT_ALLOWED');
  }

  return { providerName, model, temperature, maxTokens };
}

async function executeWithProviderChain(settings, request, { stream = false } = {}) {
  const chain = providerManager.getFailoverChain(resolveProviderName(settings));
  let lastError;
  let retryCount = 0;

  for (const providerName of chain) {
    const configStatus = validateProviderConfiguration(providerName);
    if (!configStatus.valid && providerName !== 'noop') {
      lastError = new AiPolicyError(
        `Provider ${providerName} is not configured`,
        'AI_PROVIDER_NOT_CONFIGURED',
        { missing: configStatus.missing },
      );
      continue;
    }

    const provider = providerManager.getProvider(providerName);
    const started = Date.now();

    try {
      if (stream) {
        const generator = provider.stream(request);
        recordProviderSuccess(providerName, Date.now() - started);
        return { provider, generator, providerName, retryCount };
      }

      const result = await withAiRetry(async () => provider.complete(request), {
        shouldRetry: (error) => {
          retryCount += 1;
          return shouldFailover(error);
        },
      });
      recordProviderSuccess(providerName, Date.now() - started);
      return { provider, result, providerName, retryCount };
    } catch (error) {
      recordProviderFailure(providerName, error);
      lastError = error;
      if (!shouldFailover(error) && !getAiConfig().failoverEnabled) {
        throw error;
      }
      logger.warn('ai_provider_failover', {
        provider: providerName,
        message: error.message,
        code: error.code,
      });
    }
  }

  throw lastError || new AiPolicyError('All AI providers failed', 'AI_PROVIDER_CHAIN_FAILED');
}

/**
 * AI Gateway — sole entry point for future modules.
 * Async-only; never invoke from telephony or messaging hot paths.
 */
async function runCompletion(prisma, params) {
  const started = Date.now();
  const settings = await assertAiReady(prisma, params.tenantId, { feature: params.feature });
  const { model, temperature, maxTokens } = resolveRequestOptions(settings, params);
  const messages = prepareMessages(params.messages, settings);
  const providerName = resolveProviderName(settings);

  try {
    const request = { model, messages, temperature, maxTokens };
    const { result, providerName: usedProvider, retryCount } = await executeWithProviderChain(settings, request, {
      stream: false,
    });

    await logAiUsage(prisma, {
      tenantId: params.tenantId,
      userId: params.userId,
      operation: params.operation || 'completion',
      module: params.module || params.feature || null,
      provider: result.provider || usedProvider,
      model: result.model || model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      status: 'success',
      latencyMs: Date.now() - started,
      streamUsed: false,
      retryCount,
      metadata: params.metadata || null,
    });

    return result;
  } catch (error) {
    await logAiUsage(prisma, {
      tenantId: params.tenantId,
      userId: params.userId,
      operation: params.operation || 'completion',
      module: params.module || params.feature || null,
      provider: providerName,
      model,
      status: 'error',
      errorCode: error.code || 'AI_ERROR',
      latencyMs: Date.now() - started,
      streamUsed: false,
      retryCount: 0,
      metadata: params.metadata || null,
    });
    logger.warn('ai_completion_failed', {
      tenantId: params.tenantId,
      provider: providerName,
      code: error.code || 'AI_ERROR',
      message: error.message,
    });
    throw error;
  }
}

async function* streamCompletion(prisma, params) {
  const started = Date.now();
  const settings = await assertAiReady(prisma, params.tenantId, { feature: params.feature });

  if (!settings.streamingEnabled) {
    throw new AiPolicyError('Streaming is disabled for this tenant', 'AI_STREAMING_DISABLED');
  }

  const { model, temperature, maxTokens } = resolveRequestOptions(settings, params);
  const messages = prepareMessages(params.messages, settings);
  const request = { model, messages, temperature, maxTokens };

  let inputTokens = 0;
  let outputTokens = 0;
  let resolvedModel = model;
  let providerName = resolveProviderName(settings);
  let retryCount = 0;

  try {
    const execution = await executeWithProviderChain(settings, request, { stream: true });
    providerName = execution.providerName;
    retryCount = execution.retryCount;

    for await (const chunk of execution.generator) {
      if (chunk.type === 'done') {
        inputTokens = chunk.inputTokens || inputTokens;
        outputTokens = chunk.outputTokens || outputTokens;
        resolvedModel = chunk.model || resolvedModel;
      }
      yield chunk;
    }

    await logAiUsage(prisma, {
      tenantId: params.tenantId,
      userId: params.userId,
      operation: params.operation || 'stream_completion',
      module: params.module || params.feature || null,
      provider: providerName,
      model: resolvedModel,
      inputTokens,
      outputTokens,
      status: 'success',
      latencyMs: Date.now() - started,
      streamUsed: true,
      retryCount,
      metadata: params.metadata || null,
    });
  } catch (error) {
    await logAiUsage(prisma, {
      tenantId: params.tenantId,
      userId: params.userId,
      operation: params.operation || 'stream_completion',
      module: params.module || params.feature || null,
      provider: providerName,
      model: resolvedModel,
      status: 'error',
      errorCode: error.code || 'AI_ERROR',
      latencyMs: Date.now() - started,
      streamUsed: true,
      retryCount,
      metadata: params.metadata || null,
    });
    logger.warn('ai_stream_failed', {
      tenantId: params.tenantId,
      provider: providerName,
      code: error.code || 'AI_ERROR',
      message: error.message,
    });
    throw error;
  }
}

async function getAiStatus(prisma, tenantId) {
  const platformEnabled = isPlatformAiEnabled();
  const settings = await getTenantAiSettings(prisma, tenantId);
  const tenantEnabled = isTenantAiEnabled(settings);
  const provider = resolveProviderName(settings);
  const model = resolveModelName(settings);
  const configStatus = validateProviderConfiguration(provider);
  const runtimeHealth = require('./healthMonitor').getHealthSnapshot(provider);

  return {
    platformEnabled,
    tenantEnabled,
    enabled: tenantEnabled,
    provider,
    model,
    selectedModel: model,
    healthy: tenantEnabled && configStatus.valid && runtimeHealth.healthy,
    configurationStatus: configStatus.valid ? 'valid' : 'missing_credentials',
    missingConfiguration: configStatus.missing,
    responseLatencyMs: runtimeHealth.responseLatencyMs,
    lastSuccessfulRequest: runtimeHealth.lastSuccessfulRequest,
    lastFailure: runtimeHealth.lastFailure,
    lastErrorCode: runtimeHealth.lastErrorCode,
    providerVersion: runtimeHealth.providerVersion,
    features: settings.features,
    policies: {
      dailyBudgetCents: settings.dailyBudgetCents,
      monthlyBudgetCents: settings.monthlyBudgetCents,
      allowedProvider: settings.allowedProvider,
      allowedModel: settings.allowedModel,
      maxTokens: settings.maxTokens,
      temperature: settings.temperature,
      streamingEnabled: settings.streamingEnabled,
      piiRedactionEnabled: settings.piiRedactionEnabled,
    },
    failoverEnabled: getAiConfig().failoverEnabled,
    supportedProviders: providerManager.listProviders(),
  };
}

module.exports = {
  assertAiReady,
  runCompletion,
  streamCompletion,
  getAiStatus,
  prepareMessages,
  resolveRequestOptions,
};
