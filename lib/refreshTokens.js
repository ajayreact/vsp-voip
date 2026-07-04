const crypto = require('crypto');
const { getRedisClient } = require('./redis');

const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;
const memoryTokens = new Map();
const memoryUserTokens = new Map();

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function storageKey(tokenHash) {
  return `refresh:${tokenHash}`;
}

function userTokensKey(userId) {
  return `refresh:user:${String(userId)}`;
}

async function storeRefreshToken(userId, token) {
  const tokenHash = hashToken(token);
  const payload = JSON.stringify({ userId: String(userId), issuedAt: Date.now() });

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.set(storageKey(tokenHash), payload, 'EX', REFRESH_TTL_SEC);
    await redis.sadd(userTokensKey(userId), tokenHash);
    await redis.expire(userTokensKey(userId), REFRESH_TTL_SEC);
    return;
  }
  memoryTokens.set(tokenHash, { payload, expiresAt: Date.now() + REFRESH_TTL_SEC * 1000 });
  if (!memoryUserTokens.has(String(userId))) {
    memoryUserTokens.set(String(userId), new Set());
  }
  memoryUserTokens.get(String(userId)).add(tokenHash);
}

async function readRefreshToken(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const raw = await redis.get(storageKey(tokenHash));
    return raw ? JSON.parse(raw) : null;
  }

  const entry = memoryTokens.get(tokenHash);
  if (!entry || entry.expiresAt < Date.now()) {
    memoryTokens.delete(tokenHash);
    return null;
  }
  return JSON.parse(entry.payload);
}

async function revokeRefreshToken(token) {
  if (!token) return;
  const tokenHash = hashToken(token);
  const record = await readRefreshToken(token);
  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.del(storageKey(tokenHash));
    if (record?.userId) {
      await redis.srem(userTokensKey(record.userId), tokenHash);
    }
    return;
  }
  memoryTokens.delete(tokenHash);
  if (record?.userId && memoryUserTokens.has(record.userId)) {
    memoryUserTokens.get(record.userId).delete(tokenHash);
  }
}

async function revokeAllRefreshTokensForUser(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const tokenHashes = await redis.smembers(userTokensKey(normalizedUserId));
    if (tokenHashes.length) {
      const pipeline = redis.pipeline();
      for (const tokenHash of tokenHashes) {
        pipeline.del(storageKey(tokenHash));
      }
      pipeline.del(userTokensKey(normalizedUserId));
      await pipeline.exec();
    }
    return;
  }

  const tokenHashes = memoryUserTokens.get(normalizedUserId);
  if (!tokenHashes?.size) return;
  for (const tokenHash of tokenHashes) {
    memoryTokens.delete(tokenHash);
  }
  memoryUserTokens.delete(normalizedUserId);
}

async function issueRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('base64url');
  await storeRefreshToken(userId, token);
  return token;
}

async function rotateRefreshToken(presentedToken) {
  const record = await readRefreshToken(presentedToken);
  if (!record?.userId) return null;

  await revokeRefreshToken(presentedToken);
  const nextToken = await issueRefreshToken(record.userId);
  return { userId: record.userId, refreshToken: nextToken };
}

module.exports = {
  REFRESH_TTL_SEC,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
};
