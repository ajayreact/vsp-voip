const { getAiConfig, SUPPORTED_PROVIDERS } = require('./config');

const KNOWN_FEATURES = [
  'transcription',
  'call_transcription',
  'voicemail_transcription',
  'language_detection',
  'automatic_summary',
  'call_summary',
  'voicemail_summary',
  'message_summary',
  'message_suggestions',
  'sentiment',
  'knowledge_base',
  'ai_assistant',
];

function defaultTenantFeatures() {
  return KNOWN_FEATURES.reduce((acc, feature) => {
    acc[feature] = false;
    return acc;
  }, {});
}

function isPlatformAiEnabled() {
  return getAiConfig().enabled;
}

function normalizeTenantSettings(raw) {
  const features = {
    ...defaultTenantFeatures(),
    ...(raw?.features && typeof raw.features === 'object' ? raw.features : {}),
  };

  return {
    enabled: Boolean(raw?.enabled),
    allowedProvider: raw?.allowedProvider || raw?.provider || null,
    allowedModel: raw?.allowedModel || raw?.defaultModel || null,
    piiRedactionEnabled: raw?.piiRedactionEnabled !== false,
    dailyBudgetCents: raw?.dailyBudgetCents ?? null,
    monthlyBudgetCents: raw?.monthlyBudgetCents ?? null,
    maxRequestsPerDay: raw?.maxRequestsPerDay ?? null,
    maxTokens: raw?.maxTokens ?? null,
    temperature: raw?.temperature ?? null,
    streamingEnabled: raw?.streamingEnabled !== false,
    features,
    // Backward-compatible aliases
    provider: raw?.allowedProvider || raw?.provider || null,
    defaultModel: raw?.allowedModel || raw?.defaultModel || null,
  };
}

function isTenantAiEnabled(settings) {
  return isPlatformAiEnabled() && Boolean(settings?.enabled);
}

function isFeatureEnabled(settings, feature) {
  if (!isTenantAiEnabled(settings)) return false;
  if (!KNOWN_FEATURES.includes(feature)) return false;
  return Boolean(settings.features?.[feature]);
}

function resolveProviderName(settings) {
  return settings?.allowedProvider || settings?.provider || getAiConfig().provider || 'noop';
}

function resolveModelName(settings, fallback) {
  return settings?.allowedModel || settings?.defaultModel || fallback || getAiConfig().defaultModel;
}

function assertAllowedProvider(settings, providerName) {
  const allowed = settings?.allowedProvider || settings?.provider;
  if (!allowed) return true;
  return allowed.toLowerCase() === String(providerName || '').toLowerCase();
}

function assertAllowedModel(settings, modelName) {
  const allowed = settings?.allowedModel || settings?.defaultModel;
  if (!allowed) return true;
  return allowed === modelName;
}

function validateTenantPolicies(settings) {
  const errors = [];
  if (settings.allowedProvider && !SUPPORTED_PROVIDERS.includes(settings.allowedProvider.toLowerCase())) {
    errors.push('INVALID_ALLOWED_PROVIDER');
  }
  if (settings.maxTokens != null && settings.maxTokens <= 0) {
    errors.push('INVALID_MAX_TOKENS');
  }
  if (settings.temperature != null && (settings.temperature < 0 || settings.temperature > 2)) {
    errors.push('INVALID_TEMPERATURE');
  }
  return errors;
}

module.exports = {
  KNOWN_FEATURES,
  defaultTenantFeatures,
  isPlatformAiEnabled,
  normalizeTenantSettings,
  isTenantAiEnabled,
  isFeatureEnabled,
  resolveProviderName,
  resolveModelName,
  assertAllowedProvider,
  assertAllowedModel,
  validateTenantPolicies,
};
