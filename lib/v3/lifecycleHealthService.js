/**
 * V3 Lifecycle Health — billing, license, storage, backup domain checks.
 */

const billingService = require('./billingService');
const licenseService = require('./licenseService');
const storageService = require('./storageService');
const backupService = require('./backupService');

async function getLifecycleHealth(prisma, tenantId) {
  const [billing, license, storage, backups] = await Promise.all([
    billingService.getBillingOverview(prisma, tenantId),
    licenseService.getLicense(prisma, tenantId),
    storageService.getStorageUsage(prisma, tenantId),
    backupService.listBackups(prisma, tenantId, { limit: 1 }),
  ]);

  const backupStatus = backups.total > 0 ? 'green' : 'yellow';
  const billingLevel = license.health.billing;
  const licenseLevel = license.warnings.some((w) => w.severity === 'error') ? 'red'
    : (license.warnings.length ? 'yellow' : 'green');
  const storageLevel = storage.totalEstimatedMb > 5000 ? 'yellow' : 'green';
  const subscriptionLevel = billing.plan.billingStatus === 'ACTIVE' ? 'green'
    : (billing.plan.billingStatus === 'GRACE' ? 'yellow' : 'red');

  return {
    license: { level: licenseLevel, warnings: license.warnings.length, utilization: license.utilization },
    storage: { level: storageLevel, totalEstimatedMb: storage.totalEstimatedMb },
    backup: { level: backupStatus, count: backups.total, latest: backups.items[0]?.createdAt || null },
    subscription: { level: subscriptionLevel, renewalDate: billing.renewalDate },
    billing: { level: billingLevel, status: billing.plan.billingStatus },
    overall: [licenseLevel, storageLevel, backupStatus, subscriptionLevel, billingLevel].includes('red') ? 'red'
      : ([licenseLevel, storageLevel, backupStatus, subscriptionLevel, billingLevel].includes('yellow') ? 'yellow' : 'green'),
  };
}

module.exports = {
  getLifecycleHealth,
};
