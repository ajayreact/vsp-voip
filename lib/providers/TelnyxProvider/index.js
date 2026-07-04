/**
 * TelnyxProvider — implements ProviderInterface over the existing,
 * unmodified Telnyx modules (VSP Phone V3 Multi-Provider Architecture,
 * Phase 3).
 *
 * This class is a mapping/adapter layer only. Every underlying call goes
 * to the same `lib/telnyx*.js` files that already serve 100% of production
 * traffic — nothing is duplicated or reimplemented. Legacy production
 * (`lib/inboundCallControl.js`, `lib/telnyxCallControl.js`,
 * `lib/callControlSessionStore.js`) does not import anything from this
 * directory and is completely unaffected by its existence.
 */

const { ProviderInterface } = require('../ProviderInterface');
const sipCredentials = require('./sipCredentials');
const numbers = require('./numbers');
const callControl = require('./callControl');
const webhookVerify = require('./webhookVerify');
const messaging = require('./messaging');

const TELNYX_CAPABILITIES = Object.freeze({
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

class TelnyxProvider extends ProviderInterface {
  constructor() {
    super('telnyx');
  }

  getCapabilities() {
    return { ...TELNYX_CAPABILITIES };
  }

  async checkHealth() {
    const apiKey = process.env.TELNYX_API_KEY?.trim();
    return {
      ok: Boolean(apiKey),
      message: apiKey ? undefined : 'TELNYX_API_KEY is not configured',
      checkedAt: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------
  // SIP / Registration / Provisioning
  // -----------------------------------------------------------------

  /**
   * @param {{ prisma: unknown, userId: string, tenantId: string, connectionId: string }} endpoint
   */
  async createSipCredential(endpoint) {
    const result = await sipCredentials.getOrCreateUserTelephonyCredential(endpoint);
    return {
      server: sipCredentials.DEFAULT_SIP_SERVER,
      port: sipCredentials.DEFAULT_SIP_PORT_TLS,
      transport: 'tls',
      username: result.sipUsername,
      password: null, // WebRTC flow issues a login token, not a raw SIP password
      externalCredentialId: result.credentialId,
      loginToken: result.loginToken,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  async deleteSipCredential(credentialId) {
    return sipCredentials.deleteTelephonyCredential(credentialId);
  }

  async createSipDomain(_tenantConfig) {
    // Telnyx registers individual SIP credentials against a shared Credential
    // Connection rather than a per-tenant "domain" resource; the connection
    // itself is platform-level (see lib/telnyxConfig.js / PlatformSettings).
    return this._unsupported('createSipDomain');
  }

  async checkRegistrationStatus(credentialId) {
    const detail = await sipCredentials.getTelephonyCredential(credentialId);
    return {
      registered: Boolean(detail),
      checkedAt: new Date().toISOString(),
      raw: detail,
    };
  }

  /**
   * @param {{ user: unknown, transport?: string, includeSecrets?: boolean }} deviceContext
   */
  async provisionPhone(deviceContext) {
    const sip = sipCredentials.buildTelnyxSipBlock(deviceContext?.user, {
      includeSecrets: deviceContext?.includeSecrets !== false,
      transport: deviceContext?.transport || 'TLS',
    });
    return {
      server: sip.server,
      port: sip.transport === 'UDP' || sip.transport === 'TCP' ? sip.port : sip.portTls,
      transport: String(sip.transport || 'TLS').toLowerCase(),
      username: sip.username,
      password: sip.password,
      stun: sip.stunServer,
      codecs: (sip.codecs || []).map((codec) => codec.label),
      externalCredentialId: deviceContext?.user?.telnyxCredentialId || null,
    };
  }

  // -----------------------------------------------------------------
  // Numbers
  // -----------------------------------------------------------------

  async searchNumbers(criteria) {
    const result = await numbers.searchAvailableNumbers(criteria);
    return (result.availableNumbers || []).map((entry) => ({
      number: entry.phoneNumber || entry.number,
      raw: entry,
    }));
  }

  async createPhoneNumber(number) {
    const externalId = await numbers.findTelnyxPhoneNumberId(number, numbers.getApiKey?.());
    return { number, externalNumberId: externalId };
  }

  async deletePhoneNumber(_externalId) {
    return this._unsupported('deletePhoneNumber');
  }

  async syncNumbers(_tenantId) {
    return this._unsupported('syncNumbers');
  }

  // -----------------------------------------------------------------
  // Call control
  // -----------------------------------------------------------------

  async makeCall(intent) {
    return this.executeCommand({ ...intent, commandType: intent.commandType || 'DIAL' });
  }

  async hangupCall(callId) {
    return this.executeCommand({ commandType: 'HANGUP', callControlId: callId });
  }

  /**
   * Generic dispatch — delegates to the existing, unmodified
   * lib/telephony-v3/Executor/telnyxAdapter.js#executeCommand.
   * @param {import('../ProviderInterface').CommandIntent} intent
   */
  async executeCommand(intent) {
    const result = await callControl.executeCommand({
      commandType: intent.commandType,
      callControlId: intent.callControlId,
      payload: intent.payload,
      commandId: intent.commandId,
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
    // Telnyx webhook URL/events are configured on the Call Control
    // Application (see lib/telnyxCallControlSetup.js), not per-call.
    return this._unsupported('createWebhook');
  }

  async receiveWebhook(rawRequest) {
    const body = webhookVerify.parseTelnyxWebhookBody
      ? await webhookVerify.parseTelnyxWebhookBody(rawRequest)
      : rawRequest.body;
    const payload = body?.data || body;
    return {
      providerKey: 'telnyx',
      eventType: payload?.event_type || 'unknown',
      callControlId: payload?.payload?.call_control_id || null,
      tenantId: null,
      raw: body,
    };
  }

  async validateSignature(rawRequest) {
    try {
      await new Promise((resolve, reject) => {
        webhookVerify.verifyTelnyxWebhookMiddleware(rawRequest, {
          status: () => ({ send: (msg) => reject(new Error(msg)) }),
        }, resolve);
      });
      return true;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------
  // Messaging
  // -----------------------------------------------------------------

  async sendMessage(payload) {
    const result = await messaging.sendTelnyxMessage(payload);
    return { externalMessageId: result?.data?.id || result?.id, raw: result };
  }

  async receiveMessageWebhook(rawRequest) {
    return rawRequest.body;
  }
}

const instance = new TelnyxProvider();

module.exports = instance;
module.exports.TelnyxProvider = TelnyxProvider;
module.exports.instance = instance;
