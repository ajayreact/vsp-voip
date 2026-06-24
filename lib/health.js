const { getRedisConfig, pingRedis } = require('./redis');
const { getPrisma } = require('../db');
const { loadPlatformSettings } = require('./platformSettings');
const { isProduction } = require('./env');
const { verifySmtpConnection } = require('./mailer');

const startedAt = Date.now();

async function checkDatabase() {
  try {
    const prisma = await getPrisma();
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return { connected: true, latencyMs: Date.now() - start };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

async function checkStripe() {
  try {
    const prisma = await getPrisma();
    const platform = await loadPlatformSettings(prisma);
    const configured = Boolean(platform.stripeSecretKey);
    const webhookConfigured = Boolean(
      platform.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET?.trim(),
    );
    return { configured, webhookConfigured };
  } catch (error) {
    return { configured: false, webhookConfigured: false, error: error.message };
  }
}

async function checkTelnyx() {
  return {
    apiKeyConfigured: Boolean(process.env.TELNYX_API_KEY?.trim()),
    webhookVerification: Boolean(process.env.TELNYX_PUBLIC_KEY?.trim()) || !isProduction(),
  };
}

async function getHealthStatus() {
  return {
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  };
}

function isRedisRequired() {
  return isProduction() && process.env.REDIS_REQUIRED === 'true';
}

async function getReadinessStatus() {
  const [database, redis, telnyx, stripe, smtp] = await Promise.all([
    checkDatabase(),
    pingRedis(),
    checkTelnyx(),
    checkStripe(),
    verifySmtpConnection(),
  ]);

  const redisReady = redis.connected || !isRedisRequired();
  const ready = database.connected
    && redisReady
    && telnyx.apiKeyConfigured
    && (smtp.connected || smtp.optional);

  return {
    ready,
    database,
    redis: {
      ...redis,
      required: isRedisRequired(),
      config: getRedisConfig(),
    },
    telnyx,
    stripe,
    smtp,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    build: {
      gitCommit: process.env.GIT_COMMIT?.trim() || null,
      nodeEnv: process.env.NODE_ENV || null,
      startedAt: new Date(startedAt).toISOString(),
    },
  };
}

module.exports = {
  getHealthStatus,
  getReadinessStatus,
  checkDatabase,
  checkStripe,
  checkTelnyx,
};
