/**
 * Deterministic Telnyx production configuration verifier.
 * Compares expected VSP architecture vs live Telnyx API — facts only, no inference.
 */
const axios = require('axios');
const { loadPlatformSettings } = require('./platformSettings');
const { getCredentialConnectionId } = require('./telnyxConfig');
const { getApiPublicUrl, getCredentialConnection } = require('./telnyxRecordingSetup');
const {
  getCallControlApplicationId,
  getV3CallControlApplicationId,
  getCallControlApplication,
} = require('./telnyxCallControlSetup');
const { telnyxApiRequest } = require('./telnyxCallControl');
const { fixTelnyxProduction } = require('./telnyxProductionSetup');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();

const AUTO_FIX_API = {
  'credential_connection.active': 'PATCH /v2/credential_connections/{id}',
  'credential_connection.webhook': 'PATCH /v2/credential_connections/{id}',
  'credential_connection.parking': 'PATCH /v2/credential_connections/{id}',
  'credential_connection.sip_uri': 'PATCH /v2/credential_connections/{id}',
  'credential_connection.ovp_id': 'PATCH /v2/credential_connections/{id}',
  'ovp.enabled': 'PATCH /v2/outbound_voice_profiles/{id}',
  'ovp.whitelist_us': 'PATCH /v2/outbound_voice_profiles/{id}',
  'legacy_app.webhook': 'PATCH /v2/call_control_applications/{id}',
  'legacy_app.active': 'PATCH /v2/call_control_applications/{id}',
  'v3_app.webhook': 'PATCH /v2/call_control_applications/{id}',
  'v3_app.active': 'PATCH /v2/call_control_applications/{id}',
  'v3_app.ovp_id': 'PATCH /v2/call_control_applications/{id}',
  'phone_number.connection_id': 'PATCH /v2/phone_numbers/{id}',
};

/**
 * @typedef {{
 *   layer: string,
 *   field: string,
 *   apiField: string|null,
 *   apiEndpoint: string|null,
 *   expected: unknown,
 *   actual: unknown,
 *   pass: boolean,
 *   autoFixable: boolean,
 *   autoFixApi: string|null,
 *   warning: boolean,
 *   reason: string|null,
 * }} ConfigCheck
 */

