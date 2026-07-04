/**
 * V3 Production Health Service — overall production readiness scorecard.
 */

const deploymentService = require('./deploymentService');
const monitoringService = require('./monitoringService');
const diagnosticsService = require('./diagnosticsService');
const runtimeValidationService = require('./runtimeValidationService');
const lifecycleHealthService = require('./lifecycleHealthService');
const metricsService = require('./metricsService');

function worstLevel(levels) {
  if (levels.includes('red')) return 'red';
  if (levels.includes('yellow')) return 'yellow';
  return 'green';
}

async function getProductionHealth(prisma, tenantId) {
  const [
    deployment,
    monitoring,
    diagnostics,
    validation,
    lifecycle,
    metrics,
    migrationStatus,
  ] = await Promise.all([
    deploymentService.getDeploymentStatus(prisma, tenantId),
    monitoringService.getMonitoringOverview(prisma, tenantId),
    diagnosticsService.getDiagnostics(prisma, tenantId),
    runtimeValidationService.getValidationReport(prisma, tenantId),
    lifecycleHealthService.getLifecycleHealth(prisma, tenantId),
    metricsService.getMetrics(prisma, tenantId, { windowHours: 24 }),
    prisma.v3MigrationRun.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, createdAt: true, runType: true },
    }),
  ]);

  const criticalIssues = diagnostics.issues.filter((i) => i.severity === 'critical');
  const warnings = diagnostics.issues.filter((i) => i.severity === 'warning');

  const healthyDomains = {
    runtime: monitoring.runtimeHealth.overall,
    validation: validation.overall,
    license: lifecycle.license.level,
    storage: lifecycle.storage.level,
    backup: lifecycle.backup.level,
    billing: lifecycle.billing.level,
    subscription: lifecycle.subscription.level,
    deployment: deployment.readiness.tenantActive && deployment.readiness.portalEnabled ? 'green' : 'yellow',
  };

  const overall = worstLevel([
    ...Object.values(healthyDomains),
    criticalIssues.length ? 'red' : null,
    warnings.length ? 'yellow' : null,
  ].filter(Boolean));

  return {
    overall,
    criticalIssues,
    warnings,
    healthyDomains,
    syncQueue: monitoring.runtimeSyncQueue,
    migrationStatus: migrationStatus || { status: 'none' },
    backupFreshness: lifecycle.backup,
    license: lifecycle.license,
    storage: lifecycle.storage,
    runtime: {
      enabled: monitoring.runtimeHealth.enabled,
      overall: monitoring.runtimeHealth.overall,
      failedSyncs: monitoring.failedSyncs.total,
    },
    metrics: {
      syncSuccessRate: metrics.sync.total
        ? Math.round((metrics.sync.success / metrics.sync.total) * 100)
        : null,
      provisioningSuccessRate: metrics.provisioning.successRate,
    },
    deployment: deployment.readiness,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getProductionHealth,
};
