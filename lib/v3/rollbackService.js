/**
 * V3 Rollback Service — preview and execute rollback using V3 backups (non-destructive deletes).
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');
const backupService = require('./backupService');
const restoreService = require('./restoreService');

async function rollbackPreview(prisma, tenantId, { backupId } = {}) {
  if (!backupId) {
    const latest = await prisma.v3TenantBackup.findFirst({
      where: { tenantId, removedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) {
      throw Object.assign(new Error('No backup available for rollback preview'), { status: 404 });
    }
    backupId = latest.id;
  }

  const preview = await restoreService.restorePreview(prisma, tenantId, { backupId });
  const backup = await backupService.getBackup(prisma, tenantId, backupId);

  return {
    readOnly: true,
    backupId,
    backupLabel: backup?.label || null,
    backupCreatedAt: backup?.createdAt || null,
    preview,
    warnings: [
      'Rollback applies V3 configuration from backup only.',
      'Existing records are updated or created — never silently deleted.',
      'Runtime telephony objects are not removed.',
    ],
  };
}

async function rollbackExecute(prisma, tenantId, { backupId, dryRun = false, req } = {}) {
  const preview = await rollbackPreview(prisma, tenantId, { backupId });
  const targetBackupId = preview.backupId;

  if (dryRun) {
    await auditService.log(prisma, req, {
      action: 'v3.rollback.preview',
      entityType: 'V3TenantBackup',
      entityId: targetBackupId,
      newValue: { dryRun: true, summary: preview.preview?.summary },
    });
    return { dryRun: true, ...preview };
  }

  const backup = await backupService.getBackup(prisma, tenantId, targetBackupId);
  const result = await restoreService.applyRestore(prisma, tenantId, {
    backupId: targetBackupId,
    payload: backup.payload,
  }, { req, dryRun: false });

  await auditService.log(prisma, req, {
    action: 'v3.rollback.executed',
    entityType: 'V3TenantBackup',
    entityId: targetBackupId,
    newValue: { applied: result.applied?.length || 0 },
  });

  return {
    dryRun: false,
    backupId: targetBackupId,
    preview: preview.preview,
    result,
    report: buildRollbackReport(preview, result),
  };
}

async function validateRollback(prisma, tenantId, { backupId } = {}) {
  const preview = await rollbackPreview(prisma, tenantId, { backupId });
  return {
    valid: preview.preview?.valid !== false,
    backupId: preview.backupId,
    summary: preview.preview?.summary,
    readOnly: true,
  };
}

function buildRollbackReport(preview, result) {
  return {
    id: randomUUID(),
    backupId: preview.backupId,
    executedAt: new Date().toISOString(),
    summary: preview.preview?.summary,
    applied: result?.applied?.length || 0,
    changes: result?.applied || [],
  };
}

module.exports = {
  rollbackPreview,
  rollbackExecute,
  validateRollback,
  buildRollbackReport,
};
