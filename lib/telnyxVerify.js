const { TelnyxWebhook } = require('telnyx/lib/webhooks');
const { isProduction } = require('./env');
const { logger } = require('./logger');

const TELNYX_PUBLIC_KEY = process.env.TELNYX_PUBLIC_KEY?.trim();
const verifier = TELNYX_PUBLIC_KEY ? new TelnyxWebhook(TELNYX_PUBLIC_KEY) : null;

function webhookStrictEnabled() {
  return process.env.WEBHOOK_STRICT !== 'false' && isProduction();
}

async function verifyTelnyxWebhook(req) {
  if (!verifier) {
    if (webhookStrictEnabled()) {
      const error = new Error('TELNYX_PUBLIC_KEY is not configured');
      error.status = 503;
      throw error;
    }
    logger.warn('telnyx_webhook_verification_skipped', { reason: 'no_public_key' });
    return;
  }

  const signature = req.headers['telnyx-signature-ed25519'];
  const timestamp = req.headers['telnyx-timestamp'];

  if (!signature || !timestamp) {
    if (webhookStrictEnabled()) {
      const error = new Error('Missing Telnyx webhook signature headers');
      error.status = 403;
      throw error;
    }
    logger.warn('telnyx_webhook_verification_skipped', { reason: 'missing_headers' });
    return;
  }

  const payload = req.rawBody ?? '';
  await verifier.verify(payload, req.headers);
}

function parseTelnyxFormBody(req, res, next) {
  if (req.method === 'GET') {
    req.rawBody = '';
    return next();
  }

  let raw = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    raw += chunk;
  });
  req.on('end', () => {
    req.rawBody = raw;
    req.body = Object.fromEntries(new URLSearchParams(raw));
    next();
  });
}

async function verifyTelnyxWebhookMiddleware(req, res, next) {
  try {
    await verifyTelnyxWebhook(req);
    next();
  } catch (error) {
    logger.error('telnyx_webhook_verification_failed', { error: error.message });
    res.status(error.status || 403).send('Invalid webhook signature');
  }
}

function parseTelnyxJsonBody(req, res, next) {
  if (req.method === 'GET') {
    req.rawBody = '';
    return next();
  }

  let raw = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    raw += chunk;
  });
  req.on('end', () => {
    req.rawBody = raw;
    try {
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      req.body = {};
    }
    next();
  });
}

function parseTelnyxWebhookBody(req, res, next) {
  if (req.method === 'GET') {
    req.rawBody = '';
    req.body = req.query;
    return next();
  }

  let raw = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    raw += chunk;
  });
  req.on('end', () => {
    req.rawBody = raw;
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('application/json')) {
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch {
        req.body = {};
      }
    } else {
      req.body = Object.fromEntries(new URLSearchParams(raw));
    }
    next();
  });
}

module.exports = {
  parseTelnyxFormBody,
  parseTelnyxJsonBody,
  parseTelnyxWebhookBody,
  verifyTelnyxWebhookMiddleware,
  webhookStrictEnabled,
};
