const redisModule = require('./requireRedis');
const { sessionKey, TTL } = require('./keys');
const { safeJsonParse } = require('../Utils/safeJson');

/**
 * @param {string} sessionId
 * @param {Record<string, unknown>} data
 * @param {number} [ttlSec]
 */
async function setSessionCache(sessionId, data, ttlSec = TTL.SESSION_SEC) {
  const redis = await redisModule.requireV3Redis();
  await redis.set(sessionKey(sessionId), JSON.stringify(data), 'EX', ttlSec);
}

/**
 * @param {string} sessionId
 * @returns {Promise<Record<string, unknown>|null>}
 */
async function getSessionCache(sessionId) {
  const redis = await redisModule.requireV3Redis();
  const raw = await redis.get(sessionKey(sessionId));
  return safeJsonParse(raw);
}

async function deleteSessionCache(sessionId) {
  const redis = await redisModule.requireV3Redis();
  await redis.del(sessionKey(sessionId));
}

/**
 * Refresh TTL on session cache after transitions.
 * @param {string} sessionId
 * @param {number} [ttlSec]
 */
async function touchSessionCache(sessionId, ttlSec = TTL.SESSION_SEC) {
  const redis = await redisModule.requireV3Redis();
  await redis.expire(sessionKey(sessionId), ttlSec);
}

module.exports = {
  setSessionCache,
  getSessionCache,
  deleteSessionCache,
  touchSessionCache,
};
