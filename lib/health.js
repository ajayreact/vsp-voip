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

/**
 * Purely informational — never affects the `ready` gate below. Telnyx stays
 * the only readiness-blocking dependency; this just gives ops visibility
 * into the multi-provider layer (ProviderManager/ProviderResolver init,
 * which providers are registered/active) without requiring Twilio to be
 * configured for the API to report ready.
 */
async function checkProviders() {
  try {
    const ProviderManager = require('./providers/ProviderManager');
    const ProviderResolver = require('./providers/ProviderResolver');
    const registeredKeys = ProviderManager.getRegisteredProviderKeys();
    const providers = await ProviderManager.listProviders();

    return {
      managerInitialized: true,
      resolverInitialized: typeof ProviderResolver.resolve === 'function',
      registeredKeys,
      defaultProviderKey: ProviderResolver.DEFAULT_PROVIDER_KEY,
      providers: providers.map((p) => ({ key: p.key, isActive: p.isActive })),
    };
  } catch (error) {
    // Provider-table lookup failing must never affect overall readiness —
    // Telnyx production traffic does not depend on this table.
    return { managerInitialized: false, error: error.message };
  }
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
  const [database, redis, telnyx, stripe, smtp, providers] = await Promise.all([
    checkDatabase(),
    pingRedis(),
    checkTelnyx(),
    checkStripe(),
    verifySmtpConnection(),
    checkProviders(),
  ]);

  const redisReady = redis.connected || !isRedisRequired();
  // NOTE: `ready` intentionally does NOT depend on `providers` — Telnyx
  // (via TELNYX_API_KEY) remains the only telephony readiness gate so a
  // provider-table outage or Twilio being unconfigured never takes the API
  // out of rotation.
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
    providers,
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
  checkProviders,
};
