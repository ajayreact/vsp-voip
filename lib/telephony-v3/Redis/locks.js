const crypto = require('crypto');
const redisModule = require('./requireRedis');
const { lockKey, bootstrapLockKey, TTL } = require('./keys');
const { V3Error } = require('../errors');

/**
 * @param {string} key
 * @param {() => Promise<T>} fn
 * @param {{ ttlSec?: number, retries?: number, lockLabel?: string }} [options]
 * @returns {Promise<T>}
 * @template T
 */
async function withLock(key, fn, options = {}) {
  const ttlSec = options.ttlSec ?? TTL.LOCK_SEC;
  const retries = options.retries ?? 3;
  const token = crypto.randomUUID();

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const redis = await redisModule.requireV3Redis();
    const acquired = await redis.set(key, token, 'EX', ttlSec, 'NX');
    if (acquired === 'OK') {
      try {
        return await fn();
      } finally {
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        await redis.eval(script, 1, key, token);
      }
    }
    await sleep(50 * (attempt + 1));
  }

  throw new V3Error('LOCK_TIMEOUT', 'Failed to acquire lock', {
    key,
    label: options.lockLabel || 'unknown',
  });
}

/**
 * @param {string} sessionId
 * @param {() => Promise<T>} fn
 * @param {{ ttlSec?: number, retries?: number }} [options]
 * @returns {Promise<T>}
 * @template T
 */
async function withSessionLock(sessionId, fn, options = {}) {
  return withLock(lockKey(sessionId), fn, {
    ...options,
    lockLabel: `session:${sessionId}`,
  });
}

/**
 * Serialize call.initiated bootstrap for a call control id.
 * @param {string} callControlId
 * @param {() => Promise<T>} fn
 * @param {{ ttlSec?: number, retries?: number }} [options]
 * @returns {Promise<T>}
 * @template T
 */
async function withBootstrapLock(callControlId, fn, options = {}) {
  return withLock(bootstrapLockKey(callControlId), fn, {
    ...options,
    lockLabel: `bootstrap:${callControlId}`,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { withLock, withSessionLock, withBootstrapLock };
