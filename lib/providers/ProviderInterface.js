/**
 * ProviderInterface — the contract every telephony provider module must
 * implement (VSP Phone V3 Multi-Provider Architecture, Phase 2).
 *
 * This is a plain-JS abstract base class (JSDoc-typed, not TypeScript) to
 * match the existing `lib/` convention in this repo. Concrete providers
 * (`lib/providers/TelnyxProvider`, `lib/providers/TwilioProvider`, and any
 * future provider such as SignalWire/Plivo/Vonage) extend this class and
 * override only the methods they support.
 *
 * Design notes (see the approved architecture plan for full rationale):
 *  - The method groups below mirror the intent surface `telephony-v3`
 *    already uses (`V3CommandIntent`, `V3CommandType`), so wiring an
 *    existing provider-agnostic engine to a new provider is mechanical.
 *  - `executeCommand(intent)` is a single generic dispatch method for call
 *    control, mirroring what `lib/telephony-v3/Executor/telnyxAdapter.js`
 *    already does internally — call control has ~15 distinct actions
 *    (answer/dial/gather/record/hold/transfer/conference/etc.) and a giant
 *    flat interface would be unwieldy.
 *  - Any method a provider does not support MUST throw
 *    `ProviderCapabilityError` rather than silently no-op, so callers
 *    (e.g. `telephony-v3`'s conference/queue policies) can gate features
 *    per-provider via `getCapabilities()`.
 *  - Nothing here changes or wraps the legacy production call-control path
 *    (`lib/inboundCallControl.js`, `lib/telnyxCallControl.js`,
 *    `lib/callControlSessionStore.js`). Those files remain untouched and
 *    continue to talk to Telnyx directly.
 */

/**
 * @typedef {Object} ProviderCapabilities
 * @property {boolean} voice
 * @property {boolean} sip
 * @property {boolean} numbers
 * @property {boolean} recording
 * @property {boolean} ivr
 * @property {boolean} queue
 * @property {boolean} ringGroups
 * @property {boolean} conference
 * @property {boolean} messaging
 */

/**
 * Neutral SIP profile DTO returned by `provisionPhone()` / `createSipCredential()`,
 * consumed by lib/v3/deviceTemplateService.js's `buildProvisionContext`.
 * @typedef {Object} SipProfileDTO
 * @property {string} server
 * @property {number} port
 * @property {'udp'|'tcp'|'tls'} transport
 * @property {string} username
 * @property {string} password
 * @property {string} [stun]
 * @property {string[]} [codecs]
 * @property {string} [externalCredentialId] Provider-side credential/resource ID.
 */

/**
 * @typedef {Object} NumberSearchCriteria
 * @property {string} [areaCode]
 * @property {string} [country]
 * @property {number} [limit]
 */

/**
 * Provider-neutral phone number DTO.
 * @typedef {Object} NumberDTO
 * @property {string} number E.164 formatted number.
 * @property {string} [externalNumberId] Provider-side resource ID (e.g. Telnyx phone_number id, Twilio Sid).
 * @property {string} [externalConnectionId]
 * @property {Record<string, unknown>} [raw]
 */

/**
 * Abstract call-control command, matching telephony-v3's V3CommandIntent shape.
 * @typedef {Object} CommandIntent
 * @property {string} commandType One of the V3CommandType enum values (DIAL, ANSWER, BRIDGE, HANGUP, ...).
 * @property {string} [callControlId] Provider-side call/session identifier.
 * @property {Record<string, unknown>} [payload]
 * @property {string} [commandId]
 */

/**
 * @typedef {Object} CommandResult
 * @property {boolean} ok
 * @property {boolean} [skipped]
 * @property {string} [action]
 * @property {string|null} [externalRequestId]
 * @property {unknown} [providerResult]
 */

/**
 * @typedef {Object} NormalizedWebhookEvent
 * @property {string} providerKey
 * @property {string} eventType Normalized/internal event type.
 * @property {string} [callControlId]
 * @property {string} [tenantId]
 * @property {Record<string, unknown>} raw
 */

/**
 * @typedef {Object} MessagePayload
 * @property {string} from
 * @property {string} to
 * @property {string} text
 * @property {string} [tenantId]
 * @property {Array<{url: string, contentType?: string}>} [media]
 */

/**
 * Thrown when a provider does not support a given ProviderInterface method.
 * Callers should catch this to gate optional features per-provider via
 * `getCapabilities()` rather than treating it as a generic failure.
 */
class ProviderCapabilityError extends Error {
  /**
   * @param {string} providerKey
   * @param {string} method
   */
  constructor(providerKey, method) {
    super(`Provider "${providerKey}" does not implement capability "${method}"`);
    this.name = 'ProviderCapabilityError';
    this.providerKey = providerKey;
    this.method = method;
    this.status = 501;
  }
}

class ProviderInterface {
  /**
   * @param {string} providerKey
   */
  constructor(providerKey) {
    if (new.target === ProviderInterface) {
      throw new Error('ProviderInterface is abstract and cannot be instantiated directly');
    }
    /** @type {string} */
    this.providerKey = providerKey;
  }

  /**
   * @param {string} method
   * @returns {never}
   */
  _unsupported(method) {
    throw new ProviderCapabilityError(this.getProviderKey(), method);
  }

  // ---------------------------------------------------------------------
  // Identity / lifecycle
  // ---------------------------------------------------------------------

  /** @returns {string} */
  getProviderKey() {
    return this.providerKey;
  }

  /** @returns {ProviderCapabilities} */
  getCapabilities() {
    return {
      voice: false,
      sip: false,
      numbers: false,
      recording: false,
      ivr: false,
      queue: false,
      ringGroups: false,
      conference: false,
      messaging: false,
    };
  }