function telnyxHeaders() {
  return {
    Authorization: `Bearer ${TELNYX_API_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function expectedUrls() {
  const base = getApiPublicUrl()?.replace(/\/$/, '') || null;
  return {
    base,
    callControl: base ? `${base}/webhook/call-control` : null,
    v3CallControl: base ? `${base}/webhook/v3/call-control` : null,
    voice: base ? `${base}/webhook/voice` : null,
  };
}

function getNested(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function pushCheck(checks, opts) {
  const {
    layer,
    field,
    apiField = null,
    apiEndpoint = null,
    expected,
    actual,
    pass,
    autoFixable = false,
    autoFixKey = null,
    warning = false,
    reason = null,
  } = opts;

  checks.push({
    layer,
    field,
    apiField,
    apiEndpoint,
    expected: expected === undefined ? null : expected,
    actual: actual === undefined ? null : actual,
    pass: Boolean(pass),
    autoFixable,
    autoFixApi: autoFixable && autoFixKey ? (AUTO_FIX_API[autoFixKey] || null) : null,
    warning,
    reason,
  });
}

function envValue(name) {
  const v = process.env[name];
  return v == null ? null : String(v).trim() || null;
}

function buildExpectedConfig(platform) {
  const urls = expectedUrls();
  const credentialConnectionId = getCredentialConnectionId(platform)
    || envValue('TELNYX_CREDENTIAL_CONNECTION_ID');
  const legacyCallControlAppId = getCallControlApplicationId(platform)
    || envValue('TELNYX_CALL_CONTROL_APP_ID');
  const v3CallControlAppId = getV3CallControlApplicationId()
    || envValue('TELNYX_V3_CALL_CONTROL_APP_ID');
  const outboundVoiceProfileId = envValue('TELNYX_OUTBOUND_VOICE_PROFILE_ID');
  const credentialConnectionName = platform?.telnyxConnectionName
    || envValue('TELNYX_CONNECTION_NAME')
    || 'VSP-SIP-Trunk';

  return {
    urls,
    ids: {
      credentialConnectionId,
      legacyCallControlAppId,
      v3CallControlAppId,
      outboundVoiceProfileId,
      tenantId: null,
    },
    env: [
      { field: 'TELNYX_API_KEY', expected: 'set', compare: (v) => (v ? 'set' : 'missing') },
      { field: 'TELNYX_PUBLIC_KEY', expected: 'set', compare: (v) => (v ? 'set' : 'missing') },
      { field: 'API_PUBLIC_URL', expected: urls.base, compare: (v) => v },
      { field: 'TELNYX_CREDENTIAL_CONNECTION_ID', expected: credentialConnectionId, compare: (v) => v },
      { field: 'TELNYX_CALL_CONTROL_APP_ID', expected: legacyCallControlAppId, compare: (v) => v },
      { field: 'TELNYX_V3_CALL_CONTROL_APP_ID', expected: v3CallControlAppId, compare: (v) => v },
      { field: 'TELNYX_OUTBOUND_VOICE_PROFILE_ID', expected: outboundVoiceProfileId, compare: (v) => v },
      { field: 'TELEPHONY_V3_INGRESS_ENABLED', expected: 'true', compare: (v) => v },
      { field: 'TELEPHONY_V3_EXECUTOR_ENABLED', expected: 'true', compare: (v) => v },
      { field: 'TELEPHONY_V3_CALLMANAGER_ENABLED', expected: 'true', compare: (v) => v },
    ],
    credentialConnection: {
      apiEndpoint: 'GET /v2/credential_connections/{id}',
      id: credentialConnectionId,
      connection_name: credentialConnectionName,
      active: true,
      webhook_event_url: urls.voice,
      webhook_api_version: '2',
      sip_uri_calling_preference: 'internal',
      'outbound.call_parking_enabled': true,
      'outbound.outbound_voice_profile_id': outboundVoiceProfileId,
      anchorsite_override: 'Latency',
    },
    outboundVoiceProfile: {
      apiEndpoint: 'GET /v2/outbound_voice_profiles/{id}',
      id: outboundVoiceProfileId,
      enabled: true,
      connection_id: v3CallControlAppId,
      connections_count_min: 1,
      whitelisted_destinations_includes: 'US',
      traffic_type: 'conversational',
      concurrent_call_limit_not_zero: true,
    },
    legacyCallControlApp: {
      apiEndpoint: 'GET /v2/call_control_applications/{id}',
      id: legacyCallControlAppId,
      active: true,
      webhook_event_url: urls.callControl,
      webhook_api_version: '2',
      'outbound.outbound_voice_profile_id': null,
      'inbound.channel_limit_not_zero': true,
    },
    v3CallControlApp: {
      apiEndpoint: 'GET /v2/call_control_applications/{id}',
      id: v3CallControlAppId,
      active: true,
      webhook_event_url: urls.v3CallControl,
      webhook_api_version: '2',
      'outbound.outbound_voice_profile_id': outboundVoiceProfileId,
      'outbound.channel_limit_not_zero': true,
    },
    phoneNumber: {
      apiEndpoint: 'GET /v2/phone_numbers?filter[phone_number]=',
      connection_id: legacyCallControlAppId,
      status: 'active',
    },
    sipCredential: {
      registration_status: 'Registered',
      password_exists: true,
      connection_id: credentialConnectionId,
    },
  };
}

async function fetchPhoneNumber(e164) {
  if (!TELNYX_API_KEY || !e164) return null;
  const res = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
    headers: telnyxHeaders(),
    params: { 'filter[phone_number]': e164 },
    timeout: 15000,
  });
  return res.data?.data?.[0] ?? null;
}

async function fetchOutboundVoiceProfile(profileId) {
  if (!profileId) return null;
  try {
    return await telnyxApiRequest('get', `/outbound_voice_profiles/${encodeURIComponent(profileId)}`);
  } catch {
    return null;
  }
}

async function fetchCredentialsBySipUsername(sipUsername) {
  if (!TELNYX_API_KEY || !sipUsername) return null;
  try {
    const res = await axios.get('https://api.telnyx.com/v2/credentials', {
      headers: telnyxHeaders(),
      params: { 'filter[sip_username]': sipUsername, 'page[size]': 5 },
      timeout: 15000,
    });
    return res.data?.data?.[0] ?? null;
  } catch {
    return null;
  }
}

async function checkSipRegistration(connectionId, sipUsername) {
  if (!TELNYX_API_KEY || !connectionId || !sipUsername) {
    return { status: null, error: 'missing_connection_or_username' };
  }
  try {
    const res = await axios.post(
      `https://api.telnyx.com/v2/credential_connections/${connectionId}/actions/check_registration_status`,
      { sip_username: sipUsername },
      { headers: telnyxHeaders(), timeout: 15000 },
    );
    return {
      status: res.data?.data?.status || res.data?.status || null,
      error: null,
      apiEndpoint: `POST /v2/credential_connections/${connectionId}/actions/check_registration_status`,
    };
  } catch (error) {
    return {
      status: null,
      error: error.response?.data?.errors?.[0]?.detail || error.message,
      apiEndpoint: `POST /v2/credential_connections/${connectionId}/actions/check_registration_status`,
    };
  }
}

async function fetchDetailRecords(params) {
  if (!TELNYX_API_KEY) return [];
  try {
    const res = await axios.get('https://api.telnyx.com/v2/detail_records', {
      headers: telnyxHeaders(),
      params: { 'page[size]': 5, ...params },
      timeout: 20000,
    });
    return res.data?.data || [];
  } catch {
    return [];
  }
}

