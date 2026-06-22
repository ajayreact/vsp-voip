const { resolveQuotaLimit } = require('./adminModules');
const { loadPlatformSettings } = require('./platformSettings');

const ACTIVE_CALL_STATUSES = ['ringing', 'in-progress', 'answered', 'active', 'bridged'];

async function getTenantQuotaLimits(prisma, tenantId) {
  const [tenant, platform] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    loadPlatformSettings(prisma),
  ]);

  if (!tenant) {
    const error = new Error('Organization not found');
    error.status = 404;
    throw error;
  }

  const defaults = {
    maxUsers: platform.defaultMaxUsers ?? 25,
    maxPhoneNumbers: platform.defaultMaxPhoneNumbers ?? 20,
    maxConcurrentCalls: platform.defaultMaxConcurrentCalls ?? 5,
  };

  return {
    tenant,
    maxUsers: resolveQuotaLimit(tenant.maxUsers, defaults.maxUsers),
    maxPhoneNumbers: resolveQuotaLimit(tenant.maxPhoneNumbers, defaults.maxPhoneNumbers),
    maxConcurrentCalls: resolveQuotaLimit(tenant.maxConcurrentCalls, defaults.maxConcurrentCalls),
  };
}

function quotaError(quota, message) {
  const error = new Error(message);
  error.status = 403;
  error.code = 'QUOTA_EXCEEDED';
  error.quota = quota;
  return error;
}

async function assertCanAddUser(prisma, tenantId, { bypass = false } = {}) {
  if (bypass) return;
  const { maxUsers } = await getTenantQuotaLimits(prisma, tenantId);
  const userCount = await prisma.user.count({ where: { tenantId } });
  if (userCount >= maxUsers) {
    throw quotaError('maxUsers', `User limit reached (${maxUsers}). Contact your administrator.`);
  }
}

async function assertCanAddPhoneNumbers(prisma, tenantId, count = 1, { bypass = false } = {}) {
  if (bypass) return;
  const { maxPhoneNumbers } = await getTenantQuotaLimits(prisma, tenantId);
  const numberCount = await prisma.phoneNumber.count({ where: { tenantId, isActive: true } });
  if (numberCount + count > maxPhoneNumbers) {
    throw quotaError(
      'maxPhoneNumbers',
      `Phone number limit reached (${maxPhoneNumbers}). Remove numbers or upgrade your plan.`,
    );
  }
}

async function countActiveCalls(prisma, tenantId) {
  const last5min = new Date(Date.now() - 5 * 60 * 1000);
  return prisma.callLog.count({
    where: {
      tenantId,
      createdAt: { gte: last5min },
      status: { in: ACTIVE_CALL_STATUSES },
    },
  });
}

async function assertCanInitiateCall(prisma, tenantId, { bypass = false } = {}) {
  if (bypass) return;
  const { maxConcurrentCalls } = await getTenantQuotaLimits(prisma, tenantId);
  const concurrentCalls = await countActiveCalls(prisma, tenantId);
  if (concurrentCalls >= maxConcurrentCalls) {
    throw quotaError(
      'maxConcurrentCalls',
      `Concurrent call limit reached (${maxConcurrentCalls}). Try again shortly.`,
    );
  }
}

function shouldBypassQuotaForUser(user) {
  return user?.role === 'SUPER_ADMIN' && process.env.QUOTA_ENFORCE_SUPER_ADMIN === 'false';
}

module.exports = {
  getTenantQuotaLimits,
  assertCanAddUser,
  assertCanAddPhoneNumbers,
  assertCanInitiateCall,
  countActiveCalls,
  shouldBypassQuotaForUser,
  ACTIVE_CALL_STATUSES,
};
