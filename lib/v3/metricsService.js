/**
 * V3 Metrics Service — aggregated operational metrics (read-only).
 */

async function avgDuration(jobs) {
  const durations = jobs
    .filter((j) => j.startedAt && j.finishedAt)
    .map((j) => new Date(j.finishedAt).getTime() - new Date(j.startedAt).getTime());
  if (!durations.length) return null;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

async function getTenantUserIds(prisma, tenantId) {
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function getMetrics(prisma, tenantId, { windowHours = 24 } = {}) {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const tenantUserIds = await getTenantUserIds(prisma, tenantId);
  const auditUserFilter = tenantUserIds.length
    ? { userId: { in: tenantUserIds } }
    : { userId: { in: [] } };

  const [
    syncJobs,
    migrationRuns,
    auditProvision,
    auditRepair,
    extensions,
    registeredUsers,
  ] = await Promise.all([
    prisma.v3RuntimeSyncJob.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: { status: true, startedAt: true, finishedAt: true, entityType: true, lastError: true },
    }),
    prisma.v3MigrationRun.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: { status: true, startedAt: true, finishedAt: true, runType: true },
    }),
    prisma.adminAuditLog.count({
      where: {
        action: { in: ['v3.device.provisioned', 'v3.employee.created'] },
        createdAt: { gte: since },
        ...auditUserFilter,
      },
    }),
    prisma.adminAuditLog.count({
      where: {
        action: { in: ['v3.runtime.repair.completed', 'v3.pbx.repair'] },
        createdAt: { gte: since },
        ...auditUserFilter,
      },
    }),
    prisma.extension.count({ where: { tenantId, status: 'ACTIVE', userId: { not: null } } }),
    prisma.user.count({ where: { tenantId, sipRegistered: true } }),
  ]);

  const syncSuccess = syncJobs.filter((j) => j.status === 'SUCCESS');
  const syncFailed = syncJobs.filter((j) => ['FAILED', 'DEAD_LETTER'].includes(j.status));
  const migrationSuccess = migrationRuns.filter((m) => m.status === 'SUCCESS');

  return {
    windowHours,
    sync: {
      total: syncJobs.length,
      success: syncSuccess.length,
      failed: syncFailed.length,
      avgDurationMs: await avgDuration(syncJobs),
      queueLength: syncJobs.filter((j) => ['PENDING', 'RETRYING', 'RUNNING'].includes(j.status)).length,
      runtimeErrors: syncFailed.length,
    },
    repair: {
      count: auditRepair,
      avgDurationMs: null,
    },
    migration: {
      total: migrationRuns.length,
      success: migrationSuccess.length,
      avgDurationMs: await avgDuration(migrationRuns),
    },
    provisioning: {
      events: auditProvision,
      extensionsWithEmployees: extensions,
      successRate: extensions ? Math.round((registeredUsers / extensions) * 100) : null,
      failureEstimate: Math.max(0, extensions - registeredUsers),
    },
    registration: {
      registered: registeredUsers,
      rate: extensions ? Math.round((registeredUsers / extensions) * 100) : 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getMetrics,
  avgDuration,
};