async function fetchWebhookDeliveries(limit = 10) {
  if (!TELNYX_API_KEY) return [];
  try {
    const res = await axios.get('https://api.telnyx.com/v2/webhook_deliveries', {
      headers: telnyxHeaders(),
      params: { 'page[size]': limit },
      timeout: 20000,
    });
    return res.data?.data || [];
  } catch {
    return [];
  }
}

async function fetchAccountBalance() {
  if (!TELNYX_API_KEY) return null;
  try {
    const res = await axios.get('https://api.telnyx.com/v2/balance', { headers: telnyxHeaders(), timeout: 15000 });
    return res.data?.data || null;
  } catch {
    return null;
  }
}

function verifyEnvironment(checks, expectedConfig) {
  for (const spec of expectedConfig.env) {
    const raw = envValue(spec.field);
    const actual = spec.compare(raw);
    pushCheck(checks, {
      layer: 'environment',
      field: spec.field,
      apiField: null,
      apiEndpoint: null,
      expected: spec.expected,
      actual,
      pass: actual === spec.expected,
      autoFixable: false,
    });
  }
}

function verifyCredentialConnection(checks, expected, connection) {
  const layer = 'credential_connection';
  const ep = expected.apiEndpoint;

  if (!expected.id) {
    pushCheck(checks, {
      layer, field: 'id', apiEndpoint: ep, expected: 'configured', actual: null, pass: false,
      reason: 'TELNYX_CREDENTIAL_CONNECTION_ID not set',
    });
    return;
  }
  if (!connection) {
    pushCheck(checks, {
      layer, field: 'id', apiField: 'id', apiEndpoint: ep,
      expected: expected.id, actual: null, pass: false,
      reason: 'Telnyx API returned no connection',
    });
    return;
  }

  const scalarFields = [
    ['id', 'id', expected.id, connection.id, false, null],
    ['connection_name', 'connection_name', expected.connection_name, connection.connection_name, false, null],
    ['active', 'active', expected.active, connection.active === true, true, 'credential_connection.active'],
    ['webhook_event_url', 'webhook_event_url', expected.webhook_event_url, connection.webhook_event_url, true, 'credential_connection.webhook'],
    ['webhook_api_version', 'webhook_api_version', expected.webhook_api_version, connection.webhook_api_version, true, 'credential_connection.webhook'],
    ['sip_uri_calling_preference', 'sip_uri_calling_preference', expected.sip_uri_calling_preference, connection.sip_uri_calling_preference, true, 'credential_connection.sip_uri'],
    ['outbound.call_parking_enabled', 'outbound.call_parking_enabled', expected['outbound.call_parking_enabled'], connection.outbound?.call_parking_enabled === true, true, 'credential_connection.parking'],
    ['outbound.outbound_voice_profile_id', 'outbound.outbound_voice_profile_id', expected['outbound.outbound_voice_profile_id'], connection.outbound?.outbound_voice_profile_id || null, true, 'credential_connection.ovp_id'],
    ['anchorsite_override', 'anchorsite_override', expected.anchorsite_override, connection.anchorsite_override || null, false, null],
  ];

  for (const [field, apiField, exp, act, autoFix, autoKey] of scalarFields) {
    pushCheck(checks, {
      layer, field, apiField, apiEndpoint: ep, expected: exp, actual: act,
      pass: exp === act,
      autoFixable: autoFix,
      autoFixKey: autoKey,
    });
  }

  const transport = connection.inbound?.sip_subdomain_receive_settings
    ?? connection.outbound?.outbound_voice_profile_id
    ?? null;
  pushCheck(checks, {
    layer,
    field: 'transport.inbound.sip_subdomain_receive_settings',
    apiField: 'inbound.sip_subdomain_receive_settings',
    apiEndpoint: ep,
    expected: 'reported',
    actual: connection.inbound?.sip_subdomain_receive_settings ?? null,
    pass: true,
    warning: true,
    reason: 'Informational — no strict expected value in VSP architecture',
  });
}

