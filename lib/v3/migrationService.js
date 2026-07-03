/**
 * V3 Migration Service — tenant migration preview, validation, execute, rollback, report.
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');
const backupService = require('./backupService');
const exportImportService = require('./exportImportService');
const runtimeValidationService = require('./runtimeValidationService');
const rollbackService = require('./rollbackService');
const runtimeSyncService = require('./runtime/runtimeSyncService');
const { isRuntimeSyncEnabledForTenant } = require('./runtime/runtimeFeatureFlag');

function normalizeTenantIds(tenantId, input) {
  const ids = Array.isArray(input?.tenantIds) ? input.tenantIds : [];
  const unique = [...new Set([tenantId, ...ids.map(String)])];
  return unique;
}

async function createRun(prisma, tenantId, data) {
  return prisma.v3MigrationRun.create({
    data: {
      id: randomUUID(),
      tenantId,
      runType: data.runType || 'migrate',
      status: data.status || 'PREVIEW',
      dryRun: data.dryRun !== false,
      targetTenantIds: data.targetTenantIds || [tenantId],
      preview: data.preview || null,
      validation: data.validation || null,
      result: data.result || null,
      report: data.report || null,
      backupId: data.backupId || null,
      rollbackBackupId: data.rollbackBackupId || null,
      startedAt: data.startedAt || null,
      finishedAt: data.finishedAt || null,
      createdByUserId: data.createdByUserId || null,
    },
  });
}

async function migrationPreview(prisma, tenantId, { tenantIds, payload } = {}) {
  const targets = normalizeTenantIds(tenantId, { tenantIds });
  const current = await backupService.collectConfiguration(prisma, tenantId);
  let incoming = payload;

  if (payload && typeof payload === 'object') {
    const validation = await exportImportService.validateImport(prisma, tenantId, payload);
    incoming = payload;
    return {
      targets,
      currentCounts: backupService.countItems(current),
      incomingCounts: incoming ? backupService.countItems(incoming) : null,
      validation,
      dryRun: true,
      readOnly: true,
      warnings: ['Migration preview is read-only. No changes applied.'],
    };
  }

  return {
    targets,
    currentCounts: backupService.countItems(current),
    validation: { valid: true, issues: [] },
    dryRun: true,
    readOnly: true,
    note: 'Provide payload for cross-tenant import preview, or run execute to snapshot current tenant.',
  };
}

async function migrationValidate(prisma, tenantId, { tenantIds, payload, req } = {}) {
  const preview = await migrationPreview(prisma, tenantId, { tenantIds, payload });
  const runtimeValidation = await runtimeValidationService.getValidationReport(prisma, tenantId);

  const run = await createRun(prisma, tenantId, {
    status: 'VALIDATED',
    dryRun: true,
    targetTenantIds: preview.targets,
    preview,
    validation: runtimeValidation,
    createdByUserId: req?.user?.sub || null,
  });

  await auditService.log(prisma, req, {
    action: 'v3.migration.validated',
    entityType: 'V3MigrationRun',
    entityId: run.id,
    newValue: { overall: runtimeValidation.overall },
  });

  return { run, preview, validation: runtimeValidation };
}

async function migrationExecute(prisma, tenantId, { tenantIds, payload, dryRun = false, req } = {}) {
  const targets = normalizeTenantIds(tenantId, { tenantIds });
  const startedAt = new Date();

  let run = await createRun(prisma, tenantId, {
    status: 'RUNNING',
    dryRun,
    targetTenantIds: targets,
    startedAt,
    createdByUserId: req?.user?.sub || null,
  });

  let preBackup = null;

  try {
    preBackup = dryRun
      ? null
      : await backupService.createBackup(prisma, tenantId, {
        label: `Pre-migration ${startedAt.toISOString()}`,
      }, { req });

    let importResult = null;
    if (payload && !dryRun) {
      importResult = await exportImportService.importConfiguration(prisma, tenantId, {
        payload,
        dryRun: false,
        apply: true,
      }, { req });
    }

    const validation = await runtimeValidationService.getValidationReport(prisma, tenantId);

    let syncResult = null;
    if (!dryRun && isRuntimeSyncEnabledForTenant(tenantId)) {
      syncResult = await runtimeSyncService.resyncAll(prisma, tenantId, { req });
    }

    const report = {
      executedAt: new Date().toISOString(),
      dryRun,
      targets,
      preBackupId: preBackup?.id || null,
      importResult,
      validationOverall: validation.overall,
      syncResult,
    };

    run = await prisma.v3MigrationRun.update({
      where: { id: run.id },
      data: {
        status: dryRun ? 'VALIDATED' : 'SUCCESS',
        dryRun,
        backupId: preBackup?.id || null,
        validation,
        result: { importResult, syncResult },
        report,
        finishedAt: new Date(),
      },
    });

    await auditService.log(prisma, req, {
      action: dryRun ? 'v3.migration.preview' : 'v3.migration.executed',
      entityType: 'V3MigrationRun',
      entityId: run.id,
      newValue: { dryRun, backupId: preBackup?.id, targets },
    });

    return { run, report };
  } catch (error) {
    let rollbackResult = null;
    if (!dryRun && preBackup?.id) {
      try {
        rollbackResult = await rollbackService.rollbackExecute(prisma, tenantId, {
          backupId: preBackup.id,
          req,
        });
      } catch {
        // preserve original failure
      }
    }

    run = await prisma.v3MigrationRun.update({
      where: { id: run.id },
      data: {
        status: rollbackResult ? 'ROLLED_BACK' : 'FAILED',
        backupId: preBackup?.id || null,
        rollbackBackupId: rollbackResult ? preBackup.id : null,
        result: { error: error.message, rollback: rollbackResult },
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

async function migrationRollback(prisma, tenantId, { migrationRunId, backupId, dryRun = false, req } = {}) {
  let targetBackupId = backupId;
  if (migrationRunId) {
    const run = await prisma.v3MigrationRun.findFirst({ where: { id: migrationRunId, tenantId } });
    if (!run?.backupId) {
      throw Object.assign(new Error('Migration run has no pre-migration backup'), { status: 400 });
    }
    targetBackupId = run.backupId;
  }

  const result = await rollbackService.rollbackExecute(prisma, tenantId, {
    backupId: targetBackupId,
    dryRun,
    req,
  });

  if (!dryRun && migrationRunId) {
    await prisma.v3MigrationRun.update({
      where: { id: migrationRunId },
      data: { status: 'ROLLED_BACK', rollbackBackupId: targetBackupId, finishedAt: new Date() },
    });
  }

  await auditService.log(prisma, req, {
    action: dryRun ? 'v3.migration.rollback.preview' : 'v3.migration.rollback.executed',
    entityType: 'V3MigrationRun',
    entityId: migrationRunId || targetBackupId,
    newValue: { backupId: targetBackupId, dryRun },
  });

  return result;
}

async function getMigrationReport(prisma, tenantId, { migrationRunId, limit = 20 } = {}) {
  if (migrationRunId) {
    const run = await prisma.v3MigrationRun.findFirst({ where: { id: migrationRunId, tenantId } });
    if (!run) throw Object.assign(new Error('Migration run not found'), { status: 404 });
    return { run, report: run.report };
  }

  const [items, total] = await Promise.all([
    prisma.v3MigrationRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.v3MigrationRun.count({ where: { tenantId } }),
  ]);

  return { items, total };
}

module.exports = {
  migrationPreview,
  migrationValidate,
  migrationExecute,
  migrationRollback,
  getMigrationReport,
  normalizeTenantIds,
};
