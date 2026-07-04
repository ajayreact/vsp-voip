/**
 * V3 License Service — seat/number limits, warnings, expiration (read-only + warnings).
 */

const { getTenantQuotaLimits } = require('../quotaService');
const subscriptionService = require('./subscriptionService');

function licenseLevel(utilization) {
  if (utilization >= 100) return 'red';
  if (utilization >= 85) return 'yellow';
  return 'green';
}

async function getLicense(prisma, tenantId) {
  const [tenant, limits, subscription, seats, extensions, numbers] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    getTenantQuotaLimits(prisma, tenantId),
    subscriptionService.getSubscription(prisma, tenantId),
    prisma.user.count({ where: { tenantId, role: 'TENANT_USER' } }),
    prisma.extension.count({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.phoneNumber.count({ where: { tenantId, isActive: { not: false } } }),
  ]);

  if (!tenant) {
    throw Object.assign(new Error('Organization not found'), { status: 404 });
  }

  const seatUtil = limits.maxUsers ? Math.round((seats / limits.maxUsers) * 100) : 0;
  const numberUtil = limits.maxPhoneNumbers ? Math.round((numbers / limits.maxPhoneNumbers) * 100) : 0;
  const extensionUtil = limits.maxUsers ? Math.round((extensions / limits.maxUsers) * 100) : 0;

  const warnings = [];
  if (seatUtil >= 85) warnings.push({ code: 'SEAT_LIMIT', message: `Seat utilization at ${seatUtil}%`, severity: seatUtil >= 100 ? 'error' : 'warning' });
  if (numberUtil >= 85) warnings.push({ code: 'NUMBER_LIMIT', message: `Number utilization at ${numberUtil}%`, severity: numberUtil >= 100 ? 'error' : 'warning' });
  if (tenant.billingStatus === 'GRACE') warnings.push({ code: 'BILLING_GRACE', message: 'Account is in billing grace period', severity: 'warning' });
  if (tenant.billingStatus === 'SUSPENDED') warnings.push({ code: 'BILLING_SUSPENDED', message: 'Account billing is suspended', severity: 'error' });
  if (tenant.billingGraceUntil && new Date(tenant.billingGraceUntil) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
    warnings.push({ code: 'GRACE_EXPIRING', message: 'Billing grace period expiring soon', severity: 'warning' });
  }

  return {
    plan: subscription.currentPlan,
    limits: {
      seats: limits.maxUsers,
      extensions: limits.maxUsers,
      numbers: limits.maxPhoneNumbers,
      concurrentCalls: limits.maxConcurrentCalls,
    },
    usage: { seats, extensions, numbers },
    utilization: {
      seats: seatUtil,
      extensions: extensionUtil,
      numbers: numberUtil,
    },
    health: {
      seats: licenseLevel(seatUtil),
      extensions: licenseLevel(extensionUtil),
      numbers: licenseLevel(numberUtil),
      billing: tenant.billingStatus === 'ACTIVE' ? 'green' : (tenant.billingStatus === 'GRACE' ? 'yellow' : 'red'),
    },
    expiration: {
      renewalDate: subscription.currentPlan.renewalDate,
      billingGraceUntil: tenant.billingGraceUntil,
    },
    featureMatrix: subscription.featureMatrix,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getLicense,
  licenseLevel,
};