function verifyOutboundVoiceProfile(checks, expected, profile, credentialConnection) {
  const layer = 'outbound_voice_profile';
  const ep = expected.apiEndpoint;

  if (!expected.id) {
    pushCheck(checks, {
      layer, field: 'id', apiEndpoint: ep, expected: 'configured', actual: null, pass: false,
      reason: 'TELNYX_OUTBOUND_VOICE_PROFILE_ID not set',
    });
    return;
  }
  if (!profile) {
    pushCheck(checks, {
      layer, field: 'id', apiField: 'id', apiEndpoint: ep,
      expected: expected.id, actual: null, pass: false,
    });
    return;
  }

  pushCheck(checks, {
    layer, field: 'id', apiField: 'id', apiEndpoint: ep,
    expected: expected.id, actual: profile.id, pass: profile.id === expected.id,
  });

  pushCheck(checks, {
    layer, field: 'enabled', apiField: 'enabled', apiEndpoint: ep,
    expected: expected.enabled, actual: profile.enabled !== false,
    pass: profile.enabled !== false, autoFixable: true, autoFixKey: 'ovp.enabled',
  });

  pushCheck(checks, {
    layer, field: 'connection_id', apiField: 'connection_id', apiEndpoint: ep,
    expected: expected.connection_id, actual: profile.connection_id || null,
    pass: profile.connection_id === expected.connection_id,
    autoFixable: true, autoFixKey: 'v3_app.ovp_link',
  });

  const connCount = profile.connections_count || 0;
  const credOvpId = credentialConnection?.outbound?.outbound_voice_profile_id || null;
  const credLinked = credOvpId === profile.id;
  pushCheck(checks, {
    layer, field: 'connections_count', apiField: 'connections_count', apiEndpoint: ep,
    expected: `>= ${expected.connections_count_min}`,
    actual: connCount,
    pass: connCount >= expected.connections_count_min,
    autoFixable: true, autoFixKey: 'credential_connection.ovp_id',
    reason: connCount < 1 ? 'Credential Connection not attached to OVP.' : null,
  });

  pushCheck(checks, {
    layer, field: 'credential_connection.outbound.outbound_voice_profile_id', apiField: 'outbound.outbound_voice_profile_id',
    apiEndpoint: 'GET /v2/credential_connections/{id}',
    expected: profile.id,
    actual: credOvpId,
    pass: credLinked,
    autoFixable: true, autoFixKey: 'credential_connection.ovp_id',
    reason: !credLinked ? 'Credential Connection not attached to OVP.' : null,
  });

  const destinations = profile.whitelisted_destinations || [];
  pushCheck(checks, {
    layer, field: 'whitelisted_destinations includes US', apiField: 'whitelisted_destinations', apiEndpoint: ep,
    expected: expected.whitelisted_destinations_includes,
    actual: destinations,
    pass: destinations.includes(expected.whitelisted_destinations_includes),
    autoFixable: true, autoFixKey: 'ovp.whitelist_us',
  });

  pushCheck(checks, {
    layer, field: 'traffic_type', apiField: 'traffic_type', apiEndpoint: ep,
    expected: expected.traffic_type, actual: profile.traffic_type || null,
    pass: !expected.traffic_type || profile.traffic_type === expected.traffic_type,
    warning: !profile.traffic_type,
  });

  pushCheck(checks, {
    layer, field: 'concurrent_call_limit', apiField: 'concurrent_call_limit', apiEndpoint: ep,
    expected: 'null or > 0', actual: profile.concurrent_call_limit,
    pass: profile.concurrent_call_limit == null || profile.concurrent_call_limit > 0,
  });

  pushCheck(checks, {
    layer, field: 'daily_spend_limit_enabled', apiField: 'daily_spend_limit_enabled', apiEndpoint: ep,
    expected: 'reported', actual: profile.daily_spend_limit_enabled ?? null,
    pass: true, warning: true,
  });

  pushCheck(checks, {
    layer, field: 'daily_spend_limit', apiField: 'daily_spend_limit', apiEndpoint: ep,
    expected: 'reported', actual: profile.daily_spend_limit ?? null,
    pass: true, warning: true,
  });
}

