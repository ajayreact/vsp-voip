/**
 * V3 Monitoring Service — live operational monitoring dashboards (read-only).
 */

const runtimeSyncService = require('./runtime/runtimeSyncService');
const runtimeHealthService = require('./runtime/runtimeHealthService');
const healthCheckService = require('./healthCheckService');

async function getMonitoringOverview(prisma, tenantId) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    syncStatus,
    runtimeHealth,
    pendingJobs,
    failedJobs,
    retryJobs,
    deadLetterJobs,
    recentFailures,
    migrationQueue,
    tenantHealth,
    repairCandidates,
  ] = await Promise.all([
    runtimeSyncService.getStatus(prisma, tenantId),
    runtimeHealthService.getRuntimeHealth(prisma, tenantId),
    prisma.v3RuntimeSyncJob.findMany({
      where: { tenantId, status: { in: ['PENDING', 'RETRYING'] } },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    }),
    prisma.v3RuntimeSyncJob.count({ where: { tenantId, status: { in: ['FAILED', 'DEAD_LETTER'] } } }),
    prisma.v3RuntimeSyncJob.count({ where: { tenantId, status: 'RETRYING' } }),
    prisma.v3RuntimeSyncJob.count({ where: { tenantId, status: 'DEAD_LETTER' } }),
    prisma.v3RuntimeSyncJob.findMany({
      where: { tenantId, status: { in: ['FAILED', 'DEAD_LETTER'] }, updatedAt: { gte: since24h } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    prisma.v3MigrationRun.findMany({
      where: { tenantId, status: { in: ['PREVIEW', 'VALIDATED', 'RUNNING'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    healthCheckService.tenantHealthSummary(prisma, tenantId),
    prisma.v3RuntimeLink.count({ where: { tenantId } }),
  ]);

  const provisioningFailures = tenantHealth.errors;
  const registrationIssues = await prisma.user.count({
    where: {
      tenantId,
      telnyxCredentialId: { not: null },
      sipRegistered: false,
    },
  });

  return {
    runtimeSyncQueue: {
      pending: syncStatus.jobs.pending,
      running: syncStatus.jobs.running,
      items: pendingJobs,
    },
    failedSyncs: {
      total: failedJobs,
      recent: recentFailures,
    },
    retryQueue: { total: retryJobs },
    deadLetterQueue: { total: deadLetterJobs },
    runtimeHealth: {
      overall: runtimeHealth.overall,
      domains: runtimeHealth.domains,
      enabled: runtimeHealth.enabled,
    },
    provisioningFailures,
    registrationIssues,
    repairQueue: {
      runtimeLinks: repairCandidates,
      suggestedRepairs: failedJobs + (runtimeHealth.overall !== 'green' ? 1 : 0),
    },
    migrationQueue,
    tenantHealth,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getMonitoringOverview,
};
