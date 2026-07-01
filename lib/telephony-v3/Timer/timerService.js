const redisModule = require('../Redis/requireRedis');
const { timerKey, TTL } = require('../Redis/keys');
const { v3Logger } = require('../Utils/v3Logger');

/** @type {Map<string, (payload: { sessionId: string, name: string }) => void>} */
const expireHandlers = new Map();

/**
 * @param {string} sessionId
 * @param {string} name
 * @param {number} ttlSec
 * @param {{ fireAt?: number }} [options]
 */
async function scheduleTimer(sessionId, name, ttlSec, options = {}) {
  const sec = Math.max(ttlSec, TTL.TIMER_MIN_SEC);
  const redis = await redisModule.requireV3Redis();
  const key = timerKey(sessionId, name);
  const expiresAt = options.fireAt || Date.now() + sec * 1000;
  const payload = JSON.stringify({ sessionId, name, expiresAt });
  const ok = await redis.set(key, payload, 'EX', sec, 'NX');
  if (ok !== 'OK') {
    v3Logger.debug('timer.already_scheduled', { sessionId, name });
    return { scheduled: false, sessionId, name, expiresAt };
  }
  v3Logger.info('timer.scheduled', { sessionId, name, ttlSec: sec, expiresAt });
  return { scheduled: true, sessionId, name, expiresAt };
}

async function cancelTimer(sessionId, name) {
  const redis = await redisModule.requireV3Redis();
  const key = timerKey(sessionId, name);
  const removed = await redis.del(key);
  v3Logger.info('timer.cancelled', { sessionId, name, removed });
  return removed > 0;
}

/**
 * Check if timer key exists; if missing but was expected, treat as expired.
 * @param {string} sessionId
 * @param {string} name
 */
async function isTimerActive(sessionId, name) {
  const redis = await redisModule.requireV3Redis();
  const key = timerKey(sessionId, name);
  const val = await redis.get(key);
  return Boolean(val);
}

/**
 * Poll due timers — Phase 1 infrastructure sweep (no call logic).
 * Workers call this periodically; emits handler if key expired.
 * @param {string} handlerId
 */
function registerExpireHandler(handlerId, fn) {
  expireHandlers.set(handlerId, fn);
}

async function fireExpiredTimer(sessionId, name) {
  const payload = { sessionId, name };
  v3Logger.info('timer.expired', payload);
  for (const fn of expireHandlers.values()) {
    try {
      await fn(payload);
    } catch (error) {
      v3Logger.error('timer.handler_failed', { sessionId, name, error: error.message });
    }
  }
}

/**
 * Poll timer keys and fire handlers for expired timers (Phase 3.9.5).
 * @param {number} [limit]
 */
async function pollExpiredTimers(limit = 100) {
  const redisModule = require('../Redis/requireRedis');
  const redis = await redisModule.requireV3Redis({ allowOptional: true });
  if (!redis) return { fired: 0 };

  const { REDIS } = require('../constants');
  const prefix = REDIS.TIMER_PREFIX;
  let cursor = '0';
  let fired = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 50);
    cursor = nextCursor;
    for (const key of keys) {
      if (fired >= limit) break;
      const raw = await redis.get(key);
      if (!raw) continue;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      if (parsed.expiresAt && Date.now() >= parsed.expiresAt) {
        await redis.del(key).catch(() => {});
        const sessionId = parsed.sessionId || key.slice(prefix.length).split(':')[0];
        await fireExpiredTimer(sessionId, parsed.name);
        fired += 1;
      }
    }
  } while (cursor !== '0' && fired < limit);

  return { fired };
}

module.exports = {
  scheduleTimer,
  cancelTimer,
  isTimerActive,
  registerExpireHandler,
  fireExpiredTimer,
  pollExpiredTimers,
};
