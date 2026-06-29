const { defaultTenantFeatures, normalizeTenantSettings } = require('./featureFlags');

const DEFAULTS = {
  enabled: false,
  allowedProvider: null,
  allowedModel: null,
  piiRedactionEnabled: true,
  dailyBudgetCents: null,
  monthlyBudgetCents: null,
  maxRequestsPerDay: null,
  maxTokens: null,
  temperature: null,
  streamingEnabled: true,
  features: defaultTenantFeatures(),
};

async function getTenantAiSettings(prisma, tenantId) {
  if (!prisma?.tenantAiSettings?.findUnique) {
    return normalizeTenantSettings(DEFAULTS);
  }

  const row = await prisma.tenantAiSettings.findUnique({ where: { tenantId } });
  if (!row) return normalizeTenantSettings(DEFAULTS);

  return normalizeTenantSettings({
    enabled: row.enabled,
    allowedProvider: row.allowedProvider ?? row.provider,
    allowedModel: row.allowedModel ?? row.defaultModel,
    piiRedactionEnabled: row.piiRedactionEnabled,
    dailyBudgetCents: row.dailyBudgetCents,
    monthlyBudgetCents: row.monthlyBudgetCents,
    maxRequestsPerDay: row.maxRequestsPerDay,
    maxTokens: row.maxTokens,
    temperature: row.temperature,
    streamingEnabled: row.streamingEnabled,
    features: row.features,
  });
}

async function upsertTenantAiSettings(prisma, tenantId, patch) {
  const current = await getTenantAiSettings(prisma, tenantId);
  const next = normalizeTenantSettings({
    ...current,
    ...patch,
    allowedProvider: patch.allowedProvider ?? patch.provider ?? current.allowedProvider,
    allowedModel: patch.allowedModel ?? patch.defaultModel ?? current.allowedModel,
    features: {
      ...current.features,
      ...(patch.features || {}),
    },
  });

  if (!prisma?.tenantAiSettings?.upsert) {
    return next;
  }

  await prisma.tenantAiSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      enabled: next.enabled,
      allowedProvider: next.allowedProvider,
      allowedModel: next.allowedModel,
      provider: next.allowedProvider,
      defaultModel: next.allowedModel,
      piiRedactionEnabled: next.piiRedactionEnabled,
      dailyBudgetCents: next.dailyBudgetCents,
      monthlyBudgetCents: next.monthlyBudgetCents,
      maxRequestsPerDay: next.maxRequestsPerDay,
      maxTokens: next.maxTokens,
      temperature: next.temperature,
      streamingEnabled: next.streamingEnabled,
      features: next.features,
    },
    update: {
      enabled: next.enabled,
      allowedProvider: next.allowedProvider,
      allowedModel: next.allowedModel,
      provider: next.allowedProvider,
      defaultModel: next.allowedModel,
      piiRedactionEnabled: next.piiRedactionEnabled,
      dailyBudgetCents: next.dailyBudgetCents,
      monthlyBudgetCents: next.monthlyBudgetCents,
      maxRequestsPerDay: next.maxRequestsPerDay,
      maxTokens: next.maxTokens,
      temperature: next.temperature,
      streamingEnabled: next.streamingEnabled,
      features: next.features,
    },
  });

  return next;
}

module.exports = {
  DEFAULTS,
  getTenantAiSettings,
  upsertTenantAiSettings,
};
