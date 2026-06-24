const { getRedisClient } = require('./redis');
const { logger } = require('./logger');

const memoryCounters = new Map();
let lastFallbackWarningAt = 0;

function pruneMemoryCounters() {
  if (memoryCounters.size < 10000) return;
  memoryCounters.clear();
}

function windowKey(name, key, windowMs) {
  const bucket = Math.floor(Date.now() / windowMs);
  return `rl:${name}:${key}:${bucket}`;
}

async function incrementCounter(name, key, windowMs, max) {
  const redis = await getRedisClient().catch(() => null);

  if (redis) {
    const rk = windowKey(name, key, windowMs);
    const count = await redis.incr(rk);
    if (count === 1) {
      await redis.pexpire(rk, windowMs);
    }
    if (count > max) {
      const ttl = await redis.pttl(rk);
      return { allowed: false, retryAfterMs: Math.max(ttl, 1000) };
    }
    return { allowed: true, remaining: max - count };
  }

  const now = Date.now();
  if (now - lastFallbackWarningAt > 60000) {
    lastFallbackWarningAt = now;
    logger.warn('rate_limit_redis_unavailable_using_memory', { name });
  }

  pruneMemoryCounters();
  const mk = `${name}:${key}:${Math.floor(Date.now() / windowMs)}`;
  const count = (memoryCounters.get(mk) || 0) + 1;
  memoryCounters.set(mk, count);
  if (count > max) {
    return { allowed: false, retryAfterMs: windowMs };
  }
  return { allowed: true, remaining: max - count };
}

function rateLimitMiddleware({ name, windowMs, max, keyFn }) {
  return async (req, res, next) => {
    try {
      const key = keyFn(req);
      const result = await incrementCounter(name, key, windowMs, max);
      if (!result.allowed) {
        res.set('Retry-After', String(Math.ceil((result.retryAfterMs || 60000) / 1000)));
        return res.status(429).json({
          error: 'Too many requests',
          retryAfterMs: result.retryAfterMs,
        });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

const loginLimiter = rateLimitMiddleware({
  name: 'login',
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
});

const searchLimiter = rateLimitMiddleware({
  name: 'search',
  windowMs: 60 * 1000,
  max: 30,
  keyFn: (req) => req.user?.sub || req.ip || 'unknown',
});

const billingLimiter = rateLimitMiddleware({
  name: 'billing',
  windowMs: 60 * 1000,
  max: 20,
  keyFn: (req) => req.user?.sub || req.ip || 'unknown',
});

const webhookLimiter = rateLimitMiddleware({
  name: 'webhook',
  windowMs: 60 * 1000,
  max: 300,
  keyFn: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
});

module.exports = {
  incrementCounter,
  rateLimitMiddleware,
  loginLimiter,
  searchLimiter,
  billingLimiter,
  webhookLimiter,
};