function verifyCallControlApp(checks, layer, expected, app) {
  const ep = expected.apiEndpoint;

  if (!expected.id) {
    pushCheck(checks, {
      layer, field: 'id', apiEndpoint: ep, expected: 'configured', actual: null, pass: false,
    });
    return;
  }
  if (!app) {
    pushCheck(checks, {
      layer, field: 'id', apiField: 'id', apiEndpoint: ep,
      expected: expected.id, actual: null, pass: false,
    });
    return;
  }

  pushCheck(checks, {
    layer, field: 'id', apiField: 'id', apiEndpoint: ep,
    expected: expected.id, actual: app.id, pass: app.id === expected.id,
  });

  pushCheck(checks, {
    layer, field: 'active', apiField: 'active', apiEndpoint: ep,
    expected: expected.active, actual: app.active === true,
    pass: app.active === true,
    autoFixable: true,
    autoFixKey: layer.includes('v3') ? 'v3_app.active' : 'legacy_app.active',
  });

  pushCheck(checks, {
    layer, field: 'webhook_event_url', apiField: 'webhook_event_url', apiEndpoint: ep,
    expected: expected.webhook_event_url, actual: app.webhook_event_url || null,
    pass: app.webhook_event_url === expected.webhook_event_url,
    autoFixable: true,
    autoFixKey: layer.includes('v3') ? 'v3_app.webhook' : 'legacy_app.webhook',
  });

  pushCheck(checks, {
    layer, field: 'webhook_api_version', apiField: 'webhook_api_version', apiEndpoint: ep,
    expected: expected.webhook_api_version, actual: app.webhook_api_version || null,
    pass: app.webhook_api_version === expected.webhook_api_version,
    autoFixable: false,
  });

  if (expected['outbound.outbound_voice_profile_id'] != null) {
    const act = app.outbound?.outbound_voice_profile_id || null;
    pushCheck(checks, {
      layer, field: 'outbound.outbound_voice_profile_id', apiField: 'outbound.outbound_voice_profile_id', apiEndpoint: ep,
      expected: expected['outbound.outbound_voice_profile_id'], actual: act,
      pass: act === expected['outbound.outbound_voice_profile_id'],
      autoFixable: true, autoFixKey: 'v3_app.ovp_id',
    });
  }

  const inboundLimit = app.inbound?.channel_limit;
  if (expected['inbound.channel_limit_not_zero']) {
    pushCheck(checks, {
      layer, field: 'inbound.channel_limit', apiField: 'inbound.channel_limit', apiEndpoint: ep,
      expected: 'null or > 0', actual: inboundLimit ?? null,
      pass: inboundLimit == null || inboundLimit > 0,
    });
  }

  const outboundLimit = app.outbound?.channel_limit;
  if (expected['outbound.channel_limit_not_zero']) {
    pushCheck(checks, {
      layer, field: 'outbound.channel_limit', apiField: 'outbound.channel_limit', apiEndpoint: ep,
      expected: 'null or > 0', actual: outboundLimit ?? null,
      pass: outboundLimit == null || outboundLimit > 0,
    });
  }
}

function verifyPhoneNumber(checks, number, expected, telnyxRow) {
  const layer = `phone_number:${number}`;
  const ep = expected.apiEndpoint;

  if (!telnyxRow) {
    pushCheck(checks, {
      layer, field: 'telnyx_presence', apiEndpoint: ep,
      expected: 'found', actual: 'NOT_IN_TELNYX', pass: false,
    });
    return;
  }

  pushCheck(checks, {
    layer, field: 'id', apiField: 'id', apiEndpoint: ep,
    expected: 'present', actual: telnyxRow.id, pass: Boolean(telnyxRow.id),
  });

  pushCheck(checks, {
    layer, field: 'status', apiField: 'status', apiEndpoint: ep,
    expected: expected.status, actual: telnyxRow.status || null,
    pass: telnyxRow.status === expected.status,
  });

  pushCheck(checks, {
    layer, field: 'connection_id', apiField: 'connection_id', apiEndpoint: ep,
    expected: expected.connection_id, actual: telnyxRow.connection_id || null,
    pass: telnyxRow.connection_id === expected.connection_id,
    autoFixable: true, autoFixKey: 'phone_number.connection_id',
  });

  pushCheck(checks, {
    layer, field: 'call_control_application (connection_id)', apiField: 'connection_id', apiEndpoint: ep,
    expected: expected.connection_id, actual: telnyxRow.connection_id || null,
    pass: telnyxRow.connection_id === expected.connection_id,
  });

  pushCheck(checks, {
    layer, field: 'tags', apiField: 'tags', apiEndpoint: ep,
    expected: 'reported', actual: telnyxRow.tags ?? [],
    pass: true, warning: true,
  });

  pushCheck(checks, {
    layer, field: 'emergency_address_id', apiField: 'emergency_address_id', apiEndpoint: ep,
    expected: 'reported', actual: telnyxRow.emergency_address_id ?? telnyxRow.emergency_enabled ?? null,
    pass: true, warning: true,
  });
}

function verifySipCredential(checks, ext, expected, registration, telnyxCred) {
  const layer = `sip_credential:ext_${ext.extensionNumber}`;
  const username = ext.telnyxSipUsername;

  pushCheck(checks, {
    layer, field: 'db.user.telnyxSipUsername', apiField: 'User.telnyxSipUsername', apiEndpoint: 'PostgreSQL',
    expected: 'non-empty', actual: username || null,
    pass: Boolean(username),
  });

  pushCheck(checks, {
    layer, field: 'db.user.telnyxSipPassword', apiField: 'User.telnyxSipPassword', apiEndpoint: 'PostgreSQL',
    expected: 'set', actual: ext.telnyxSipPassword ? 'set' : 'missing',
    pass: expected.password_exists ? Boolean(ext.telnyxSipPassword) : true,
  });

  if (username && telnyxCred) {
    pushCheck(checks, {
      layer, field: 'telnyx.credential.sip_username', apiField: 'sip_username', apiEndpoint: 'GET /v2/credentials',
      expected: username, actual: telnyxCred.sip_username || null,
      pass: String(telnyxCred.sip_username).toLowerCase() === String(username).toLowerCase(),
    });

    pushCheck(checks, {
      layer, field: 'telnyx.credential.connection_id', apiField: 'connection_id', apiEndpoint: 'GET /v2/credentials',
      expected: expected.connection_id, actual: telnyxCred.connection_id || null,
      pass: telnyxCred.connection_id === expected.connection_id,
    });
  } else if (username) {
    pushCheck(checks, {
      layer, field: 'telnyx.credential.presence', apiField: 'sip_username', apiEndpoint: 'GET /v2/credentials',
      expected: 'found', actual: 'NOT_IN_TELNYX', pass: false,
    });
  }

  if (username) {
    pushCheck(checks, {
      layer, field: 'telnyx.registration_status', apiField: 'status', apiEndpoint: registration.apiEndpoint,
      expected: expected.registration_status, actual: registration.status,
      pass: registration.status === expected.registration_status,
      reason: registration.error || null,
    });
  }
}

