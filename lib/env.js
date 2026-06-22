const DEFAULT_JWT_SECRET = 'dev-only-change-in-production';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function validateEnv() {
  const errors = [];

  if (!process.env.DATABASE_URL?.trim()) {
    errors.push('DATABASE_URL is required');
  }

  if (!process.env.TELNYX_API_KEY?.trim()) {
    errors.push('TELNYX_API_KEY is required');
  }

  if (isProduction()) {
    const jwtSecret = process.env.JWT_SECRET?.trim();
    if (!jwtSecret) {
      errors.push('JWT_SECRET is required in production');
    } else if (jwtSecret === DEFAULT_JWT_SECRET) {
      errors.push('JWT_SECRET must not use the default dev value in production');
    }
    if (!process.env.SETTINGS_ENCRYPTION_KEY?.trim()) {
      errors.push('SETTINGS_ENCRYPTION_KEY is required in production');
    }
    if (!process.env.TELNYX_PUBLIC_KEY?.trim()) {
      errors.push('TELNYX_PUBLIC_KEY is required in production');
    }
    if (!process.env.REDIS_URL?.trim()) {
      errors.push('REDIS_URL is required in production');
    }
    const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!stripeWebhook) {
      errors.push('STRIPE_WEBHOOK_SECRET is required in production (or configure in platform settings before enabling Stripe)');
    }
    if (!process.env.SMTP_HOST?.trim()) {
      errors.push('SMTP_HOST is required in production');
    }
    if (!process.env.SMTP_FROM?.trim()) {
      errors.push('SMTP_FROM is required in production');
    }
    if (!process.env.API_PUBLIC_URL?.trim()) {
      errors.push('API_PUBLIC_URL is required in production (public HTTPS URL for Telnyx webhooks)');
    }
    if (!process.env.WEB_ORIGIN?.trim()) {
      errors.push('WEB_ORIGIN is required in production (portal URL for emails and Stripe redirects)');
    }
  }

  if (errors.length) {
    const message = `Environment validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`;
    throw new Error(message);
  }

  return {
    isProduction: isProduction(),
    webhookStrict: process.env.WEBHOOK_STRICT !== 'false' && isProduction(),
  };
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    if (isProduction()) throw new Error('JWT_SECRET is required');
    return DEFAULT_JWT_SECRET;
  }
  return secret;
}

module.exports = {
  validateEnv,
  isProduction,
  getJwtSecret,
  DEFAULT_JWT_SECRET,
};
