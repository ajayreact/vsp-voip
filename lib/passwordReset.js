const crypto = require('crypto');
const { getRedisClient } = require('./redis');
const { logger } = require('./logger');

const TOKEN_TTL_SEC = 3600;
const memoryTokens = new Map();

function tokenKey(token) {
  return `pwdreset:${token}`;
}

async function storeResetToken(userId, email) {
  const token = crypto.randomBytes(32).toString('hex');
  const payload = JSON.stringify({ userId, email, createdAt: Date.now() });

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.set(tokenKey(token), payload, 'EX', TOKEN_TTL_SEC);
  } else {
    memoryTokens.set(token, { payload, expiresAt: Date.now() + TOKEN_TTL_SEC * 1000 });
  }

  return token;
}

async function consumeResetToken(token) {
  if (!token) return null;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const raw = await redis.get(tokenKey(token));
    if (!raw) return null;
    await redis.del(tokenKey(token));
    return JSON.parse(raw);
  }

  const entry = memoryTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    memoryTokens.delete(token);
    return null;
  }
  memoryTokens.delete(token);
  return JSON.parse(entry.payload);
}

async function clearExpiredMemoryTokens() {
  const now = Date.now();
  for (const [token, entry] of memoryTokens.entries()) {
    if (entry.expiresAt < now) memoryTokens.delete(token);
  }
}

module.exports = {
  storeResetToken,
  consumeResetToken,
  clearExpiredMemoryTokens,
  TOKEN_TTL_SEC,
};
