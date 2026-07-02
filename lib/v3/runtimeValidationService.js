/**
 * V3 Runtime Validation Service — read-only verification (no data modifications).
 */

const runtimeSyncService = require('./runtime/runtimeSyncService');
const healthCheckService = require('./healthCheckService');
const { isRuntimeSyncEnabledForTenant } = require('./runtime/runtimeFeatureFlag');

const DOMAINS = [
  { key: 'employees', entityType: null, load: (p, t) => p.user.count({ where: { tenantId: t, role: 'TENANT_USER' } }) },
  { key: 'extensions', entityType: 'extension', load: (p, t) => p.extension.findMany({ where: { tenantId: t, status: 'ACTIVE' }, select: { id: true } }) },
  { key: 'numbers', entityType: 'number', load: (p, t) => p.phoneNumber.findMany({ where: { tenantId: t, isActive: { not: false } }, select: { id: true } }) },
  { key: 'ringGroups', entityType: 'ring_group', load: (p, t) => p.v3RingGroup.findMany({ where: { tenantId: t, removedAt: null, isActive: true }, select: { id: true } }) },
  { key: 'queues', entityType: 'queue', load: (p, t) => p.v3Queue.findMany({ where: { tenantId: t, removedAt: null, isActive: true }, select: { id: true } }) },
  { key: 'callFlows', entityType: 'call_flow', load: (p, t) => p.v3CallFlow.findMany({ where: { tenantId: t, removedAt: null, status: 'PUBLISHED' }, select: { id: true } }) },
  { key: 'voicemail', entityType: 'voicemail', load: (p, t) => p.v3VoicemailBox.findMany({ where: { tenantId: t, removedAt: null, isActive: true }, select: { id: true } }) },
  { key: 'businessHours', entityType: 'business_hours', load: (p, t) => p.v3BusinessHoursSchedule.findMany({ where: { tenantId: t, removedAt: null, isDefault: true }, select: { id: true } }) },
  { key: 'deskPhones', entityType: 'device', load: (p, t) => p.v3DeskDevice.findMany({ where: { tenantId: t, removedAt: null }, select: { id: true } }) },
];

function worstLevel(levels) {
  if (levels.includes('red')) return 'red';
  if (levels.includes('yellow')) return 'yellow';
  return 'green';
}

async function validateDomain(prisma, tenantId, domain, rows) {
  if (domain.key === 'employees') {
    const health = await healthCheckService.tenantHealthSummary(prisma, tenantId);
    const level = health.errors > 0 ? 'red' : (health.warnings > 0 ? 'yellow' : 'green');
    return {
      domain: domain.key,
      total: rows,
      passed: level === 'green' ? rows : Math.max(0, rows - health.errors),
      warnings: health.warnings,
      errors: health.errors,
      level,
      readOnly: true,
    };
  }

  if (!domain.entityType || !rows.length) {
    return {
      domain: domain.key,
      total: Array.isArray(rows) ? rows.length : rows,
      passed: Array.isArray(rows) ? rows.length : rows,
      warnings: 0,
      errors: 0,
      level: 'green',
      readOnly: true,
      skippedRuntimeCompare: !domain.entityType,
    };
  }

  const adapter = runtimeSyncService.getAdapter(domain.entityType);
  const checks = await Promise.all(
    rows.map(async (row) => adapter.compare(prisma, tenantId, row.id)),
  );
  const levels = checks.map((c) => c.level);
  return {
    domain: domain.key,
    total: rows.length,
    passed: checks.filter((c) => c.level === 'green').length,
    warnings: checks.filter((c) => c.level === 'yellow').length,
    errors: checks.filter((c) => c.level === 'red').length,
    level: worstLevel(levels),
    items: checks,
    readOnly: true,
  };
}

async function getValidationReport(prisma, tenantId) {
  const [domainResults, links, jobs, provisioning] = await Promise.all([
    Promise.all(DOMAINS.map(async (d) => {
      const rows = await d.load(prisma, tenantId);
      return validateDomain(prisma, tenantId, d, rows);
    })),
    prisma.v3RuntimeLink.count({ where: { tenantId } }),
    prisma.v3RuntimeSyncJob.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
    }),
    prisma.extension.findMany({
      where: { tenantId, status: 'ACTIVE', userId: { not: null } },
      select: { id: true, user: { select: { telnyxCredentialId: true } } },
    }),
  ]);

  const unprovisioned = provisioning.filter((e) => e.user && !e.user.telnyxCredentialId).length;
  const jobMap = Object.fromEntries(jobs.map((j) => [j.status, j._count]));
  const levels = domainResults.map((d) => d.level);
  if (unprovisioned > 0) levels.push('yellow');

  return {
    readOnly: true,
    runtimeSyncEnabled: isRuntimeSyncEnabledForTenant(tenantId),
    overall: worstLevel(levels),
    domains: domainResults,
    runtimeLinks: { total: links },
    syncJobs: jobMap,
    provisioning: {
      extensionsWithEmployees: provisioning.length,
      missingCredentials: unprovisioned,
      level: unprovisioned ? 'yellow' : 'green',
    },
    generatedAt: new Date().toISOString(),
  };
}

async function runValidation(prisma, tenantId, { req } = {}) {
  const auditService = require('./auditService');
  const report = await getValidationReport(prisma, tenantId);
  await auditService.log(prisma, req, {
    action: 'v3.validation.completed',
    entityType: 'Tenant',
    entityId: tenantId,
    newValue: { overall: report.overall, domains: report.domains.map((d) => ({ domain: d.domain, level: d.level })) },
  });
  return report;
}

module.exports = {
  getValidationReport,
  runValidation,
  DOMAINS,
};
