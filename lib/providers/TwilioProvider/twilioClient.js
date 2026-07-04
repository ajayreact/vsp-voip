/**
 * TwilioProvider/twilioClient — low-level Twilio REST API client.
 *
 * New code (Phase 7). Twilio's REST API takes `application/x-www-form-urlencoded`
 * bodies (unlike Telnyx's JSON API), and authenticates with HTTP Basic Auth
 * using Account SID / Auth Token — this module encapsulates both differences
 * so the rest of TwilioProvider can stay symmetrical with TelnyxProvider.
 *
 * Credential resolution order (mirrors the TELNYX_API_KEY env-var fallback
 * pattern used throughout the existing Telnyx modules):
 *   1. Per-tenant ProviderCredential row (scope=VOICE, tenantId=<tenant>)
 *   2. Platform-level ProviderCredential row (scope=VOICE, tenantId=null)
 *   3. TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN environment variables
 */

const axios = require('axios');

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

/**
 * @param {string|null} [tenantId]
 * @returns {Promise<{ accountSid: string, authToken: string }>}
 */
async function getTwilioCredentials(tenantId) {
  try {
    const ProviderManager = require('../ProviderManager');
    if (tenantId) {
      const tenantCred = await ProviderManager.getCredential(
        { tenantId, providerKey: 'twilio', scope: 'VOICE' },
        { reveal: true },
      );
      if (tenantCred?.externalAccountId && tenantCred?.authToken) {
        return { accountSid: tenantCred.externalAccountId, authToken: tenantCred.authToken };
      }
    }

    const platformCred = await ProviderManager.getCredential(
      { tenantId: null, providerKey: 'twilio', scope: 'VOICE' },
      { reveal: true },
    );
    if (platformCred?.externalAccountId && platformCred?.authToken) {
      return { accountSid: platformCred.externalAccountId, authToken: platformCred.authToken };
    }
  } catch {
    // fall through to env vars — e.g. Provider tables not migrated/seeded yet
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) {
    throw Object.assign(new Error('Twilio credentials are not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN or ProviderCredential row)'), { status: 500 });
  }
  return { accountSid, authToken };
}

/**
 * @param {'get'|'post'|'delete'} method
 * @param {string} path Path relative to /Accounts/{accountSid}, e.g. "/IncomingPhoneNumbers.json"
 * @param {Record<string, unknown>} [data] Form fields for POST, or query params for GET.
 * @param {{ accountSid: string, authToken: string }} [credentials]
 */
async function twilioApiRequest(method, path, data, credentials) {
  const creds = credentials || (await getTwilioCredentials(null));
  const url = `${TWILIO_API_BASE}/Accounts/${creds.accountSid}${path}`;

  const config = {
    method,
    url,
    auth: { username: creds.accountSid, password: creds.authToken },
    timeout: 20000,
  };

  if (data && method === 'get') {
    config.params = data;
  } else if (data) {
    config.data = new URLSearchParams(
      Object.entries(data)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    config.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    const status = error.response?.status || 502;
    const twilioError = error.response?.data;
    const message = twilioError?.message || error.message || 'Twilio API request failed';
    throw Object.assign(new Error(message), { status, twilio: twilioError });
  }
}

module.exports = {
  TWILIO_API_BASE,
  getTwilioCredentials,
  twilioApiRequest,
};
