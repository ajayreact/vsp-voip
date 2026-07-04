/**
 * TwilioProvider — implements ProviderInterface using Twilio Programmable
 * Voice + SIP Domain + SIP Registration (VSP Phone V3 Multi-Provider
 * Architecture, Phase 7).
 *
 * New code. Does not read or write any `telnyx*`-prefixed column, and is
 * never imported by legacy production (`lib/inboundCallControl.js`,
 * `lib/telnyxCallControl.js`, `lib/callControlSessionStore.js`) or by the
 * default (Telnyx) path of `telephony-v3` — it is only reached for a
 * tenant that has an explicit, active `TenantProvider` row pointing at
 * `twilio` (see lib/providers/ProviderResolver.js).
 */

const { ProviderInterface } = require('../ProviderInterface');
const sipCredentials = require('./sipCredentials');
const numbers = require('./numbers');
const callControl = require('./callControl');
const webhookVerify = require('./webhookVerify');
const messaging = require('./messaging');
const { buildVoiceAccessToken } = require('./accessToken');
const { getTwilioCredentials } = require('./twilioClient');

const TWILIO_CAPABILITIES = Object.freeze({
  voice: true,
  sip: true,
  numbers: true,
  recording: true,
  ivr: true,
  queue: true,
  ringGroups: true,
  conference: true,
  messaging: true,
});

class TwilioProvider extends ProviderInterface {
  constructor() {
    super('twilio');
  }

  getCapabilities() {
    return { ...TWILIO_CAPABILITIES };
  }

  async checkHealth() {
    try {
      await getTwilioCredentials(null);
      return { ok: true, checkedAt: new Date().toISOString() };
    } catch (error) {
      return { ok: false, message: error.message, checkedAt: new Date().toISOString() };
    }
  }

  // -----------------------------------------------------------------
  // SIP / Registration / Provisioning
  // -----------------------------------------------------------------

  /**
   * @param {{ tenantId?: string, credentialListSid: string, username: string, password?: string }} endpoint
   */
  async createSipCredential(endpoint) {
    const result = await sipCredentials.createSipCredential(endpoint);
    return {
      server: process.env.TWILIO_SIP_DOMAIN?.trim() || null,
      port: 5061,
      transport: 'tls',
      username: result.username,
      password: result.password,
      externalCredentialId: result.externalCredentialId,
    };
  }

  async deleteSipCredential(credentialId, options = {}) {
    return sipCredentials.deleteSipCredential({ ...options, credentialId });
  }

  async createSipDomain(tenantConfig) {
    return sipCredentials.createSipDomain(tenantConfig);
  }

  async deleteSipDomain(domain) {
    return sipCredentials.deleteSipDomain(domain);
  }

  async checkRegistrationStatus(credentialId) {
    return sipCredentials.checkRegistrationStatus(credentialId);
  }

  /**
   * @param {{ user: unknown, tenantId?: string, credentialListSid: string, includeSecrets?: boolean }} deviceContext
   */
  async provisionPhone(deviceContext) {
    const username = deviceContext?.user?.extensionNumber || deviceContext?.user?.id;
    const profile = await this.createSipCredential({
      tenantId: deviceContext?.tenantId,
      credentialListSid: deviceContext?.credentialListSid,
      username,
    });
    return {
      ...profile,
      codecs: ['G722', 'PCMU', 'PCMA'],
    };
  }

