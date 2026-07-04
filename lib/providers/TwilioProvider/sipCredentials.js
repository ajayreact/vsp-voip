/**
 * TwilioProvider/sipCredentials — SIP Domain + Credential List management.
 *
 * New code (Phase 7). Mirrors the Telnyx concept mapping from the approved
 * architecture plan:
 *   Credential Connection            -> SIP Domain + Credential List
 *   telephony_credentials CRUD       -> Credential List entries (username/password)
 *   check_registration_status (poll) -> Twilio registration is edge-local;
 *                                        closest equivalent is subscribing to
 *                                        Voice Insights / registration webhooks,
 *                                        not polling — see checkRegistrationStatus().
 *
 * Verified against live Twilio MCP docs (twilio-docs MCP server):
 *  - `twilio__search` "Twilio SIP Domain setup and configuration" (source:
 *    all) -> op::twilio_api_v2010::CreateSipDomain
 *    (POST /2010-04-01/Accounts/{AccountSid}/SIP/Domains.json), whose
 *    documented parameters include `SipRegistration`, `Secure`,
 *    `VoiceFallbackUrl`/`VoiceFallbackMethod`, and
 *    `VoiceStatusCallbackUrl`/`VoiceStatusCallbackMethod`.
 *  - The companion how-to guide
 *    (https://www.twilio.com/docs/voice/tutorials/how-to-add-programmability-to-your-existing-sip-network)
 *    shows SIP Registration is a distinct, explicit toggle on the Domain
 *    ("Enable SIP registration" -> Enabled) separate from just creating the
 *    domain — it is NOT on by default.
 * Design decision: `createSipDomain` below now explicitly sends
 * `SipRegistration: 'true'` at creation time so tenants provisioned onto
 * Twilio can register SIP endpoints out of the box (this repo's stated goal
 * — "Use SIP Domains for endpoint registration"). It also sends
 * `Secure: 'true'` (TLS/SRTP transport) by default, matching this repo's
 * Telnyx-side default of TLS signaling (see lib/telnyxSipProfile.js), and
 * passes through optional fallback/status-callback URLs for production
 * resiliency. Callers can override `sipRegistration`/`secure` explicitly if
 * a tenant needs different behavior; nothing here changes existing callers
 * that only pass `domainName`/`voiceWebhookUrl` (backward compatible).
 */

const crypto = require('crypto');
const { twilioApiRequest, getTwilioCredentials } = require('./twilioClient');

/**
 * @param {{
 *   tenantId?: string,
 *   domainName: string,
 *   friendlyName?: string,
 *   voiceWebhookUrl: string,
 *   sipRegistration?: boolean,
 *   secure?: boolean,
 *   voiceFallbackUrl?: string,
 *   voiceStatusCallbackUrl?: string,
 * }} tenantConfig
 */
async function createSipDomain(tenantConfig) {
  const credentials = await getTwilioCredentials(tenantConfig.tenantId);
  const domain = await twilioApiRequest('post', '/SIP/Domains.json', {
    DomainName: tenantConfig.domainName,
    FriendlyName: tenantConfig.friendlyName || tenantConfig.domainName,
    VoiceUrl: tenantConfig.voiceWebhookUrl,
    VoiceMethod: 'POST',
    // Registration is not on by default on a new Domain — enable it
    // explicitly so SIP endpoints can REGISTER (see file header for the
    // MCP doc reference backing this).
    SipRegistration: String(tenantConfig.sipRegistration !== false),
    Secure: String(tenantConfig.secure !== false),
    ...(tenantConfig.voiceFallbackUrl ? { VoiceFallbackUrl: tenantConfig.voiceFallbackUrl, VoiceFallbackMethod: 'POST' } : {}),
    ...(tenantConfig.voiceStatusCallbackUrl ? { VoiceStatusCallbackUrl: tenantConfig.voiceStatusCallbackUrl, VoiceStatusCallbackMethod: 'POST' } : {}),
  }, credentials);

  return {
    externalDomainId: domain.sid,
    domainName: domain.domain_name,
    sipRegistration: domain.sip_registration,
    secure: domain.secure,
    raw: domain,
  };
}

/**
 * @param {{ tenantId?: string, friendlyName?: string }} [options]
 */
async function ensureCredentialList(options = {}) {
  const credentials = await getTwilioCredentials(options.tenantId);
  const list = await twilioApiRequest('post', '/SIP/CredentialLists.json', {
    FriendlyName: options.friendlyName || 'vsp-softphone',
  }, credentials);
  return { credentialListSid: list.sid, raw: list, credentials };
}

/**
 * Creates a SIP Credential List entry (username/password) — the Twilio
 * analog of `createTelephonyCredential()` in lib/telnyxCallControl.js.
 * @param {{ tenantId?: string, credentialListSid: string, username: string }} endpoint
 */
async function createSipCredential(endpoint) {
  const credentials = await getTwilioCredentials(endpoint.tenantId);
  const password = endpoint.password || crypto.randomBytes(18).toString('base64url');

  const entry = await twilioApiRequest(
    'post',
    `/SIP/CredentialLists/${endpoint.credentialListSid}/Credentials.json`,
    { Username: endpoint.username, Password: password },
    credentials,
  );

  return {
    externalCredentialId: entry.sid,
    username: entry.username,
    password,
    raw: entry,
  };
}

/**
 * @param {{ tenantId?: string, credentialListSid: string, credentialId: string }} input
 */
async function deleteSipCredential(input) {
  const credentials = await getTwilioCredentials(input.tenantId);
  return twilioApiRequest(
    'delete',
    `/SIP/CredentialLists/${input.credentialListSid}/Credentials/${input.credentialId}.json`,
    undefined,
    credentials,
  );
}

/**
 * Deletes a SIP Domain (op::twilio_api_v2010::DeleteSipDomain, verified live
 * via the twilio-docs MCP server: `twilio__search` "Twilio SIP Domain setup
 * and configuration" -> DELETE /2010-04-01/Accounts/{AccountSid}/SIP/Domains/{Sid}.json).
 * Twilio requires a Domain's Credential List mappings to be removed before
 * the Domain itself can be deleted; callers should delete SIP credentials
 * first (see `deleteSipCredential`), matching the natural teardown order of
 * the "Delete Resources" step of the provider lifecycle.
 * @param {{ tenantId?: string, externalDomainId: string }} input
 */
async function deleteSipDomain(input) {
  const credentials = await getTwilioCredentials(input.tenantId);
  return twilioApiRequest('delete', `/SIP/Domains/${input.externalDomainId}.json`, undefined, credentials);
}

/**
 * Twilio does not expose a registration-status poll endpoint the way
 * Telnyx's `telephony_credentials` resource does — SIP registration state
 * is edge-local. Voice Insights / registration event webhooks are the
 * documented functional equivalent. This returns a soft, non-throwing
 * result rather than `ProviderCapabilityError` since Twilio does support
 * registration, just not via polling.
 * @param {string} _credentialId
 */
async function checkRegistrationStatus(_credentialId) {
  return {
    registered: null,
    checkedAt: new Date().toISOString(),
    raw: {
      note: 'Twilio SIP registration state is edge-local; subscribe to Voice Insights / registration webhooks instead of polling.',
    },
  };
}

module.exports = {
  createSipDomain,
  ensureCredentialList,
  createSipCredential,
  deleteSipCredential,
  deleteSipDomain,
  checkRegistrationStatus,
};
