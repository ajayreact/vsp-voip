/**
 * TwilioProvider/numbers — Twilio Incoming Phone Numbers API.
 * New code (Phase 7).
 *
 * Verified against live Twilio MCP docs (twilio-docs MCP server,
 * `twilio__search` "IncomingPhoneNumber resource create voice url sms url
 * capabilities", source: api) -> op::twilio_api_v2010::CreateIncomingPhoneNumber
 * (POST /2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers.json).
 * Documented params used below beyond the original VoiceUrl-only wiring:
 * `SmsUrl`/`SmsMethod` (so a number purchased for this provider can also
 * receive inbound SMS, matching the `messaging: true` capability declared
 * in TwilioProvider/index.js) and `FriendlyName`. All new options are
 * optional passthroughs — existing callers that only pass a bare
 * `voiceWebhookUrl` are unaffected (backward compatible).
 */

const { twilioApiRequest, getTwilioCredentials } = require('./twilioClient');

/**
 * @param {{ tenantId?: string, areaCode?: string, country?: string, limit?: number }} criteria
 */
async function searchNumbers(criteria = {}) {
  const credentials = await getTwilioCredentials(criteria.tenantId);
  const country = (criteria.country || 'US').toUpperCase();
  const result = await twilioApiRequest('get', `/AvailablePhoneNumbers/${country}/Local.json`, {
    ...(criteria.areaCode ? { AreaCode: criteria.areaCode } : {}),
    PageSize: criteria.limit || 20,
  }, credentials);

  return (result.available_phone_numbers || []).map((entry) => ({
    number: entry.phone_number,
    raw: entry,
  }));
}

/**
 * @param {string} number E.164 formatted number.
 * @param {{ tenantId?: string, voiceWebhookUrl?: string, smsWebhookUrl?: string, friendlyName?: string }} [options]
 */
async function createPhoneNumber(number, options = {}) {
  const credentials = await getTwilioCredentials(options.tenantId);
  const result = await twilioApiRequest('post', '/IncomingPhoneNumbers.json', {
    PhoneNumber: number,
    ...(options.friendlyName ? { FriendlyName: options.friendlyName } : {}),
    ...(options.voiceWebhookUrl ? { VoiceUrl: options.voiceWebhookUrl, VoiceMethod: 'POST' } : {}),
    ...(options.smsWebhookUrl ? { SmsUrl: options.smsWebhookUrl, SmsMethod: 'POST' } : {}),
  }, credentials);

  return {
    number: result.phone_number,
    externalNumberId: result.sid,
    raw: result,
  };
}

/**
 * @param {string} externalId Twilio IncomingPhoneNumber Sid.
 * @param {{ tenantId?: string }} [options]
 */
async function deletePhoneNumber(externalId, options = {}) {
  const credentials = await getTwilioCredentials(options.tenantId);
  return twilioApiRequest('delete', `/IncomingPhoneNumbers/${externalId}.json`, undefined, credentials);
}

/**
 * @param {string} tenantId
 */
async function syncNumbers(tenantId) {
  const credentials = await getTwilioCredentials(tenantId);
  const result = await twilioApiRequest('get', '/IncomingPhoneNumbers.json', { PageSize: 1000 }, credentials);
  return (result.incoming_phone_numbers || []).map((entry) => ({
    number: entry.phone_number,
    externalNumberId: entry.sid,
    raw: entry,
  }));
}

module.exports = {
  searchNumbers,
  createPhoneNumber,
  deletePhoneNumber,
  syncNumbers,
};
