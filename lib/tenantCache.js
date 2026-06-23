const { normalizePhoneNumber } = require('./phone');
const { getRedisClient } = require('./redis');

const memoryCache = new Map();

const tenantCacheSelect = {
  id: true,
  name: true,
  isActive: true,
  billingStatus: true,
  billingGraceUntil: true,
  timezone: true,
};

function cacheKey(number) {
  return normalizePhoneNumber(number);
}

async function setCachedTenant(number, tenant) {
  const normalized = cacheKey(number);
  if (!normalized || !tenant) return;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.set(`tenant:num:${normalized}`, JSON.stringify(tenant), 'EX', 86400);
    return;
  }
  memoryCache.set(normalized, tenant);
}

async function getCachedTenant(dialedNumber) {
  const normalized = cacheKey(dialedNumber);
  if (!normalized) return null;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const raw = await redis.get(`tenant:num:${normalized}`);
    return raw ? JSON.parse(raw) : null;
  }
  return memoryCache.get(normalized) ?? null;
}

async function invalidateCachedTenant(number) {
  const normalized = cacheKey(number);
  if (!normalized) return;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.del(`tenant:num:${normalized}`);
    return;
  }
  memoryCache.delete(normalized);
}

async function refreshTenantCache(prisma) {
  const numbers = await prisma.phoneNumber.findMany({
    where: { isActive: true },
    select: {
      number: true,
      tenant: { select: tenantCacheSelect },
    },
  });
  const redis = await getRedisClient().catch(() => null);

  if (redis) {
    const pipeline = redis.pipeline();
    for (const entry of numbers) {
      const normalized = cacheKey(entry.number);
      if (normalized && entry.tenant) {
        pipeline.set(`tenant:num:${normalized}`, JSON.stringify(entry.tenant), 'EX', 86400);
      }
    }
    await pipeline.exec();
    return numbers.length;
  }

  memoryCache.clear();
  for (const entry of numbers) {
    const normalized = cacheKey(entry.number);
    if (normalized && entry.tenant) {
      memoryCache.set(normalized, entry.tenant);
    }
  }
  return memoryCache.size;
}

function getTenantCacheSize() {
  return memoryCache.size;
}

module.exports = {
  setCachedTenant,
  getCachedTenant,
  invalidateCachedTenant,
  refreshTenantCache,
  getTenantCacheSize,
  tenantCacheByNumber: memoryCache,
};
