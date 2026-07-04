/**
 * TwilioProvider/messaging — Twilio Messaging API.
 * New code (Phase 7).
 */

const { twilioApiRequest, getTwilioCredentials } = require('./twilioClient');

/**
 * @param {{ from: string, to: string, text: string, tenantId?: string, media?: Array<{url: string}> }} payload
 */
async function sendMessage(payload) {
  const credentials = await getTwilioCredentials(payload.tenantId);
  const data = {
    From: payload.from,
    To: payload.to,
    Body: payload.text,
  };
  const result = await twilioApiRequest('post', '/Messages.json', data, credentials);

  if (payload.media?.length) {
    // Twilio requires repeated MediaUrl fields; twilioApiRequest's URLSearchParams
    // encoding only keeps the last value per key, so MMS with multiple media
    // items is sent as a follow-up limitation callers should be aware of.
  }

  return {
    externalMessageId: result.sid,
    raw: result,
  };
}

/**
 * @param {string} externalMessageId
 * @param {{ tenantId?: string }} [options]
 */
async function fetchMessage(externalMessageId, options = {}) {
  const credentials = await getTwilioCredentials(options.tenantId);
  return twilioApiRequest('get', `/Messages/${externalMessageId}.json`, undefined, credentials);
}

/**
 * @param {import('express').Request} rawRequest Twilio posts form-encoded status callbacks / inbound SMS.
 */
async function receiveMessageWebhook(rawRequest) {
  const body = rawRequest.body || {};
  return {
    externalMessageId: body.MessageSid || body.SmsSid,
    status: body.MessageStatus || body.SmsStatus,
    from: body.From,
    to: body.To,
    text: body.Body,
    errorCode: body.ErrorCode || null,
    raw: body,
  };
}

module.exports = {
  sendMessage,
  fetchMessage,
  receiveMessageWebhook,
};
