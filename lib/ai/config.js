/**
 * Platform AI configuration from environment.
 * Provider is swappable via AI_PROVIDER without code changes.
 */

const SUPPORTED_PROVIDERS = ['noop', 'gemini', 'openai', 'azure', 'anthropic', 'local'];

function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return value === 'true' || value === '1';
}

function parseIntOr(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFloatOr(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadAiConfig() {
  const provider = (process.env.AI_PROVIDER || 'noop').trim().toLowerCase();
  const normalizedProvider = SUPPORTED_PROVIDERS.includes(provider) ? provider : 'noop';
  const defaultModel = process.env.AI_MODEL?.trim()
    || process.env.AI_DEFAULT_MODEL?.trim()
    || 'gemini-2.5-flash';

  return {
    enabled: parseBool(process.env.AI_ENABLED, false),
    provider: normalizedProvider,
    defaultModel,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || '',
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || '',
    anthropicModel: process.env.AI_ANTHROPIC_MODEL?.trim() || 'claude-3-5-haiku-20241022',
    azureOpenAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT?.trim() || '',
    azureOpenAiApiKey: process.env.AZURE_OPENAI_API_KEY?.trim() || '',
    azureOpenAiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || '',
    azureOpenAiApiVersion: process.env.AZURE_OPENAI_API_VERSION?.trim() || '2024-02-15-preview',
    localLlmBaseUrl: process.env.LOCAL_LLM_BASE_URL?.trim() || '',
    maxRetries: parseIntOr(process.env.AI_MAX_RETRIES, 2),
    retryBaseDelayMs: parseIntOr(process.env.AI_RETRY_BASE_DELAY_MS, 500),
    requestTimeoutMs: parseIntOr(process.env.AI_REQUEST_TIMEOUT_MS, 60_000),
    defaultMaxContextMessages: parseIntOr(process.env.AI_MAX_CONTEXT_MESSAGES, 40),
    logPromptBodies: parseBool(process.env.AI_LOG_PROMPT_BODIES, false),
    failoverEnabled: parseBool(process.env.AI_FAILOVER_ENABLED, false),
    failoverChain: (process.env.AI_FAILOVER_CHAIN || 'gemini,openai,noop')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
    messageSummaryMinMessages: parseIntOr(process.env.AI_MESSAGE_SUMMARY_MIN_MESSAGES, 10),
    providerVersion: process.env.AI_PROVIDER_VERSION?.trim() || '5.2.0',
  };
}

let cachedConfig = null;

function getAiConfig() {
  if (!cachedConfig) cachedConfig = loadAiConfig();
  return cachedConfig;
}

function resetAiConfigCache() {
  cachedConfig = null;
}

function validateProviderConfiguration(providerName) {
  const config = getAiConfig();
  const name = (providerName || config.provider || 'noop').toLowerCase();

  switch (name) {
    case 'noop':
      return { valid: true, provider: name, missing: [] };
    case 'gemini':
      return {
        valid: Boolean(config.geminiApiKey),
        provider: name,
        missing: config.geminiApiKey ? [] : ['GEMINI_API_KEY'],
      };
    case 'openai':
      return {
        valid: Boolean(config.openaiApiKey),
        provider: name,
        missing: config.openaiApiKey ? [] : ['OPENAI_API_KEY'],
      };
    case 'anthropic':
      return {
        valid: Boolean(config.anthropicApiKey),
        provider: name,
        missing: config.anthropicApiKey ? [] : ['ANTHROPIC_API_KEY'],
      };
    case 'azure':
      return {
        valid: Boolean(config.azureOpenAiEndpoint && config.azureOpenAiApiKey && config.azureOpenAiDeployment),
        provider: name,
        missing: [
          !config.azureOpenAiEndpoint ? 'AZURE_OPENAI_ENDPOINT' : null,
          !config.azureOpenAiApiKey ? 'AZURE_OPENAI_API_KEY' : null,
          !config.azureOpenAiDeployment ? 'AZURE_OPENAI_DEPLOYMENT' : null,
        ].filter(Boolean),
      };
    case 'local':
      return {
        valid: Boolean(config.localLlmBaseUrl),
        provider: name,
        missing: config.localLlmBaseUrl ? [] : ['LOCAL_LLM_BASE_URL'],
      };
    default:
      return { valid: false, provider: name, missing: ['UNKNOWN_PROVIDER'] };
  }
}

module.exports = {
  SUPPORTED_PROVIDERS,
  loadAiConfig,
  getAiConfig,
  resetAiConfigCache,
  validateProviderConfiguration,
};
