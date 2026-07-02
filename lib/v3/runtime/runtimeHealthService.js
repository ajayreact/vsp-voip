/**
 * V3 Runtime Health Service — per-domain sync health for dashboard.
 */

const runtimeSyncService = require('./runtimeSyncService');
const { isRuntimeSyncEnabledForTenant } = require('./runtimeFeatureFlag');

function levelFromCheck(check) {
  return check?.level || 'yellow';
}

function worstLevel(levels) {
  if (levels.includes('red')) return 'red';
  if (levels.includes('yellow')) return 'yellow';
  return 'green';
}

async function compareAll(prisma, tenantId, entityType, rows, idField = 'id') {
  const adapter = runtimeSyncService.getAdapter(entityType);
  const checks = await Promise.all(
    rows.map(async (row) => {
      const check = await adapter.compare(prisma, tenantId, row[idField]);
      return { id: row[idField], ...check };
    }),
  );
  const levels = checks.map((c) => c.level);
  return {
    entityType,
    total: rows.length,
    synced: checks.filter((c) => c.level === 'green').length,
    warnings: checks.filter((c) => c.level === 'yellow').length,
    errors: checks.filter((c) => c.level === 'red').length,
    level: rows.length ? worstLevel(levels) : 'green',
    items: checks,
  };
}

async function getRuntimeHealth(prisma, tenantId) {
  const enabled = isRuntimeSyncEnabledForTenant(tenantId);

  const [
    ringGroups,
    queues,
    schedules,
    voicemails,
    flows,
    extensions,
    numbers,
    devices,
    status,
  ] = await Promise.all([
    prisma.v3RingGroup.findMany({ where: { tenantId, removedAt: null, isActive: true }, select: { id: true } }),
    prisma.v3Queue.findMany({ where: { tenantId, removedAt: null, isActive: true }, select: { id: true } }),
    prisma.v3BusinessHoursSchedule.findMany({ where: { tenantId, removedAt: null, isDefault: true }, select: { id: true } }),
    prisma.v3VoicemailBox.findMany({ where: { tenantId, removedAt: null, isActive: true }, select: { id: true } }),
    prisma.v3CallFlow.findMany({ where: { tenantId, removedAt: null, status: 'PUBLISHED' }, select: { id: true } }),
    prisma.extension.findMany({ where: { tenantId, status: 'ACTIVE' }, select: { id: true } }),
    prisma.phoneNumber.findMany({ where: { tenantId, isActive: { not: false } }, select: { id: true } }),
    prisma.v3DeskDevice.findMany({ where: { tenantId, removedAt: null }, select: { id: true } }),
    runtimeSyncService.getStatus(prisma, tenantId),
  ]);

  const domains = enabled
    ? await Promise.all([
      compareAll(prisma, tenantId, 'ring_group', ringGroups),
      compareAll(prisma, tenantId, 'queue', queues),
      compareAll(prisma, tenantId, 'business_hours', schedules),
      runtimeSyncService.getAdapter('holiday').compare(prisma, tenantId).then((check) => ({
        entityType: 'holiday',
        total: 1,
        synced: check.level === 'green' ? 1 : 0,
        warnings: check.level === 'yellow' ? 1 : 0,
        errors: check.level === 'red' ? 1 : 0,
        level: check.level,
        items: [check],
      })),
      compareAll(prisma, tenantId, 'voicemail', voicemails),
      compareAll(prisma, tenantId, 'call_flow', flows),
      compareAll(prisma, tenantId, 'extension', extensions),
      compareAll(prisma, tenantId, 'number', numbers),
      compareAll(prisma, tenantId, 'device', devices),
    ])
    : [];

  const domainMap = {
    runtimeReady: enabled ? (status.jobs.deadLetter ? 'red' : (status.jobs.failed ? 'yellow' : 'green')) : 'yellow',
    callFlowSynced: domains[5]?.level || 'yellow',
    ringGroupsSynced: domains[0]?.level || 'yellow',
    queuesSynced: domains[1]?.level || 'yellow',
    extensionsSynced: domains[6]?.level || 'yellow',
    numbersSynced: domains[7]?.level || 'yellow',
    devicesSynced: domains[8]?.level || 'yellow',
    voicemailSynced: domains[4]?.level || 'yellow',
    businessHoursSynced: domains[2]?.level || 'yellow',
    holidaySynced: domains[3]?.level || 'yellow',
  };

  const overall = worstLevel(Object.values(domainMap));

  return {
    enabled,
    overall,
    domains: domainMap,
    details: domains,
    status,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { getRuntimeHealth, compareAll, worstLevel };
