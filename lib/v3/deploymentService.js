/**
 * V3 Deployment Service — read-only production deployment readiness snapshot.
 */

const { isV3PortalEnabled } = require('./featureFlag');
const { isV3RuntimeSyncEnabled, getTenantAllowlist } = require('./runtime/runtimeFeatureFlag');

function parseEnvBool(name) {
  const v = String(process.env[name] || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

async function getDeploymentStatus(prisma, tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, isActive: true, timezone: true, updatedAt: true },
  });
  if (!tenant) {
    throw Object.assign(new Error('Organization not found'), { status: 404 });
  }

  const [pendingMigrations, latestBackup] = await Promise.all([
    prisma.v3MigrationRun.count({
      where: { tenantId, status: { in: ['PREVIEW', 'VALIDATED', 'RUNNING'] } },
    }),
    prisma.v3TenantBackup.findFirst({
      where: { tenantId, removedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, label: true },
    }),
  ]);

  return {
    tenant: { id: tenant.id, name: tenant.name, isActive: tenant.isActive },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      v3PortalEnabled: isV3PortalEnabled(),
      runtimeSyncEnabled: isV3RuntimeSyncEnabled(),
      runtimeSyncAllowlist: getTenantAllowlist() ? [...getTenantAllowlist()] : null,
      webOrigin: process.env.WEB_ORIGIN || null,
      apiPublicUrl: process.env.API_PUBLIC_URL || null,
    },
    readiness: {
      portalEnabled: isV3PortalEnabled(),
      tenantActive: tenant.isActive,
      hasRecentBackup: Boolean(latestBackup),
      pendingMigrations,
    },
    latestBackup: latestBackup || null,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getDeploymentStatus,
  parseEnvBool,
};
