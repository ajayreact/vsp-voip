const { getRedisClient } = require('./redis');
const { logger } = require('./logger');

const memoryClaims = new Map();

async function claimGreetingSession(from, to) {
  const { normalizePhoneNumber } = require('./phone');
  const fromKey = normalizePhoneNumber(from);
  const toKey = normalizePhoneNumber(to);
  if (!fromKey || !toKey) return true;

  const key = `greet:dedup:${fromKey}|${toKey}`;
  const redis = await getRedisClient().catch(() => null);

  if (redis) {
    const result = await redis.set(key, '1', 'EX', 15, 'NX');
    return result === 'OK';
  }

  const lastSent = memoryClaims.get(key);
  const now = Date.now();
  if (lastSent && now - lastSent < 15000) return false;
  memoryClaims.set(key, now);
  return true;
}

async function clearGreetingSession(from, to) {
  const { normalizePhoneNumber } = require('./phone');
  const fromKey = normalizePhoneNumber(from);
  const toKey = normalizePhoneNumber(to);
  if (!fromKey || !toKey) return;

  const key = `greet:dedup:${fromKey}|${toKey}`;
  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.del(key).catch((err) => logger.warn('greeting_dedup_clear_failed', { error: err.message }));
    return;
  }
  memoryClaims.delete(key);
}

module.exports = {
  claimGreetingSession,
  clearGreetingSession,
};
