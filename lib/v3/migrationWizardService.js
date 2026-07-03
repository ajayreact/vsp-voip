/**
 * V3 Migration Wizard — orchestrates legacy → V3 tenant migration (read-only discovery/validation,
 * preview, execute with backup + repair + runtime sync, post-validation, auto-rollback).
 *
 * Additive only. Does not modify Call Control, webhooks, workers, or SIP routing paths.
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');
const backupService = require('./backupService');
const repairService = require('./repairService');
const runtimeSyncService = require('./runtime/runtimeSyncService');
const runtimeValidationService = require('./runtimeValidationService');
const runtimeHealthService = require('./runtime/runtimeHealthService');
const healthCheckService = require('./healthCheckService');
const productionHealthService = require('./productionHealthService');
const diagnosticsService = require('./diagnosticsService');
const licenseService = require('./licenseService');
const callFlowValidationService = require('./callFlowValidationService');
const rollbackService = require('./rollbackService');
const { isRuntimeSyncEnabledForTenant } = require('./runtime/runtimeFeatureFlag');
const runtimeAdapter = require('./runtime/runtimeAdapter');

const RUN_TYPE = 'wizard';

const RUNTIME_ENTITY_MAP = [
  { key: 'ringGroups', entityType: 'ring_group', load: (p, t) => p.v3RingGroup.findMany({ where: { tenantId: t, removedAt: null, isActive: true }, select: { id: true } }) },
  { key: 'queues', entityType: 'queue', load: (p, t) => p.v3Queue.findMany({ where: { tenantId: t, removedAt: null, isActive: true }, select: { id: true } }) },
  { key: 'businessHours', entityType: 'business_hours', load: (p, t) => p.v3BusinessHoursSchedule.findMany({ where: { tenantId: t, removedAt: null, isDefault: true }, select: { id: true } }) },
  { key: 'voicemail', entityType: 'voicemail', load: (p, t) => p.v3VoicemailBox.findMany({ where: { tenantId: t, removedAt: null, isActive: true }, select: { id: true } }) },
  { key: 'callFlows', entityType: 'call_flow', load: (p, t) => p.v3CallFlow.findMany({ where: { tenantId: t, removedAt: null, status: 'PUBLISHED' }, select: { id: true } }) },
  { key: 'extensions', entityType: 'extension', load: (p, t) => p.extension.findMany({ where: { tenantId: t, status: 'ACTIVE' }, select: { id: true } }) },
  { key: 'numbers', entityType: 'number', load: (p, t) => p.phoneNumber.findMany({ where: { tenantId: t, isActive: { not: false } }, select: { id: true } }) },
  { key: 'deskPhones', entityType: 'device', load: (p, t) => p.v3DeskDevice.findMany({ where: { tenantId: t, removedAt: null }, select: { id: true } }) },
];

function worstLevel(levels) {
  if (levels.includes('red')) return 'red';
  if (levels.includes('yellow')) return 'yellow';
  return 'green';
}

function makeIssue(level, code, message, meta = {}) {
  return { level, code, message, ...meta };
}

async function assertTenant(prisma, tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, isActive: true } });
  if (!tenant) {
    throw Object.assign(new Error('Organization not found'), { status: 404, code: 'TENANT_NOT_FOUND' });
  }
  return tenant;
}

async function createWizardRun(prisma, tenantId, data) {
  return prisma.v3MigrationRun.create({
    data: {
      id: randomUUID(),
      tenantId,
      runType: RUN_TYPE,
      status: data.status || 'PREVIEW',
      dryRun: data.dryRun !== false,
      targetTenantIds: [tenantId],
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

async function countMissingRuntimeLinks(prisma, tenantId) {
  let total = 0;
  const byDomain = {};
  for (const domain of RUNTIME_ENTITY_MAP) {
    const rows = await domain.load(prisma, tenantId);
    let missing = 0;
    for (const row of rows) {
      const link = await runtimeAdapter.getLink(prisma, tenantId, domain.entityType, row.id);
      if (!link) missing += 1;
    }
    byDomain[domain.key] = missing;
    total += missing;
  }
  const holidayLink = await runtimeAdapter.getLink(prisma, tenantId, 'holiday', tenantId);
  if (!holidayLink) {
    byDomain.holidays = 1;
    total += 1;
  } else {
    byDomain.holidays = 0;
  }
  return { total, byDomain };
}

async function discovery(prisma, tenantId) {
  await assertTenant(prisma, tenantId);

  const [
    config,
    runtimeLinks,
    backups,
    license,
    healthSummary,
    legacyRingGroups,
  ] = await Promise.all([
    backupService.collectConfiguration(prisma, tenantId),
    prisma.v3RuntimeLink.findMany({ where: { tenantId }, orderBy: { v3EntityType: 'asc' } }),
    backupService.listBackups(prisma, tenantId, { limit: 10 }),
    licenseService.getLicense(prisma, tenantId),
    healthCheckService.tenantHealthSummary(prisma, tenantId),
    prisma.ringGroup.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true, extensionNumber: true } }),
  ]);

  const counts = backupService.countItems(config);
  const dids = (config.phoneNumbers || []).map((p) => ({
    id: p.id,
    number: p.number,
    extensionId: p.extensionId,
    routingType: p.routingType,
  }));

  return {
    readOnly: true,
    tenantId,
    tenant: config.settings?.tenant || null,
    inventory: {
      employees: config.employees || [],
      extensions: config.extensions || [],
      numbers: config.phoneNumbers || [],
      dids,
      ringGroups: config.pbx?.ringGroups || [],
      queues: config.pbx?.queues || [],
      voicemail: config.pbx?.voicemailBoxes || [],
      businessHours: config.pbx?.businessHours || [],
      holidays: config.pbx?.holidays || [],
      greetings: config.settings?.greeting ? [config.settings.greeting] : [],
      callFlows: config.callFlows || [],
      deskPhones: config.deskPhones || [],
      softphoneProfiles: config.softphone?.profiles || [],
      pbxObjects: {
        legacyRingGroups: legacyRingGroups,
        v3RingGroups: counts.ringGroups,
        v3Queues: counts.queues,
      },
      runtimeLinks,
      backups: backups.items,
      license,
      health: healthSummary,
    },
    counts: {
      ...counts,
      runtimeLinks: runtimeLinks.length,
      backups: backups.total,
      greetings: config.settings?.greeting ? 1 : 0,
      legacyRingGroups: legacyRingGroups.length,
    },
    generatedAt: new Date().toISOString(),
  };
}

function findDuplicates(items, keyFn) {
  const seen = new Map();
  const dupes = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (seen.has(key)) {
      dupes.push({ key, ids: [seen.get(key), item.id] });
    } else {
      seen.set(key, item.id);
    }
  }
  return dupes;
}

async function validate(prisma, tenantId) {
  await assertTenant(prisma, tenantId);

  const issues = [];
  const [
    users,
    extensions,
    phoneNumbers,
    v3RingGroups,
    v3Queues,
    v3Voicemail,
    v3BusinessHours,
    v3Holidays,
    callFlows,
    runtimeValidation,
    repairAnalysis,
    numberAnalysis,
    missingLinks,
  ] = await Promise.all([
    prisma.user.findMany({ where: { tenantId, role: 'TENANT_USER' }, include: { extensions: true } }),
    prisma.extension.findMany({ where: { tenantId, status: 'ACTIVE' }, include: { user: true, primaryPhoneNumber: true, voicemailSettings: true } }),
    prisma.phoneNumber.findMany({ where: { tenantId } }),
    prisma.v3RingGroup.findMany({ where: { tenantId, removedAt: null, isActive: true } }),
    prisma.v3Queue.findMany({ where: { tenantId, removedAt: null, isActive: true } }),
    prisma.v3VoicemailBox.findMany({ where: { tenantId, removedAt: null, isActive: true } }),
    prisma.v3BusinessHoursSchedule.findMany({ where: { tenantId, removedAt: null, isDefault: true } }),
    prisma.v3Holiday.findMany({ where: { tenantId, removedAt: null } }),
    prisma.v3CallFlow.findMany({ where: { tenantId, removedAt: null } }),
    runtimeValidationService.getValidationReport(prisma, tenantId),
    repairService.analyze(prisma, tenantId),
    repairService.analyzeNumbers(prisma, tenantId),
    countMissingRuntimeLinks(prisma, tenantId),
  ]);

  for (const user of users) {
    if (!user.extensions?.length) {
      issues.push(makeIssue('red', 'MISSING_EXTENSION', `Employee ${user.email || user.name} has no extension`, { userId: user.id }));
    }
    if (!user.telnyxCredentialId) {
      issues.push(makeIssue('yellow', 'MISSING_CREDENTIAL', `Employee ${user.email || user.name} missing Telnyx credential`, { userId: user.id }));
    }
    if (!user.telnyxSipUsername) {
      issues.push(makeIssue('yellow', 'MISSING_SIP_USERNAME', `Employee ${user.email || user.name} missing SIP username`, { userId: user.id }));
    }
  }

  for (const ext of extensions) {
    if (!ext.userId) {
      issues.push(makeIssue('yellow', 'EXTENSION_WITHOUT_USER', `Extension ${ext.extensionNumber} has no assigned user`, { extensionId: ext.id }));
    }
    if (ext.userId && !ext.user) {
      issues.push(makeIssue('red', 'BROKEN_USER_REF', `Extension ${ext.extensionNumber} references missing user`, { extensionId: ext.id }));
    }
    if (!ext.primaryPhoneNumberId && !phoneNumbers.some((p) => p.extensionId === ext.id)) {
      issues.push(makeIssue('yellow', 'EXTENSION_WITHOUT_DID', `Extension ${ext.extensionNumber} has no DID`, { extensionId: ext.id }));
    }
    if (!ext.voicemailSettings) {
      issues.push(makeIssue('yellow', 'MISSING_VOICEMAIL', `Extension ${ext.extensionNumber} missing voicemail settings`, { extensionId: ext.id }));
    }
  }

  for (const phone of phoneNumbers) {
    if (phone.extensionId) {
      const ext = extensions.find((e) => e.id === phone.extensionId);
      if (!ext) {
        issues.push(makeIssue('red', 'BROKEN_DID_OWNERSHIP', `Number ${phone.number} links to missing extension`, { phoneNumberId: phone.id }));
      } else if (ext.tenantId !== tenantId) {
        issues.push(makeIssue('red', 'BROKEN_DID_OWNERSHIP', `Number ${phone.number} extension tenant mismatch`, { phoneNumberId: phone.id }));
      }
    }
  }

  if (!v3RingGroups.length) {
    issues.push(makeIssue('yellow', 'MISSING_RING_GROUP', 'No active V3 ring groups'));
  }
  if (!v3Queues.length) {
    issues.push(makeIssue('yellow', 'MISSING_QUEUE', 'No active V3 queues'));
  }
  if (!v3Voicemail.length) {
    issues.push(makeIssue('yellow', 'MISSING_VOICEMAIL_BOX', 'No active V3 voicemail boxes'));
  }
  if (!v3BusinessHours.length) {
    issues.push(makeIssue('yellow', 'MISSING_BUSINESS_HOURS', 'No default business hours schedule'));
  }
  if (!v3Holidays.length) {
    issues.push(makeIssue('yellow', 'MISSING_HOLIDAY', 'No V3 holidays configured'));
  }

  if (missingLinks.total > 0) {
    issues.push(makeIssue('yellow', 'BROKEN_RUNTIME_LINKS', `${missingLinks.total} object(s) missing runtime links`, { missingLinks }));
  }

  for (const dupe of findDuplicates(extensions, (e) => e.extensionNumber)) {
    issues.push(makeIssue('red', 'DUPLICATE_EXTENSION', `Duplicate extension number ${dupe.key}`, dupe));
  }
  for (const dupe of findDuplicates(phoneNumbers, (p) => p.number)) {
    issues.push(makeIssue('red', 'DUPLICATE_NUMBER', `Duplicate phone number ${dupe.key}`, dupe));
  }
  for (const dupe of findDuplicates(users, (u) => u.email?.toLowerCase())) {
    issues.push(makeIssue('red', 'DUPLICATE_USER', `Duplicate user email ${dupe.key}`, dupe));
  }

  for (const flow of callFlows.filter((f) => f.status === 'PUBLISHED')) {
    const flowValidation = await callFlowValidationService.validateFlow(prisma, tenantId, flow.definition);
    for (const err of (flowValidation.errors || [])) {
      issues.push(makeIssue('red', 'CALL_FLOW_INVALID_REF', err.message || err.code, { callFlowId: flow.id, nodeId: err.nodeId }));
    }
    for (const warn of (flowValidation.warnings || [])) {
      issues.push(makeIssue('yellow', 'CALL_FLOW_WARNING', warn.message || warn.code, { callFlowId: flow.id, nodeId: warn.nodeId }));
    }
  }

  for (const change of repairAnalysis.changes) {
    issues.push(makeIssue('yellow', change.type, `${change.entity} ${change.ref}: ${change.detail}`));
  }
  for (const change of numberAnalysis.changes) {
    issues.push(makeIssue('yellow', change.type, `${change.entity} ${change.ref}: ${change.detail}`));
  }

  if (runtimeValidation.overall === 'red') {
    issues.push(makeIssue('red', 'RUNTIME_VALIDATION_RED', 'Runtime validation reported blocking errors'));
  }

  const grouped = {
    green: issues.filter((i) => i.level === 'green'),
    yellow: issues.filter((i) => i.level === 'yellow'),
    red: issues.filter((i) => i.level === 'red'),
  };
  const overall = worstLevel(issues.map((i) => i.level).concat(runtimeValidation.overall === 'green' ? [] : [runtimeValidation.overall]));

  return {
    readOnly: true,
    tenantId,
    overall,
    issues,
    grouped,
    summary: {
      total: issues.length,
      red: grouped.red.length,
      yellow: grouped.yellow.length,
      green: grouped.green.length,
      runtimeValidation: runtimeValidation.overall,
      repairChanges: repairAnalysis.changes.length,
      numberChanges: numberAnalysis.changes.length,
      missingRuntimeLinks: missingLinks.total,
    },
    runtimeValidation,
    generatedAt: new Date().toISOString(),
  };
}

function mapRepairToPreviewActions(repairAnalysis, numberAnalysis) {
  const actions = {
    employees: { create: 0, update: 0 },
    extensions: { create: 0, update: 0 },
    numbers: { assign: 0, update: 0 },
    ringGroups: { create: 0, update: 0 },
    queues: { create: 0, update: 0 },
    voicemail: { create: 0, update: 0 },
    businessHours: { create: 0, update: 0 },
    holidays: { create: 0, update: 0 },
    runtimeLinks: { create: 0, update: 0 },
  };

  const allChanges = [...repairAnalysis.changes, ...numberAnalysis.changes];
  for (const change of allChanges) {
    switch (change.type) {
      case 'MISSING_EXTENSION':
        actions.extensions.create += 1;
        break;
      case 'MISSING_VOICEMAIL':
      case 'MISSING_SECURITY':
      case 'MISSING_FORWARDING':
      case 'MISSING_CREDENTIAL':
      case 'MISSING_DID_LINK':
      case 'MISSING_PRIMARY_DID':
      case 'BROKEN_LINK':
        actions.extensions.update += 1;
        break;
      case 'MISSING_EXTENSION_LINK':
      case 'BROKEN_EMPLOYEE_LINK':
      case 'BROKEN_EXTENSION_LINK':
        actions.numbers.assign += 1;
        break;
      default:
        actions.numbers.update += 1;
        break;
    }
  }

  return actions;
}

async function preview(prisma, tenantId) {
  const [validation, repairAnalysis, numberAnalysis, missingLinks, inventory] = await Promise.all([
    validate(prisma, tenantId),
    repairService.analyze(prisma, tenantId),
    repairService.analyzeNumbers(prisma, tenantId),
    countMissingRuntimeLinks(prisma, tenantId),
    discovery(prisma, tenantId),
  ]);

  const actions = mapRepairToPreviewActions(repairAnalysis, numberAnalysis);
  actions.runtimeLinks.create = missingLinks.total;
  actions.ringGroups.update = inventory.counts.ringGroups || 0;
  actions.queues.update = inventory.counts.queues || 0;
  actions.employees.update = inventory.counts.employees || 0;
  actions.extensions.update = Math.max(actions.extensions.update, inventory.counts.extensions || 0);

  return {
    readOnly: true,
    dryRun: true,
    tenantId,
    inventory: inventory.counts,
    actions,
    missingRuntimeLinks: missingLinks,
    validation: {
      overall: validation.overall,
      summary: validation.summary,
      red: validation.grouped.red,
      yellow: validation.grouped.yellow.slice(0, 50),
    },
    repairPreview: {
      pbx: repairAnalysis.changes.map((c) => ({ type: c.type, entity: c.entity, ref: c.ref, detail: c.detail })),
      numbers: numberAnalysis.changes.map((c) => ({ type: c.type, entity: c.entity, ref: c.ref, detail: c.detail })),
      observations: [...repairAnalysis.observations, ...numberAnalysis.observations],
    },
    warnings: validation.overall === 'red'
      ? ['Blocking validation issues must be resolved before migration.']
      : ['Migration preview is read-only. No changes applied.'],
    generatedAt: new Date().toISOString(),
  };
}

async function postValidation(prisma, tenantId) {
  const [
    healthCenter,
    runtimeValidation,
    runtimeHealth,
    productionHealth,
    diagnostics,
  ] = await Promise.all([
    healthCheckService.employeeHealth(prisma, tenantId),
    runtimeValidationService.getValidationReport(prisma, tenantId),
    runtimeHealthService.getRuntimeHealth(prisma, tenantId),
    productionHealthService.getProductionHealth(prisma, tenantId),
    diagnosticsService.getDiagnostics(prisma, tenantId),
  ]);

  const employeeLevels = (healthCenter.employees || []).map((e) => e.overall);
  const healthOverall = employeeLevels.length ? worstLevel(employeeLevels) : 'green';
  const hasRedDomain = runtimeValidation.domains.some((d) => d.level === 'red');
  const hasCritical = productionHealth.criticalIssues.length > 0 || diagnostics.issues.some((i) => i.severity === 'critical');
  const pass = !hasRedDomain && !hasCritical && productionHealth.overall !== 'red';

  return {
    pass: pass ? 'PASS' : 'FAIL',
    healthCenter: {
      overall: healthOverall,
      employees: healthCenter.employees,
      readiness: healthCenter.readiness,
    },
    runtimeValidation,
    runtimeHealth,
    productionHealth,
    diagnostics,
    generatedAt: new Date().toISOString(),
  };
}

async function runMigration(prisma, tenantId, { req, dryRun = false, autoRollback = true } = {}) {
  await assertTenant(prisma, tenantId);
  const startedAt = new Date();

  let run = await createWizardRun(prisma, tenantId, {
    status: 'RUNNING',
    dryRun,
    startedAt,
    createdByUserId: req?.user?.sub || null,
  });

  const steps = [];

  try {
    const preValidation = await validate(prisma, tenantId);
    steps.push({ step: 'validate', ok: preValidation.overall !== 'red', overall: preValidation.overall });
    if (preValidation.overall === 'red' && !dryRun) {
      throw Object.assign(new Error('Pre-migration validation failed with blocking errors'), { status: 400, code: 'VALIDATION_FAILED', details: preValidation });
    }

    let backup = null;
    if (!dryRun) {
      backup = await backupService.createBackup(prisma, tenantId, {
        label: `Pre-migration wizard ${startedAt.toISOString()}`,
      }, { req });
      steps.push({ step: 'backup', ok: true, backupId: backup.id });
    } else {
      steps.push({ step: 'backup', ok: true, skipped: true, reason: 'dry_run' });
    }

    const repairResult = await repairService.repair(prisma, tenantId, { apply: !dryRun });
    const numberRepair = await repairService.repairNumbers(prisma, tenantId, { apply: !dryRun });
    steps.push({
      step: 'repair',
      ok: true,
      mode: dryRun ? 'dry-run' : 'apply',
      pbxApplied: repairResult.applied?.length || 0,
      numbersApplied: numberRepair.applied?.length || 0,
    });

    let runtimeRepair = null;
    let syncResult = null;
    if (!dryRun && isRuntimeSyncEnabledForTenant(tenantId)) {
      runtimeRepair = await runtimeSyncService.repairRuntime(prisma, tenantId, { req });
      syncResult = await runtimeSyncService.resyncAll(prisma, tenantId, { req });
      steps.push({ step: 'runtime_sync', ok: true, repairs: runtimeRepair.count, enqueued: syncResult.enqueued });
    } else {
      steps.push({
        step: 'runtime_sync',
        ok: true,
        skipped: true,
        reason: dryRun ? 'dry_run' : 'runtime_sync_disabled',
      });
    }

    const postCheck = await postValidation(prisma, tenantId);
    steps.push({ step: 'post_validation', ok: postCheck.pass === 'PASS', pass: postCheck.pass });

    let rollbackResult = null;
    if (!dryRun && autoRollback && postCheck.pass === 'FAIL' && backup?.id) {
      rollbackResult = await rollbackService.rollbackExecute(prisma, tenantId, {
        backupId: backup.id,
        dryRun: false,
        req,
      });
      steps.push({ step: 'auto_rollback', ok: true, backupId: backup.id });
    }

    const report = {
      executedAt: new Date().toISOString(),
      dryRun,
      steps,
      preValidation: { overall: preValidation.overall, summary: preValidation.summary },
      repair: { pbx: repairResult, numbers: numberRepair },
      runtimeRepair,
      syncResult,
      postValidation: postCheck,
      rollback: rollbackResult,
      backupId: backup?.id || null,
    };

    const finalStatus = dryRun
      ? 'VALIDATED'
      : (postCheck.pass === 'PASS' ? 'SUCCESS' : (rollbackResult ? 'ROLLED_BACK' : 'FAILED'));

    run = await prisma.v3MigrationRun.update({
      where: { id: run.id },
      data: {
        status: finalStatus,
        dryRun,
        backupId: backup?.id || null,
        rollbackBackupId: rollbackResult ? backup?.id : null,
        preview: await preview(prisma, tenantId).catch(() => null),
        validation: preValidation,
        result: { repair: repairResult, numbers: numberRepair, syncResult, postCheck },
        report,
        finishedAt: new Date(),
      },
    });

    await auditService.log(prisma, req, {
      action: dryRun ? 'v3.migration_wizard.dry_run' : 'v3.migration_wizard.executed',
      entityType: 'V3MigrationRun',
      entityId: run.id,
      newValue: { status: finalStatus, pass: postCheck.pass, backupId: backup?.id },
      extra: { tenantId },
    });

    return { run, report, postValidation: postCheck };
  } catch (error) {
    run = await prisma.v3MigrationRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        result: { error: error.message, steps },
        finishedAt: new Date(),
      },
    }).catch(() => run);

    await auditService.log(prisma, req, {
      action: 'v3.migration_wizard.failed',
      entityType: 'V3MigrationRun',
      entityId: run?.id,
      newValue: { error: error.message },
      extra: { tenantId },
    });

    throw error;
  }
}

async function rollbackMigration(prisma, tenantId, { migrationRunId, backupId, dryRun = false, req } = {}) {
  let targetBackupId = backupId;
  if (migrationRunId) {
    const run = await prisma.v3MigrationRun.findFirst({
      where: { id: migrationRunId, tenantId, runType: RUN_TYPE },
    });
    if (!run?.backupId) {
      throw Object.assign(new Error('Migration wizard run has no pre-migration backup'), { status: 400 });
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
    action: dryRun ? 'v3.migration_wizard.rollback.preview' : 'v3.migration_wizard.rollback.executed',
    entityType: 'V3MigrationRun',
    entityId: migrationRunId || targetBackupId,
    newValue: { backupId: targetBackupId, dryRun },
    extra: { tenantId },
  });

  return {
    readOnly: dryRun,
    backupId: targetBackupId,
    result,
    report: {
      rolledBackAt: new Date().toISOString(),
      dryRun,
      backupId: targetBackupId,
      summary: result.report || result.preview?.preview?.summary,
    },
  };
}

module.exports = {
  RUN_TYPE,
  discovery,
  validate,
  preview,
  runMigration,
  postValidation,
  rollbackMigration,
  countMissingRuntimeLinks,
};
