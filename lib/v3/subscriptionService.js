/**
 * V3 Subscription Service — plan, limits, and reversible plan changes (no Stripe redesign).
 */

const { randomUUID } = require('crypto');
const { getTenantSubscriptionSummary } = require('../billing');
const { getTenantQuotaLimits } = require('../quotaService');
const auditService = require('./auditService');

const PLAN_TIERS = {
  starter: { maxUsers: 10, maxPhoneNumbers: 10, maxConcurrentCalls: 3, label: 'Starter' },
  business: { maxUsers: 25, maxPhoneNumbers: 20, maxConcurrentCalls: 5, label: 'Business' },
  enterprise: { maxUsers: 100, maxPhoneNumbers: 100, maxConcurrentCalls: 25, label: 'Enterprise' },
};

function resolvePlanTier(tenant, limits) {
  if (limits.maxUsers <= 10) return 'starter';
  if (limits.maxUsers <= 25) return 'business';
  return 'enterprise';
}

function buildFeatureMatrix(flags) {
  const f = flags || {};
  return {
    engine: f.engineEnabled === true,
    desk: f.deskEnabled === true,
    mobile: f.mobileEnabled === true,
    pstn: f.pstnEnabled === true,
    transfer: f.transferEnabled === true,
    hold: f.holdEnabled === true,
    recording: f.recordingEnabled === true,
    voicemail: f.voicemailEnabled === true,
    conference: f.conferenceEnabled === true,
    queue: f.queueEnabled === true,
    ivr: f.ivrEnabled === true,
  };
}

async function getSubscription(prisma, tenantId) {
  const [tenant, limits, subscription, flags, usage] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    getTenantQuotaLimits(prisma, tenantId),
    getTenantSubscriptionSummary({ prisma, tenantId }).catch(() => null),
    prisma.v3FeatureFlag.findUnique({ where: { tenantId } }),
    Promise.all([
      prisma.user.count({ where: { tenantId, role: 'TENANT_USER' } }),
      prisma.extension.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.phoneNumber.count({ where: { tenantId, isActive: { not: false } } }),
    ]),
  ]);

  if (!tenant) {
    throw Object.assign(new Error('Organization not found'), { status: 404 });
  }

  const tier = resolvePlanTier(tenant, limits);
  const [seatsUsed, extensionsUsed, numbersUsed] = usage;

  return {
    currentPlan: {
      tier,
      label: PLAN_TIERS[tier]?.label || tier,
      billingStatus: tenant.billingStatus,
      stripeSubscriptionId: tenant.stripeSubscriptionId,
      renewalDate: subscription?.stripeSubscription?.currentPeriodEnd || null,
    },
    limits: {
      seats: limits.maxUsers,
      extensions: limits.maxUsers,
      numbers: limits.maxPhoneNumbers,
      concurrentCalls: limits.maxConcurrentCalls,
      storageMb: null,
    },
    usage: {
      seats: seatsUsed,
      extensions: extensionsUsed,
      numbers: numbersUsed,
    },
    utilization: {
      seats: limits.maxUsers ? Math.round((seatsUsed / limits.maxUsers) * 100) : 0,
      numbers: limits.maxPhoneNumbers ? Math.round((numbersUsed / limits.maxPhoneNumbers) * 100) : 0,
    },
    availableTiers: Object.entries(PLAN_TIERS).map(([key, val]) => ({ tier: key, ...val })),
    featureMatrix: buildFeatureMatrix(flags),
    stripe: subscription,
    generatedAt: new Date().toISOString(),
  };
}

async function changePlan(prisma, tenantId, { tier, maxUsers, maxPhoneNumbers, maxConcurrentCalls } = {}, { req } = {}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw Object.assign(new Error('Organization not found'), { status: 404 });
  }

  const preset = tier ? PLAN_TIERS[String(tier).toLowerCase()] : null;
  const patch = {
    maxUsers: maxUsers ?? preset?.maxUsers ?? tenant.maxUsers,
    maxPhoneNumbers: maxPhoneNumbers ?? preset?.maxPhoneNumbers ?? tenant.maxPhoneNumbers,
    maxConcurrentCalls: maxConcurrentCalls ?? preset?.maxConcurrentCalls ?? tenant.maxConcurrentCalls,
  };

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: patch,
  });

  await auditService.log(prisma, req, {
    action: 'v3.subscription.changed',
    entityType: 'Tenant',
    entityId: tenantId,
    oldValue: {
      maxUsers: tenant.maxUsers,
      maxPhoneNumbers: tenant.maxPhoneNumbers,
      maxConcurrentCalls: tenant.maxConcurrentCalls,
    },
    newValue: patch,
    extra: { tier: tier || null },
  });

  return getSubscription(prisma, tenantId);
}

module.exports = {
  PLAN_TIERS,
  getSubscription,
  changePlan,
  buildFeatureMatrix,
  resolvePlanTier,
};