async function collectRuntimeEvidence(ids, sipUsernames) {
  const inboundCdrs = await fetchDetailRecords({
    'filter[record_type]': 'call-control',
    'filter[date_range]': 'last_week',
    'filter[connection_id]': ids.legacyCallControlAppId,
  });

  const sipCdrs = await fetchDetailRecords({
    'filter[record_type]': 'sip-trunking',
    'filter[date_range]': 'last_week',
    'filter[connection_id]': ids.credentialConnectionId,
  });

  const v3Cdrs = await fetchDetailRecords({
    'filter[record_type]': 'call-control',
    'filter[date_range]': 'last_week',
    'filter[connection_id]': ids.v3CallControlAppId,
  });

  const webhookDeliveries = await fetchWebhookDeliveries(10);

  const lastInbound = inboundCdrs[0] || null;
  const lastSip = sipCdrs[0] || null;
  const lastV3 = v3Cdrs[0] || null;
  const lastWebhook = webhookDeliveries[0] || null;

  const registrations = [];
  for (const username of sipUsernames) {
    if (!username) continue;
    const reg = await checkSipRegistration(ids.credentialConnectionId, username);
    registrations.push({ username, status: reg.status, checkedAt: new Date().toISOString(), error: reg.error });
  }

  return {
    apiEndpoint: {
      detailRecords: 'GET /v2/detail_records',
      webhookDeliveries: 'GET /v2/webhook_deliveries',
      registration: 'POST /v2/credential_connections/{id}/actions/check_registration_status',
    },
    inboundCallControlCdrs: {
      count: inboundCdrs.length,
      latest: lastInbound ? {
        started_at: lastInbound.started_at,
        direction: lastInbound.direction,
        cli: lastInbound.cli || lastInbound.caller_number,
        cld: lastInbound.cld || lastInbound.dest_number,
      } : null,
    },
    sipTrunkingCdrs: {
      count: sipCdrs.length,
      latest: lastSip ? {
        started_at: lastSip.started_at,
        direction: lastSip.direction,
        auth_username: lastSip.auth_username,
        dest: lastSip.dest_number || lastSip.cld,
      } : null,
    },
    v3CallControlCdrs: {
      count: v3Cdrs.length,
      latest: lastV3 ? {
        started_at: lastV3.started_at,
        direction: lastV3.direction,
      } : null,
    },
    webhookDeliveries: {
      count: webhookDeliveries.length,
      latest: lastWebhook ? {
        created_at: lastWebhook.created_at,
        event_type: lastWebhook.event_type,
        status: lastWebhook.status,
        url: lastWebhook.url || lastWebhook.webhook_url,
        response_code: lastWebhook.response_code,
      } : null,
    },
    registrations,
    balance: await fetchAccountBalance(),
    zeroTraffic: inboundCdrs.length === 0 && sipCdrs.length === 0 && webhookDeliveries.length === 0,
  };
}

