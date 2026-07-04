/**
 * TwilioProvider/accessToken — Twilio Voice SDK Access Token (JWT) builder.
 *
 * New code (Phase 7). Implemented with Node's built-in `crypto` module
 * (HMAC-SHA256) rather than the `twilio` npm package, matching the plan's
 * "Twilio via REST + axios" approach and avoiding a new runtime dependency
 * for a single JWT-shaped token. Token format follows Twilio's documented
 * Access Token structure (Voice Grant): a JWT with `cty: "twilio-fpa;v=1"`,
 * signed HS256, `iss`/`sub` = API Key SID / Account SID, and a `grants.voice`
 * claim — this is the direct analog of Telnyx's WebRTC login token
 * (`createTelephonyCredentialToken` in lib/telnyxCallControl.js).
 *
 * Verified against live Twilio MCP docs (twilio-docs MCP server,
 * `twilio__search` query "Twilio Voice SDK Access Token JWT grants structure
 * VoiceGrant", source: docs -> https://www.twilio.com/docs/iam/access-tokens).
 * The documented decoded payload shape is:
 *   { jti, grants: { identity, voice: { incoming: { allow }, outgoing: { application_sid, params? }, push_credential_sid? } }, iat, exp, iss, sub }
 * Design decisions driven directly by that reference:
 *  - `iat` (issued-at) is a required top-level claim in every example Twilio
 *    publishes; the previous version of this builder omitted it. Added below
 *    so the token matches Twilio's own encoder byte-for-byte in shape.
 *  - `pushCredentialSid` and `outgoingApplicationParams` are documented
 *    `VoiceGrant` fields ("push_credential_sid" for Mobile SDK incoming-call
 *    push, "outgoing.params" for passing custom params to the outgoing TwiML
 *    App) — both are optional and only added to the token when the caller
 *    supplies them, so existing call sites (identity/outgoingApplicationSid
 *    only) are unaffected (backward compatible).
 */

const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * @param {{
 *   accountSid: string,
 *   apiKeySid: string,
 *   apiKeySecret: string,
 *   identity: string,
 *   outgoingApplicationSid?: string,
 *   outgoingApplicationParams?: Record<string, string>,
 *   pushCredentialSid?: string,
 *   incomingAllow?: boolean,
 *   ttlSeconds?: number,
 * }} input
 * @returns {{ token: string, identity: string, expiresAt: string }}
 */
function buildVoiceAccessToken(input) {
  const {
    accountSid,
    apiKeySid,
    apiKeySecret,
    identity,
    outgoingApplicationSid,
    outgoingApplicationParams,
    pushCredentialSid,
    incomingAllow = true,
    ttlSeconds = 3600,
  } = input;

  if (!accountSid || !apiKeySid || !apiKeySecret || !identity) {
    throw Object.assign(new Error('accountSid, apiKeySid, apiKeySecret and identity are required to build a Twilio Access Token'), { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;

  const header = { cty: 'twilio-fpa;v=1', typ: 'JWT', alg: 'HS256' };
  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    sub: accountSid,
    iat: now,
    exp,
    grants: {
      identity,
      voice: {
        ...(outgoingApplicationSid ? {
          outgoing: {
            application_sid: outgoingApplicationSid,
            ...(outgoingApplicationParams ? { params: outgoingApplicationParams } : {}),
          },
        } : {}),
        incoming: { allow: incomingAllow },
        ...(pushCredentialSid ? { push_credential_sid: pushCredentialSid } : {}),
      },
    },
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', apiKeySecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return {
    token: `${encodedHeader}.${encodedPayload}.${signature}`,
    identity,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

module.exports = { buildVoiceAccessToken };
