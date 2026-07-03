/**
 * V3 Tenant Lifecycle Service — reversible tenant state management (no destructive ops).
 */

const auditService = require('./auditService');
const backupService = require('./backupService');

async function getLifecycle(prisma, tenantId) {
  const [tenant, latestBackup, backupCount] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.v3TenantBackup.findFirst({
      where: { tenantId, removedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true, createdAt: true, itemCounts: true },
    }),
    prisma.v3TenantBackup.count({ where: { tenantId, removedAt: null } }),
  ]);

  if (!tenant) {
    throw Object.assign(new Error('Organization not found'), { status: 404 });
  }

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      isActive: tenant.isActive,
      billingStatus: tenant.billingStatus,
      billingGraceUntil: tenant.billingGraceUntil,
    },
    status: tenant.isActive ? 'active' : (tenant.billingStatus === 'SUSPENDED' ? 'suspended' : 'inactive'),
    backup: {
      count: backupCount,
      latest: latestBackup,
    },
    actions: {
      canSnapshot: true,
      canBackup: true,
      canRestorePreview: backupCount > 0,
      canExport: true,
      canImport: true,
      canArchive: tenant.isActive,
      canDeactivate: tenant.isActive,
      canReactivate: !tenant.isActive,
      canClonePreview: true,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function createSnapshot(prisma, tenantId, options, ctx) {
  return backupService.createBackup(prisma, tenantId, { ...options, backupType: 'snapshot' }, ctx);
}

async function clonePreview(prisma, tenantId) {
  const payload = await backupService.collectConfiguration(prisma, tenantId);
  const counts = backupService.countItems(payload);
  return {
    preview: true,
    sourceTenantId: tenantId,
    itemCounts: counts,
    note: 'Clone creates a new tenant in a future phase. Preview only — no tenant duplication in this release.',
  };
}

async function setTenantActive(prisma, tenantId, isActive, action, { req } = {}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw Object.assign(new Error('Organization not found'), { status: 404 });
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { isActive },
  });

  await auditService.log(prisma, req, {
    action: `v3.lifecycle.${action}`,
    entityType: 'Tenant',
    entityId: tenantId,
    oldValue: { isActive: tenant.isActive },
    newValue: { isActive },
  });

  return getLifecycle(prisma, tenantId);
}

async function archiveTenant(prisma, tenantId, ctx) {
  return setTenantActive(prisma, tenantId, false, 'archived', ctx);
}

async function deactivateTenant(prisma, tenantId, ctx) {
  return setTenantActive(prisma, tenantId, false, 'deactivated', ctx);
}

async function reactivateTenant(prisma, tenantId, ctx) {
  return setTenantActive(prisma, tenantId, true, 'reactivated', ctx);
}

module.exports = {
  getLifecycle,
  createSnapshot,
  clonePreview,
  archiveTenant,
  deactivateTenant,
  reactivateTenant,
};