async function verifyTelnyxProductionConfig(prisma, { tenantId = null, extensionNumbers = null } = {}) {
  const checks = /** @type {ConfigCheck[]} */ ([]);
  const platform = prisma ? await loadPlatformSettings(prisma) : null;
  const expectedConfig = buildExpectedConfig(platform);
  expectedConfig.ids.tenantId = tenantId;

  verifyEnvironment(checks, expectedConfig);

  const connId = expectedConfig.ids.credentialConnectionId;
  const connection = connId ? await getCredentialConnection(connId) : null;
  verifyCredentialConnection(checks, expectedConfig.credentialConnection, connection);

  const ovpId = connection?.outbound?.outbound_voice_profile_id || expectedConfig.ids.outboundVoiceProfileId;
  const ovp = await fetchOutboundVoiceProfile(ovpId);
  verifyOutboundVoiceProfile(checks, expectedConfig.outboundVoiceProfile, ovp, connection);

  const legacyApp = expectedConfig.ids.legacyCallControlAppId
    ? await getCallControlApplication(expectedConfig.ids.legacyCallControlAppId)
    : null;
  const v3App = expectedConfig.ids.v3CallControlAppId
    ? await getCallControlApplication(expectedConfig.ids.v3CallControlAppId)
    : null;

  verifyCallControlApp(checks, 'call_control_app_legacy', expectedConfig.legacyCallControlApp, legacyApp);
  verifyCallControlApp(checks, 'call_control_app_v3', expectedConfig.v3CallControlApp, v3App);

  const sipUsernames = [];

  if (prisma && tenantId) {
    const numbers = await prisma.phoneNumber.findMany({
      where: { tenantId, isActive: { not: false } },
      select: { number: true },
      orderBy: { number: 'asc' },
    });
    for (const { number } of numbers) {
      const row = await fetchPhoneNumber(number);
      verifyPhoneNumber(checks, number, expectedConfig.phoneNumber, row);
    }

    const extWhere = { tenantId, status: 'ACTIVE' };
    if (extensionNumbers?.length) {
      extWhere.extensionNumber = { in: extensionNumbers.map(String) };
    }
    const extensions = await prisma.extension.findMany({
      where: extWhere,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            telnyxSipUsername: true,
            telnyxSipPassword: true,
            telnyxCredentialId: true,
          },
        },
      },
      orderBy: { extensionNumber: 'asc' },
    });

    for (const ext of extensions) {
      const username = ext.user?.telnyxSipUsername || null;
      if (username) sipUsernames.push(username);
      const registration = username
        ? await checkSipRegistration(connId, username)
        : { status: null, error: 'no_sip_username_in_db', apiEndpoint: null };
      const telnyxCred = username ? await fetchCredentialsBySipUsername(username) : null;
      verifySipCredential(checks, {
        extensionNumber: ext.extensionNumber,
        userName: ext.user?.name,
        telnyxSipUsername: username,
        telnyxSipPassword: ext.user?.telnyxSipPassword,
      }, expectedConfig.sipCredential, registration, telnyxCred);
    }
  }

  const configChecks = checks.filter((c) => !c.warning);
  const warnings = checks.filter((c) => c.warning);
  const failed = configChecks.filter((c) => !c.pass);
  const passed = configChecks.filter((c) => c.pass);
  const autoFixable = failed.filter((c) => c.autoFixable);
  const manualFix = failed.filter((c) => !c.autoFixable);

  const runtime = await collectRuntimeEvidence(expectedConfig.ids, sipUsernames);

  const allConfigPass = failed.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    tenantId,
    expectedSource: {
      API_PUBLIC_URL: expectedConfig.urls.base,
      ids: expectedConfig.ids,
    },
    summary: {
      totalChecks: checks.length,
      passed: passed.length,
      failed: failed.length,
      warnings: warnings.length,
      autoFixesAvailable: autoFixable.length,
      manualFixesRequired: manualFix.length,
      allConfigPass,
    },
    checks,
    failed,
    warnings,
    runtime,
    missionControl: buildMissionControlSummary(expectedConfig, connection, ovp, legacyApp, v3App),
    telnyxSupportEligible: allConfigPass && runtime.zeroTraffic,
  };
}

function buildMissionControlSummary(expected, connection, ovp, legacyApp, v3App) {
  return {
    credentialConnection: {
      expected: expected.credentialConnection,
      actual: connection ? {
        id: connection.id,
        connection_name: connection.connection_name,
        active: connection.active,
        webhook_event_url: connection.webhook_event_url,
        outbound: connection.outbound,
        sip_uri_calling_preference: connection.sip_uri_calling_preference,
      } : null,
    },
    outboundVoiceProfile: {
      expected: { id: expected.outboundVoiceProfile.id, enabled: true, connection_id: expected.outboundVoiceProfile.connection_id },
      actual: ovp ? {
        id: ovp.id,
        enabled: ovp.enabled,
        connection_id: ovp.connection_id,
        connections_count: ovp.connections_count,
        whitelisted_destinations: ovp.whitelisted_destinations,
      } : null,
    },
    callControlAppLegacy: {
      expected: { id: expected.legacyCallControlApp.id, webhook_event_url: expected.legacyCallControlApp.webhook_event_url },
      actual: legacyApp ? { id: legacyApp.id, webhook_event_url: legacyApp.webhook_event_url, active: legacyApp.active } : null,
    },
    callControlAppV3: {
      expected: { id: expected.v3CallControlApp.id, webhook_event_url: expected.v3CallControlApp.webhook_event_url },
      actual: v3App ? { id: v3App.id, webhook_event_url: v3App.webhook_event_url, active: v3App.active } : null,
    },
  };
}

