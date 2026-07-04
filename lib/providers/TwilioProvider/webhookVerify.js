/**
 * TwilioProvider/webhookVerify — X-Twilio-Signature validation.
 *
 * New code (Phase 7). Twilio signs webhook requests with HMAC-SHA1 over the
 * full request URL concatenated with sorted `key+value` pairs of the
 * form-encoded POST body (see Twilio's documented request-validation
 * algorithm) — structurally different from Telnyx's Ed25519 body-signature
 * scheme in lib/telnyxVerify.js, which is why webhook verification is a
 * per-provider pluggable middleware rather than a shared function.
 *
 * Verified against live Twilio MCP docs (twilio-docs MCP server,
 * `twilio__search` "validate X-Twilio-Signature webhook request validation
 * algorithm" -> https://www.twilio.com/docs/usage/security and
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security). Documented
 * algorithm for `application/x-www-form-urlencoded` requests (standard
 * Voice/TwiML webhooks — CallStatus, Gather digits, RecordingStatus, etc.):
 *   1. Take the full request URL, protocol through end of query string.
 *   2. Sort POST params alphabetically (case-sensitive, Unix-style).
 *   3. Append each `name+value` (no delimiters) to the URL string.
 *   4. HMAC-SHA1 the result using the account Auth Token as the key.
 *   5. Base64-encode; compare (constant-time) to `X-Twilio-Signature`.
 * `computeSignature`/`validateSignature` below implement exactly that.
 *
 * Twilio also documents a second, JSON-body variant used by some non-Voice
 * products: Twilio appends a `bodySHA256` query param (SHA-256 of the raw
 * JSON body) to the webhook URL, and the signature covers that URL with NO
 * appended params (the params-append step only applies to form bodies).
 * `validateJsonBodySignature` implements this per-spec for completeness /
 * forward-compatibility, but is not on the hot path for Voice webhooks
 * today, since Telnyx-analog Voice callbacks (CallStatus, Gather, Recording)
 * are always form-encoded per Twilio's docs above.
 */

const crypto = require('crypto');
const { getTwilioCredentials } = require('./twilioClient');

/**
 * @param {string} authToken
 * @param {string} fullUrl The exact URL Twilio called (must match what Twilio signed, including query string).
 * @param {Record<string, string>} params Form-encoded POST params (empty object for GET, or for JSON-body requests).
 */
function computeSignature(authToken, fullUrl, params) {
  const sortedKeys = Object.keys(params || {}).sort();
  const data = sortedKeys.reduce((acc, key) => acc + key + params[key], fullUrl);
  return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
}

/**
 * @param {string} signatureHeader
 * @param {string} expected
 */
function timingSafeEqualStrings(signatureHeader, expected) {
  if (!signatureHeader) return false;
  const signatureBuf = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(signatureBuf, expectedBuf);
}

/**
 * JSON-body signature validation (see file header). Requires the raw,
 * unparsed request body bytes — callers must mount the JSON body parser
 * with a `verify` callback that stashes the raw buffer, e.g.
 * `express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } })`.
 * Fails closed (returns false) if the raw body isn't available, rather than
 * falling back to a weaker check.
 * @param {import('express').Request} req
 * @param {string} authToken
 * @param {string} fullUrl
 */
function validateJsonBodySignature(req, authToken, fullUrl) {
  const signature = req.headers['x-twilio-signature'];
  const rawBody = req.rawBody;
  if (!signature || !rawBody) return false;

  const urlObj = new URL(fullUrl);
  const expectedBodyHash = urlObj.searchParams.get('bodySHA256');
  if (!expectedBodyHash) return false;

  const actualBodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  if (!timingSafeEqualStrings(actualBodyHash, expectedBodyHash)) return false;

  const expectedSignature = computeSignature(authToken, fullUrl, {});
  return timingSafeEqualStrings(signature, expectedSignature);
}

/**
 * @param {import('express').Request} req Express request with a form-encoded body already parsed into req.body,
 *   and the original public URL available at req.originalPublicUrl (set by the route) or reconstructed from headers.
 * @param {{ tenantId?: string }} [options]
 */
async function validateSignature(req, options = {}) {
  const signature = req.headers['x-twilio-signature'];
  if (!signature) return false;

  let authToken;
  try {
    ({ authToken } = await getTwilioCredentials(options.tenantId));
  } catch {
    return false;
  }

  const fullUrl = req.originalPublicUrl
    || `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    return validateJsonBodySignature(req, authToken, fullUrl);
  }

  const expected = computeSignature(authToken, fullUrl, req.body || {});
  return timingSafeEqualStrings(signature, expected);
}

/**
 * Express middleware form, matching the calling convention of
 * lib/telnyxVerify.js#verifyTelnyxWebhookMiddleware.
 */
function verifyTwilioWebhookMiddleware(req, res, next) {
  validateSignature(req)
    .then((ok) => {
      if (!ok) {
        res.status(403).send('Invalid webhook signature');
        return;
      }
      next();
    })
    .catch(() => res.status(403).send('Invalid webhook signature'));
}

module.exports = {
  computeSignature,
  validateJsonBodySignature,
  validateSignature,
  verifyTwilioWebhookMiddleware,
};
