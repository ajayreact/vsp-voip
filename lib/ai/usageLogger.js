const { logger } = require('../logger');
const { calculateCostMicros, summarizeCosts } = require('./costTracker');

async function logAiUsage(prisma, entry) {
  const inputTokens = entry.inputTokens || 0;
  const outputTokens = entry.outputTokens || 0;
  const costMicros = entry.costMicros ?? calculateCostMicros(entry.model, inputTokens, outputTokens);

  const payload = {
    tenantId: entry.tenantId,
    userId: entry.userId || null,
    operation: entry.operation,
    module: entry.module || null,
    provider: entry.provider,
    model: entry.model,
    inputTokens,
    outputTokens,
    costMicros,
    status: entry.status || 'success',
    errorCode: entry.errorCode || null,
    latencyMs: entry.latencyMs ?? null,
    streamUsed: Boolean(entry.streamUsed),
    retryCount: entry.retryCount || 0,
    metadata: {
      ...(entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {}),
      totalTokens: inputTokens + outputTokens,
      estimatedCostCents: Math.ceil(costMicros / 10_000),
    },
  };

  logger.info('ai_usage', {
    tenantId: payload.tenantId,
    module: payload.module,
    operation: payload.operation,
    provider: payload.provider,
    model: payload.model,
    status: payload.status,
    inputTokens: payload.inputTokens,
    outputTokens: payload.outputTokens,
    totalTokens: inputTokens + outputTokens,
    costMicros: payload.costMicros,
    latencyMs: payload.latencyMs,
    streamUsed: payload.streamUsed,
    retryCount: payload.retryCount,
  });

  if (!prisma?.aiUsageLog?.create) {
    return { ...payload, id: null, persisted: false };
  }

  const row = await prisma.aiUsageLog.create({ data: payload });
  return { ...row, persisted: true };
}

async function getTenantUsageSummary(prisma, tenantId, { since } = {}) {
  if (!prisma?.aiUsageLog?.findMany) {
    return summarizeCosts([]);
  }

  const where = { tenantId };
  if (since) where.createdAt = { gte: since };

  const rows = await prisma.aiUsageLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const summary = summarizeCosts(rows);
  const streamCount = rows.filter((row) => row.streamUsed).length;
  const retryTotal = rows.reduce((sum, row) => sum + (row.retryCount || 0), 0);

  return {
    ...summary,
    streamRequests: streamCount,
    retryTotal,
    recent: rows.slice(0, 20).map((row) => ({
      id: row.id,
      operation: row.operation,
      module: row.module,
      provider: row.provider,
      model: row.model,
      status: row.status,
      costMicros: row.costMicros,
      latencyMs: row.latencyMs,
      streamUsed: row.streamUsed,
      retryCount: row.retryCount,
      createdAt: row.createdAt,
    })),
  };
}

function startOfUtcDay(date = new Date()) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

async function getTenantSpendMicrosToday(prisma, tenantId) {
  const summary = await getTenantUsageSummary(prisma, tenantId, { since: startOfUtcDay() });
  return summary.costMicros;
}

async function getTenantSpendMicrosThisMonth(prisma, tenantId) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const summary = await getTenantUsageSummary(prisma, tenantId, { since: start });
  return summary.costMicros;
}

module.exports = {
  logAiUsage,
  getTenantUsageSummary,
  getTenantSpendMicrosToday,
  getTenantSpendMicrosThisMonth,
};
