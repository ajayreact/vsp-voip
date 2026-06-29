const crypto = require('crypto');

const CACHE = new Map();
const DEFAULT_TTL_MS = 60_000;
const MAX_ENTRIES = 200;

function cacheKey(tenantId, question) {
  const hash = crypto.createHash('sha256').update(String(question || '').trim().toLowerCase()).digest('hex');
  return `${tenantId}:${hash}`;
}

function getCachedResponse(tenantId, question) {
  const key = cacheKey(tenantId, question);
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedResponse(tenantId, question, value, ttlMs = DEFAULT_TTL_MS) {
  if (CACHE.size >= MAX_ENTRIES) {
    const firstKey = CACHE.keys().next().value;
    if (firstKey) CACHE.delete(firstKey);
  }
  CACHE.set(cacheKey(tenantId, question), {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function resetQueryCacheForTests() {
  CACHE.clear();
}

module.exports = {
  getCachedResponse,
  setCachedResponse,
  resetQueryCacheForTests,
};