  /**
   * Twilio-specific extension (not on ProviderInterface): issues a Voice
   * SDK Access Token for a browser/mobile softphone — the analog of
   * Telnyx's `createTelephonyCredentialToken`. `outgoingApplicationParams`
   * and `pushCredentialSid` are optional VoiceGrant fields (per
   * https://www.twilio.com/docs/iam/access-tokens, verified live via the
   * twilio-docs MCP server) for passing custom outbound-call params and for
   * mobile push-notification-based incoming calls, respectively.
   */
  async createVoiceAccessToken({
    tenantId,
    identity,
    outgoingApplicationSid,
    outgoingApplicationParams,
    pushCredentialSid,
    incomingAllow,
    ttlSeconds,
  }) {
    const { accountSid } = await getTwilioCredentials(tenantId);
    const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim();
    if (!apiKeySid || !apiKeySecret) {
      throw Object.assign(new Error('TWILIO_API_KEY_SID/TWILIO_API_KEY_SECRET are not configured'), { status: 500 });
    }
    return buildVoiceAccessToken({
      accountSid,
      apiKeySid,
      apiKeySecret,
      identity,
      outgoingApplicationSid,
      outgoingApplicationParams,
      pushCredentialSid,
      incomingAllow,
      ttlSeconds,
    });
  }

  // -----------------------------------------------------------------
  // Numbers
  // -----------------------------------------------------------------

  async searchNumbers(criteria) {
    return numbers.searchNumbers(criteria);
  }

  async createPhoneNumber(number, options = {}) {
    return numbers.createPhoneNumber(number, options);
  }

  async deletePhoneNumber(externalId, options = {}) {
    return numbers.deletePhoneNumber(externalId, options);
  }

  async syncNumbers(tenantId) {
    return numbers.syncNumbers(tenantId);
  }

  // -----------------------------------------------------------------
  // Call control
  // -----------------------------------------------------------------

  async makeCall(intent) {
    return this.executeCommand({ ...intent, commandType: intent.commandType || 'DIAL' });
  }

  async hangupCall(callId, options = {}) {
    return this.executeCommand({ commandType: 'HANGUP', callControlId: callId, payload: options });
  }

  /**
   * @param {import('../ProviderInterface').CommandIntent & { tenantId?: string }} intent
   */
  async executeCommand(intent) {
    const result = await callControl.executeCommand({
      commandType: intent.commandType,
      callControlId: intent.callControlId,
      payload: intent.payload,
      tenantId: intent.tenantId,
    });
    return {
      ok: result.ok,
      skipped: result.skipped,
      reason: result.reason,
      action: result.action,
      externalRequestId: result.telnyxRequestId,
      providerResult: result.telnyxResult,
    };
  }

  // -----------------------------------------------------------------
  // Recording
  // -----------------------------------------------------------------

  async recordCall(callId, options = {}) {
    return this.executeCommand({ commandType: 'RECORD_START', callControlId: callId, payload: options });
  }

  async stopRecording(callId) {
    return this.executeCommand({ commandType: 'RECORD_STOP', callControlId: callId });
  }

  async streamRecording(_externalRecordingId) {
    return this._unsupported('streamRecording');
  }

  // -----------------------------------------------------------------
  // Webhooks
  // -----------------------------------------------------------------

  async createWebhook(_url, _events) {
    // Twilio webhook URLs are configured per SIP Domain / Incoming Phone
    // Number / TwiML App (VoiceUrl), not via a standalone webhook resource.
    return this._unsupported('createWebhook');
  }

  async receiveWebhook(rawRequest) {
    const body = rawRequest.body || {};
    return {
      providerKey: 'twilio',
      eventType: body.CallStatus || body.StatusCallbackEvent || 'unknown',
      callControlId: body.CallSid || null,
      tenantId: null,
      raw: body,
    };
  }

  async validateSignature(rawRequest) {
    return webhookVerify.validateSignature(rawRequest);
  }

  // -----------------------------------------------------------------
  // Messaging
  // -----------------------------------------------------------------

  async sendMessage(payload) {
    return messaging.sendMessage(payload);
  }

  async receiveMessageWebhook(rawRequest) {
    return messaging.receiveMessageWebhook(rawRequest);
  }
}

const instance = new TwilioProvider();

module.exports = instance;
module.exports.TwilioProvider = TwilioProvider;
module.exports.instance = instance;
