const { requireV3Redis } = require('./requireRedis');
const { flagKey, TTL } = require('./keys');
const { safeJsonParse } = require('../Utils/safeJson');

/**
 * @param {string} tenantId
 * @param {Record<string, unknown>} flags
 */
async function setFeatureFlagCache(tenantId, flags, ttlSec = TTL.FLAG_SEC) {
  const redis = await requireV3Redis();
  await redis.set(flagKey(tenantId), JSON.stringify(flags), 'EX', ttlSec);
}

/**
 * @param {string} tenantId
 * @returns {Promise<Record<string, unknown>|null>}
 */
async function getFeatureFlagCache(tenantId) {
  const redis = await requireV3Redis();
  const raw = await redis.get(flagKey(tenantId));
  return safeJsonParse(raw);
}

async function invalidateFeatureFlagCache(tenantId) {
  const redis = await requireV3Redis();
  await redis.del(flagKey(tenantId));
}

module.exports = {
  setFeatureFlagCache,
  getFeatureFlagCache,
  invalidateFeatureFlagCache,
};
