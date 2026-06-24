const { logger } = require('./logger');

let client = null;
let connectPromise = null;
let lastFailureAt = 0;
const FAILURE_BACKOFF_MS = 5000;

function buildRedisUrlFromEnv() {
  const explicitUrl = process.env.REDIS_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const host = process.env.REDIS_HOST?.trim();
  if (!host) return null;

  const port = process.env.REDIS_PORT?.trim() || '6379';
  const db = process.env.REDIS_DB?.trim();
  const password = process.env.REDIS_PASSWORD?.trim();
  const auth = password ? `:${encodeURIComponent(password)}@` : '';
  const path = db ? `/${db}` : '';
  return `redis://${auth}${host}:${port}${path}`;
}

function getRedisConfig() {
  const url = buildRedisUrlFromEnv();
  if (!url) {
    return {
      configured: false,
      url: null,
      host: null,
      source: 'none',
    };
  }

  try {
    const parsed = new URL(url);
    return {
      configured: true,
      url,
      host: parsed.hostname,
      port: parsed.port || '6379',
      source: process.env.REDIS_URL?.trim() ? 'REDIS_URL' : 'REDIS_HOST',
    };
  } catch {
    return {
      configured: true,
      url,
      host: null,
      source: process.env.REDIS_URL?.trim() ? 'REDIS_URL' : 'REDIS_HOST',
      invalid: true,
    };
  }
}

async function getRedisClient() {
  if (client) return client;

  const config = getRedisConfig();
  if (!config.configured) {
    return null;
  }
  if (config.invalid) {
    logger.error('redis_config_invalid', { source: config.source });
    return null;
  }
  if (Date.now() - lastFailureAt < FAILURE_BACKOFF_MS) return null;

  if (!connectPromise) {
    connectPromise = (async () => {
      const Redis = require('ioredis');
      const instance = new Redis(config.url, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: false,
        retryStrategy(times) {
          return Math.min(times * 250, 2000);
        },
      });
      instance.on('error', (err) => {
        logger.warn('redis_error', {
          error: err.message,
          host: config.host,
          source: config.source,
        });
      });
      try {
        await instance.connect();
        client = instance;
        lastFailureAt = 0;
        logger.info('redis_connected', { host: config.host, source: config.source });
        return instance;
      } catch (error) {
        lastFailureAt = Date.now();
        connectPromise = null;
        try {
          instance.disconnect();
        } catch {}
        logger.warn('redis_connect_failed', {
          error: error.message,
          host: config.host,
          source: config.source,
        });
        return null;
      }
    })();
  }

  return connectPromise;
}

async function pingRedis() {
  try {
    const config = getRedisConfig();
    const redis = await getRedisClient();
    if (!redis) {
      return {
        connected: false,
        optional: true,
        configured: config.configured,
        host: config.host,
        source: config.source,
        error: config.invalid ? 'Invalid Redis URL' : undefined,
      };
    }
    const start = Date.now();
    await redis.ping();
    return {
      connected: true,
      configured: true,
      host: config.host,
      source: config.source,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

async function closeRedis() {
  if (client) {
    await client.quit();
    client = null;
    connectPromise = null;
  }
}

module.exports = {
  getRedisClient,
  getRedisConfig,
  pingRedis,
  closeRedis,
};
