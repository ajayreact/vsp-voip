/**
 * V3 Diagnostics Service — configuration and runtime drift analysis (read-only).
 */

const runtimeValidationService = require('./runtimeValidationService');
const backupService = require('./backupService');
const deploymentService = require('./deploymentService');
const runtimeSyncService = require('./runtime/runtimeSyncService');

async function getDiagnostics(prisma, tenantId) {
  const [
    validation,
    deployment,
    links,
    latestBackup,
    configVersion,
    syncStatus,
  ] = await Promise.all([
    runtimeValidationService.getValidationReport(prisma, tenantId),
    deploymentService.getDeploymentStatus(prisma, tenantId),
    prisma.v3RuntimeLink.findMany({ where: { tenantId }, take: 100 }),
    prisma.v3TenantBackup.findFirst({
      where: { tenantId, removedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    backupService.collectConfiguration(prisma, tenantId),
    runtimeSyncService.getStatus(prisma, tenantId),
  ]);

  const issues = [];
  const recommendations = [];

  for (const domain of validation.domains) {
    if (domain.level === 'red') {
      issues.push({ severity: 'critical', code: 'RUNTIME_DRIFT', domain: domain.domain, message: `${domain.domain} has sync errors` });
      recommendations.push({ action: 'repair', target: domain.domain, reason: 'Runtime drift detected' });
    } else if (domain.level === 'yellow') {
      issues.push({ severity: 'warning', code: 'RUNTIME_WARNING', domain: domain.domain, message: `${domain.domain} needs attention` });
    }
  }

  if (validation.provisioning.missingCredentials > 0) {
    issues.push({
      severity: 'warning',
      code: 'PROVISIONING_DRIFT',
      message: `${validation.provisioning.missingCredentials} extension(s) missing credentials`,
    });
    recommendations.push({ action: 'repair_pbx', reason: 'Missing provisioning credentials' });
  }

  if (!latestBackup) {
    issues.push({ severity: 'warning', code: 'NO_BACKUP', message: 'No configuration backup on file' });
    recommendations.push({ action: 'create_backup', reason: 'Enable rollback and migration safety' });
  }

  if (syncStatus.jobs.deadLetter > 0) {
    issues.push({
      severity: 'critical',
      code: 'SYNC_DEAD_LETTER',
      message: `${syncStatus.jobs.deadLetter} sync job(s) in dead letter queue`,
    });
    recommendations.push({ action: 'retry_sync_jobs', reason: 'Dead letter queue non-empty' });
  }

  const missingLinks = validation.domains
    .filter((d) => d.errors > 0 || d.warnings > 0)
    .map((d) => d.domain);

  return {
    readOnly: true,
    configurationVersion: configVersion.version,
    exportedAt: configVersion.exportedAt,
    itemCounts: backupService.countItems(configVersion),
    deployment,
    runtimeLinks: { total: links.length, sample: links.slice(0, 10) },
    backupFreshness: latestBackup
      ? { id: latestBackup.id, createdAt: latestBackup.createdAt, label: latestBackup.label }
      : null,
    issues,
    missingLinks,
    tenantDrift: validation.overall !== 'green',
    runtimeDrift: validation.domains.some((d) => d.level !== 'green'),
    databaseDrift: false,
    repairRecommendations: recommendations,
    validationSummary: validation,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getDiagnostics,
};
