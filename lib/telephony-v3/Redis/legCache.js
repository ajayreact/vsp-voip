const redisModule = require('./requireRedis');
const { legKey, TTL } = require('./keys');
const { safeJsonParse } = require('../Utils/safeJson');

/**
 * @param {string} callControlId
 * @param {{ sessionId: string, legId: string, role?: string }} mapping
 */
async function setLegCache(callControlId, mapping, ttlSec = TTL.SESSION_SEC) {
  const redis = await redisModule.requireV3Redis();
  await redis.set(legKey(callControlId), JSON.stringify(mapping), 'EX', ttlSec);
}

/**
 * @param {string} callControlId
 * @returns {Promise<{ sessionId: string, legId: string, role?: string }|null>}
 */
async function getLegCache(callControlId) {
  const redis = await redisModule.requireV3Redis();
  const raw = await redis.get(legKey(callControlId));
  return safeJsonParse(raw);
}

async function deleteLegCache(callControlId) {
  const redis = await redisModule.requireV3Redis();
  await redis.del(legKey(callControlId));
}

module.exports = { setLegCache, getLegCache, deleteLegCache };