function formatCheckBlock(c) {
  const lines = [
    c.pass ? 'PASS' : 'FAIL',
    '',
    `${c.layer}.${c.field}`,
    '',
    'Expected:',
    String(c.expected),
    '',
    'Actual:',
    String(c.actual),
  ];
  if (c.apiField) {
    lines.push('', 'API Field:', c.apiField);
  }
  if (c.apiEndpoint) {
    lines.push('', 'API:', c.apiEndpoint);
  }
  if (!c.pass && c.autoFixable) {
    lines.push('', 'Auto Fix:', 'YES');
    if (c.autoFixApi) lines.push('', 'API:', c.autoFixApi);
  } else if (!c.pass) {
    lines.push('', 'Auto Fix:', 'NO');
  }
  if (c.reason) {
    lines.push('', 'Reason:', c.reason);
  }
  return lines.join('\n');
}

function formatVerificationReport(report) {
  const out = [
    '=== Telnyx Production Configuration Verification ===',
    `Generated: ${report.generatedAt}`,
    `Tenant ID: ${report.tenantId || '(none)'}`,
    '',
  ];

  for (const c of report.checks) {
    out.push(formatCheckBlock(c));
    out.push('', '---', '');
  }

  out.push('=== Live Runtime Validation (read-only) ===', '');
  out.push(JSON.stringify(report.runtime, null, 2));
  out.push('');

  out.push('=== Mission Control Equivalence ===', '');
  out.push(JSON.stringify(report.missionControl, null, 2));
  out.push('');

  out.push('=== Summary ===', '');
  out.push(`Total Checks: ${report.summary.totalChecks}`);
  out.push(`Passed: ${report.summary.passed}`);
  out.push(`Failed: ${report.summary.failed}`);
  out.push(`Warnings: ${report.summary.warnings}`);
  out.push(`Auto Fixes Available: ${report.summary.autoFixesAvailable}`);
  out.push(`Manual Fixes Required: ${report.summary.manualFixesRequired}`);
  out.push('');

  if (report.summary.failed > 0) {
    out.push('Configuration mismatch detected.');
  } else {
    out.push('Production configuration exactly matches expected architecture.');
  }

  if (report.telnyxSupportEligible) {
    out.push('');
    out.push('All configuration checks passed AND zero CDRs/webhook deliveries in lookback window.');
    out.push('Telnyx support report eligible — run with --support-report');
  }

  return out.join('\n');
}

function formatTelnyxSupportReport(report) {
  const ids = report.expectedSource.ids;
  const lines = [
    '=== Telnyx Support Report (evidence-based) ===',
    `Generated: ${report.generatedAt}`,
    `Tenant ID: ${report.tenantId}`,
    '',
    '--- Verified configuration (all checks passed) ---',
    JSON.stringify(report.missionControl, null, 2),
    '',
    '--- Connection IDs ---',
    `Credential Connection ID: ${ids.credentialConnectionId}`,
    `Legacy Call Control Application ID: ${ids.legacyCallControlAppId}`,
    `V3 Call Control Application ID: ${ids.v3CallControlAppId}`,
    `Outbound Voice Profile ID: ${ids.outboundVoiceProfileId}`,
    '',
    '--- Phone numbers ---',
  ];

  for (const c of report.checks.filter((x) => x.layer.startsWith('phone_number:'))) {
    if (c.field === 'id') {
      lines.push(`${c.layer.replace('phone_number:', '')} Telnyx ID: ${c.actual}`);
    }
  }

  lines.push(
    '',
    '--- Webhook URLs (expected, verified via API) ---',
    JSON.stringify(report.expectedSource, null, 2),
    '',
    '--- CDR evidence (last_week) ---',
    JSON.stringify({
      inboundCallControl: report.runtime.inboundCallControlCdrs,
      sipTrunking: report.runtime.sipTrunkingCdrs,
      v3CallControl: report.runtime.v3CallControlCdrs,
    }, null, 2),
    '',
    '--- Webhook delivery evidence ---',
    JSON.stringify(report.runtime.webhookDeliveries, null, 2),
    '',
    '--- Registration status ---',
    JSON.stringify(report.runtime.registrations, null, 2),
    '',
    '--- Account balance ---',
    JSON.stringify(report.runtime.balance, null, 2),
    '',
    '--- Request ---',
    'Numbers show status=active and correct connection_id in Telnyx API.',
    'Configuration verification: all expected fields match Telnyx API responses.',
    'Observed: zero inbound call-control CDRs, zero sip-trunking CDRs, zero webhook deliveries in lookback.',
    'PSTN callers receive Trying → Not Found.',
    'Please verify inbound PSTN routing / LRN provisioning for the listed DIDs.',
  );

  return lines.join('\n');
}

async function applyAutoFixes(prisma) {
  return fixTelnyxProduction(prisma, { forceNumberResync: true });
}

module.exports = {
  buildExpectedConfig,
  verifyTelnyxProductionConfig,
  formatVerificationReport,
  formatTelnyxSupportReport,
  formatCheckBlock,
  applyAutoFixes,
};