  /**
   * Lightweight connectivity/credential health check, used by
   * `ProviderManager` for the Super Admin Providers tab.
   * @returns {Promise<{ ok: boolean, message?: string, checkedAt: string }>}
   */
  async checkHealth() {
    return { ok: true, checkedAt: new Date().toISOString() };
  }

  // ---------------------------------------------------------------------
  // SIP / Registration / Provisioning
  // ---------------------------------------------------------------------

  /**
   * @param {Record<string, unknown>} _endpoint
   * @returns {Promise<SipProfileDTO>}
   */
  async createSipCredential(_endpoint) {
    return this._unsupported('createSipCredential');
  }

  /**
   * @param {string} _credentialId
   * @returns {Promise<void>}
   */
  async deleteSipCredential(_credentialId) {
    return this._unsupported('deleteSipCredential');
  }

  /**
   * @param {Record<string, unknown>} _tenantConfig
   * @returns {Promise<Record<string, unknown>>}
   */
  async createSipDomain(_tenantConfig) {
    return this._unsupported('createSipDomain');
  }

  /**
   * Counterpart to `createSipDomain()`, used by the Super Admin provider
   * lifecycle's teardown/cleanup step. Optional — providers without a
   * distinct "domain" resource (or that don't support programmatic
   * deletion) should leave this unimplemented; callers gate on
   * `getCapabilities().sip` plus a try/catch for `ProviderCapabilityError`.
   * @param {{ externalDomainId: string }} _domain
   * @returns {Promise<void>}
   */
  async deleteSipDomain(_domain) {
    return this._unsupported('deleteSipDomain');
  }

  /**
   * @param {string} _credentialId
   * @returns {Promise<{ registered: boolean, checkedAt: string, raw?: unknown }>}
   */
  async checkRegistrationStatus(_credentialId) {
    return this._unsupported('checkRegistrationStatus');
  }

  /**
   * @param {Record<string, unknown>} _deviceContext
   * @returns {Promise<SipProfileDTO>}
   */
  async provisionPhone(_deviceContext) {
    return this._unsupported('provisionPhone');
  }

  // ---------------------------------------------------------------------
  // Numbers
  // ---------------------------------------------------------------------

  /**
   * @param {NumberSearchCriteria} _criteria
   * @returns {Promise<NumberDTO[]>}
   */
  async searchNumbers(_criteria) {
    return this._unsupported('searchNumbers');
  }

  /**
   * @param {string} _number E.164 formatted number.
   * @returns {Promise<NumberDTO>}
   */
  async createPhoneNumber(_number) {
    return this._unsupported('createPhoneNumber');
  }

  /**
   * @param {string} _externalId
   * @returns {Promise<void>}
   */
  async deletePhoneNumber(_externalId) {
    return this._unsupported('deletePhoneNumber');
  }

  /**
   * @param {string} _tenantId
   * @returns {Promise<NumberDTO[]>}
   */
  async syncNumbers(_tenantId) {
    return this._unsupported('syncNumbers');
  }

  // ---------------------------------------------------------------------
  // Call control
  // ---------------------------------------------------------------------

  /**
   * @param {CommandIntent} _intent
   * @returns {Promise<CommandResult>}
   */
  async makeCall(_intent) {
    return this._unsupported('makeCall');
  }

  /**
   * @param {string} _callId
   * @returns {Promise<CommandResult>}
   */
  async hangupCall(_callId) {
    return this._unsupported('hangupCall');
  }

  /**
   * Generic call-control dispatch. This is the primary integration point
   * used by `telephony-v3`'s `commandExecutor` (via `ProviderResolver`).
   * @param {CommandIntent} _intent
   * @returns {Promise<CommandResult>}
   */
  async executeCommand(_intent) {
    return this._unsupported('executeCommand');
  }

  // ---------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------

  /**
   * @param {string} _callId
   * @param {Record<string, unknown>} [_options]
   * @returns {Promise<CommandResult>}
   */
  async recordCall(_callId, _options) {
    return this._unsupported('recordCall');
  }

  /**
   * @param {string} _callId
   * @returns {Promise<CommandResult>}
   */
  async stopRecording(_callId) {
    return this._unsupported('stopRecording');
  }

  /**
   * @param {string} _externalRecordingId
   * @returns {Promise<{ url: string, raw?: unknown }>}
   */
  async streamRecording(_externalRecordingId) {
    return this._unsupported('streamRecording');
  }

  // ---------------------------------------------------------------------
  // Webhooks
  // ---------------------------------------------------------------------

  /**
   * @param {string} _url
   * @param {string[]} _events
   * @returns {Promise<Record<string, unknown>>}
   */
  async createWebhook(_url, _events) {
    return this._unsupported('createWebhook');
  }

  /**
   * @param {import('express').Request} _rawRequest
   * @returns {Promise<NormalizedWebhookEvent>}
   */
  async receiveWebhook(_rawRequest) {
    return this._unsupported('receiveWebhook');
  }

  /**
   * @param {import('express').Request} _rawRequest
   * @returns {Promise<boolean>}
   */
  async validateSignature(_rawRequest) {
    return this._unsupported('validateSignature');
  }

  // ---------------------------------------------------------------------
  // Messaging (SMS/MMS)
  // ---------------------------------------------------------------------

  /**
   * @param {MessagePayload} _payload
   * @returns {Promise<{ externalMessageId: string, raw?: unknown }>}
   */
  async sendMessage(_payload) {
    return this._unsupported('sendMessage');
  }

  /**
   * @param {import('express').Request} _rawRequest
   * @returns {Promise<Record<string, unknown>>}
   */
  async receiveMessageWebhook(_rawRequest) {
    return this._unsupported('receiveMessageWebhook');
  }
}

module.exports = {
  ProviderInterface,
  ProviderCapabilityError,
};
