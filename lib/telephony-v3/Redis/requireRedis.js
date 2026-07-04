const { getRedisClient } = require('../../redis');
const { V3RedisRequiredError } = require('../errors');
const { metrics } = require('../Utils/metrics');

/**
 * V3 telephony requires Redis — no in-memory fallback (ADR-005).
 * @param {{ allowOptional?: boolean }} [options]
 * @returns {Promise<import('ioredis').Redis|null>}
 */
async function requireV3Redis(options = {}) {
  const allowOptional = options.allowOptional === true;
  const redis = await getRedisClient().catch(() => null);

  if (!redis) {
    if (allowOptional) return null;
    metrics.redisUnavailable({});
    throw new V3RedisRequiredError();
  }
  return redis;
}

function isV3RedisRequired() {
  return process.env.TELEPHONY_V3_REDIS_REQUIRED !== 'false';
}

module.exports = { requireV3Redis, isV3RedisRequired };
