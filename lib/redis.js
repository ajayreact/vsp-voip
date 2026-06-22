const { logger } = require('./logger');
const { isProduction } = require('./env');

let client = null;
let connectPromise = null;

async function getRedisClient() {
  if (client) return client;

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    if (isProduction()) {
      throw new Error('REDIS_URL is required in production');
    }
    return null;
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      const Redis = require('ioredis');
      const instance = new Redis(url, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      instance.on('error', (err) => {
        logger.error('redis_error', { error: err.message });
      });
      await instance.connect();
      client = instance;
      logger.info('redis_connected');
      return instance;
    })();
  }

  return connectPromise;
}

async function pingRedis() {
  try {
    const redis = await getRedisClient();
    if (!redis) return { connected: false, optional: true };
    const start = Date.now();
    await redis.ping();
    return { connected: true, latencyMs: Date.now() - start };
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
  pingRedis,
  closeRedis,
};
