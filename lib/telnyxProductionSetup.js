/**
 * Production Telnyx audit + auto-fix for desk SIP trunk, V3 Call Control, and inbound DIDs.
 * See: https://support.telnyx.com/en/articles/8096455-how-to-configure-a-sip-trunk
 */
const axios = require('axios');
const { loadPlatformSettings } = require('./platformSettings');
const { getCredentialConnectionId } = require('./telnyxConfig');
const { getApiPublicUrl, getCredentialConnection, ensureCredentialConnectionWebhook } = require('./telnyxRecordingSetup');
const {
  getCallControlApplicationId,
  getV3CallControlApplicationId,
  getCallControlApplication,
  ensureCallControlApplicationWebhook,
  syncPhoneNumbersToCallControlApp,
} = require('./telnyxCallControlSetup');
const { telnyxApiRequest } = require('./telnyxCallControl');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();

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

async function getOutboundVoiceProfile(profileId) {
  if (!profileId) return null;
  return telnyxApiRequest('get', `/outbound_voice_profiles/${encodeURIComponent(profileId)}`);
}

async function ensureV3CallControlApplicationWebhook(applicationId, webhookUrl) {
  if (!applicationId || !webhookUrl) {
    return { updated: false, reason: 'missing_app_or_url' };
  }
  const app = await getCallControlApplication(applicationId);
  if (!app) return { updated: false, reason: 'app_not_found' };

  const patch = {};
  if (app.webhook_event_url !== webhookUrl) patch.webhook_event_url = webhookUrl;
  if (app.webhook_api_version !== '2') patch.webhook_api_version = '2';
  if (app.active !== true) patch.active = true;

  if (!Object.keys(patch).length) {
    return { updated: false, reason: 'already_configured', webhookUrl, applicationName: app.application_name };
  }

  await telnyxApiRequest('patch', `/call_control_applications/${encodeURIComponent(applicationId)}`, patch);
  return { updated: true, webhookUrl, applicationName: app.application_name, patch };
}

async function ensureOutboundVoiceProfileDeskReady(profileId, { fix = false } = {}) {
  if (!profileId) {
    return { ok: false, reason: 'missing_profile_id' };
  }

  const profile = await getOutboundVoiceProfile(profileId);
  if (!profile) return { ok: false, reason: 'profile_not_found' };

  const issues = [];
  if (profile.enabled === false) issues.push('ovp_disabled');
  const destinations = profile.whitelisted_destinations || [];
  if (!destinations.length || !destinations.includes('US')) {
    issues.push('ovp_missing_us_destination');
  }
  if ((profile.connections_count || 0) < 1) {
    issues.push('ovp_no_connections');
  }

  let fixed = false;
  if (fix && issues.length) {
    const patch = {};
    if (profile.enabled === false) patch.enabled = true;
    if (!destinations.includes('US')) {
      patch.whitelisted_destinations = [...new Set([...destinations, 'US', 'CA'])];
    }
    if (Object.keys(patch).length) {
      await telnyxApiRequest('patch', `/outbound_voice_profiles/${encodeURIComponent(profileId)}`, patch);
      fixed = true;
    }
  }

  return {
    ok: issues.length === 0,
    profileId,
    name: profile.name,
    enabled: profile.enabled !== false,
    connections_count: profile.connections_count || 0,
    whitelisted_destinations: destinations,
    issues,
    fixed,
  };
}

async function ensureCredentialConnectionDeskReady(connectionId, profileId, voiceWebhookUrl, { fix = false } = {}) {
  if (!connectionId) return { ok: false, reason: 'missing_connection_id' };

  const connection = await getCredentialConnection(connectionId);
  if (!connection) return { ok: false, reason: 'connection_not_found' };

  const issues = [];
  if (connection.active === false) issues.push('connection_inactive');
  if (connection.outbound?.call_parking_enabled !== true) issues.push('call_parking_disabled');
  if (connection.sip_uri_calling_preference !== 'internal') issues.push('sip_uri_not_internal');
  if (!connection.outbound?.outbound_voice_profile_id) issues.push('missing_ovp_on_connection');
  else if (profileId && connection.outbound.outbound_voice_profile_id !== profileId) {
    issues.push('ovp_mismatch');
  }
  if (voiceWebhookUrl && connection.webhook_event_url !== voiceWebhookUrl) {
    issues.push('voice_webhook_mismatch');
  }

  let fixed = false;
  if (fix) {
    if (voiceWebhookUrl) {
      const webhookResult = await ensureCredentialConnectionWebhook(connectionId, voiceWebhookUrl);
      if (webhookResult.updated) fixed = true;
    }
    const needsPatch = connection.active === false
      || connection.outbound?.call_parking_enabled !== true
      || connection.sip_uri_calling_preference !== 'internal'
      || (profileId && connection.outbound?.outbound_voice_profile_id !== profileId);

    if (needsPatch) {
      await telnyxApiRequest('patch', `/credential_connections/${encodeURIComponent(connectionId)}`, {
        active: true,
        sip_uri_calling_preference: 'internal',
        outbound: {
          call_parking_enabled: true,
          outbound_voice_profile_id: profileId || connection.outbound?.outbound_voice_profile_id,
        },
      });
      fixed = true;
    }
  }

  return {
    ok: issues.length === 0,
    connectionId,
    name: connection.connection_name,
    active: connection.active !== false,
    parking: connection.outbound?.call_parking_enabled === true,
    sip_uri: connection.sip_uri_calling_preference,
    ovp_id: connection.outbound?.outbound_voice_profile_id || null,
    webhook: connection.webhook_event_url || null,
    issues,
    fixed,
  };
}

async function ensureV3AppOutboundProfile(v3AppId, profileId, { fix = false } = {}) {
  if (!v3AppId || !profileId) return { ok: false, reason: 'missing_ids' };

  const app = await getCallControlApplication(v3AppId);
  if (!app) return { ok: false, reason: 'v3_app_not_found' };

  const current = app.outbound?.outbound_voice_profile_id || null;
  const issues = current !== profileId ? ['v3_app_ovp_mismatch'] : [];

  if (fix && issues.length) {
    await telnyxApiRequest('patch', `/call_control_applications/${encodeURIComponent(v3AppId)}`, {
      outbound: { outbound_voice_profile_id: profileId },
      active: true,
    });
    return { ok: true, fixed: true, profileId };
  }

  return { ok: issues.length === 0, current, expected: profileId, issues, fixed: false };
}

async function auditPhoneNumber(e164, expectedCallControlId) {
  if (!TELNYX_API_KEY) return { number: e164, error: 'no_api_key' };
  try {
    const res = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      headers: telnyxHeaders(),
      params: { 'filter[phone_number]': e164 },
      timeout: 15000,
    });
    const row = res.data?.data?.[0];
    if (!row) return { number: e164, error: 'NOT_IN_TELNYX' };
    return {
      number: e164,
      telnyxId: row.id,
      status: row.status,
      connection_id: row.connection_id,
      onCallControl: row.connection_id === expectedCallControlId,
      phone_number_type: row.phone_number_type,
      purchased_at: row.purchased_at,
    };
  } catch (error) {
    return { number: e164, error: error.message };
  }
}

async function fetchDetailRecords(params) {
  if (!TELNYX_API_KEY) return [];
  try {
    const res = await axios.get('https://api.telnyx.com/v2/detail_records', {
      headers: telnyxHeaders(),
      params,
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

/**
 * Full production audit. Returns structured evidence for support tickets.
 */
async function auditTelnyxProduction(prisma, { tenantId = null, numbers = [] } = {}) {
  const platform = prisma ? await loadPlatformSettings(prisma) : null;
  const urls = expectedUrls();
  const credentialConnectionId = getCredentialConnectionId(platform);
  const callControlAppId = getCallControlApplicationId(platform);
  const v3AppId = getV3CallControlApplicationId();
  const envOvpId = process.env.TELNYX_OUTBOUND_VOICE_PROFILE_ID?.trim() || null;

  let connection = null;
  if (credentialConnectionId) {
    connection = await getCredentialConnection(credentialConnectionId);
  }
  const ovpId = connection?.outbound?.outbound_voice_profile_id || envOvpId;

  const legacyApp = callControlAppId ? await getCallControlApplication(callControlAppId) : null;
  const v3App = v3AppId ? await getCallControlApplication(v3AppId) : null;
  const ovp = ovpId ? await getOutboundVoiceProfile(ovpId) : null;

  let tenantNumbers = numbers;
  if (!tenantNumbers.length && tenantId && prisma) {
    const rows = await prisma.phoneNumber.findMany({
      where: { tenantId, isActive: { not: false } },
      select: { number: true },
    });
    tenantNumbers = rows.map((r) => r.number);
  }

  const numberAudits = [];
  for (const n of tenantNumbers) {
    numberAudits.push(await auditPhoneNumber(n, callControlAppId));
  }

  const sipCdrs = await fetchDetailRecords({
    'filter[record_type]': 'sip-trunking',
    'filter[date_range]': 'today',
    'filter[connection_id]': credentialConnectionId,
    'page[size]': 5,
  });

  const inboundCdrs = await fetchDetailRecords({
    'filter[record_type]': 'call-control',
    'filter[date_range]': 'today',
    'filter[connection_id]': callControlAppId,
    'page[size]': 5,
  });

  const issues = [];

  if (!urls.base) issues.push('API_PUBLIC_URL not set');
  if (!process.env.TELEPHONY_V3_INGRESS_ENABLED || process.env.TELEPHONY_V3_INGRESS_ENABLED !== 'true') {
    issues.push('TELEPHONY_V3_INGRESS_ENABLED not true');
  }
  if (!v3AppId) issues.push('TELNYX_V3_CALL_CONTROL_APP_ID not set');
  if (!credentialConnectionId) issues.push('TELNYX_CREDENTIAL_CONNECTION_ID not set');
  if (!ovpId) issues.push('credential connection missing outbound_voice_profile_id');
  if (ovp && ovp.enabled === false) issues.push('outbound voice profile disabled');
  if (ovp && (ovp.connections_count || 0) < 1) issues.push('OVP has zero connections — assign credential SIP trunk in Mission Control');
  if (legacyApp && urls.callControl && legacyApp.webhook_event_url !== urls.callControl) {
    issues.push('legacy call control webhook mismatch');
  }
  if (v3App && urls.v3CallControl && v3App.webhook_event_url !== urls.v3CallControl) {
    issues.push('V3 call control webhook mismatch');
  }
  if (connection && connection.outbound?.call_parking_enabled !== true) {
    issues.push('call_parking_disabled on credential connection');
  }
  for (const na of numberAudits) {
    if (na.error) issues.push(`number ${na.number}: ${na.error}`);
    else if (!na.onCallControl) issues.push(`number ${na.number} not on Call Control app`);
    else if (na.status !== 'active') issues.push(`number ${na.number} status=${na.status}`);
  }
  if (sipCdrs.length === 0 && inboundCdrs.length === 0) {
    issues.push('zero CDRs today on credential + call control — calls not reaching Telnyx');
  }

  return {
    timestamp: new Date().toISOString(),
    urls,
    env: {
      TELEPHONY_V3_INGRESS_ENABLED: process.env.TELEPHONY_V3_INGRESS_ENABLED || null,
      credentialConnectionId,
      callControlAppId,
      v3AppId,
      ovpId,
    },
    balance: await fetchAccountBalance(),
    legacyApp: legacyApp ? {
      id: callControlAppId,
      name: legacyApp.application_name,
      active: legacyApp.active,
      webhook: legacyApp.webhook_event_url,
      inbound_channel_limit: legacyApp.inbound?.channel_limit,
    } : null,
    v3App: v3App ? {
      id: v3AppId,
      name: v3App.application_name,
      active: v3App.active,
      webhook: v3App.webhook_event_url,
      outbound_profile: v3App.outbound?.outbound_voice_profile_id,
    } : null,
    credentialConnection: connection ? {
      id: credentialConnectionId,
      name: connection.connection_name,
      active: connection.active,
      parking: connection.outbound?.call_parking_enabled,
      sip_uri: connection.sip_uri_calling_preference,
      ovp_id: connection.outbound?.outbound_voice_profile_id,
      webhook: connection.webhook_event_url,
    } : null,
    outboundVoiceProfile: ovp ? {
      id: ovpId,
      name: ovp.name,
      enabled: ovp.enabled,
      connections_count: ovp.connections_count,
      whitelisted_destinations: ovp.whitelisted_destinations,
    } : null,
    numbers: numberAudits,
    cdrs: { sip_trunking_today: sipCdrs.length, call_control_today: inboundCdrs.length },
    recentWebhookDeliveries: await fetchWebhookDeliveries(5),
    issues,
    pstnNotFoundLikelyCarrier: numberAudits.every((n) => n.onCallControl && n.status === 'active')
      && inboundCdrs.length === 0,
  };
}

/**
 * Apply safe Telnyx API fixes (webhooks, parking, OVP, number assignment).
 */
async function fixTelnyxProduction(prisma, { forceNumberResync = false } = {}) {
  const platform = prisma ? await loadPlatformSettings(prisma) : null;
  const urls = expectedUrls();
  const credentialConnectionId = getCredentialConnectionId(platform);
  const callControlAppId = getCallControlApplicationId(platform);
  const v3AppId = getV3CallControlApplicationId();
  const envOvpId = process.env.TELNYX_OUTBOUND_VOICE_PROFILE_ID?.trim() || null;

  const connection = credentialConnectionId
    ? await getCredentialConnection(credentialConnectionId)
    : null;
  const ovpId = connection?.outbound?.outbound_voice_profile_id || envOvpId;

  const results = {
    legacyWebhook: null,
    v3Webhook: null,
    credential: null,
    ovp: null,
    v3AppOvp: null,
    numbers: null,
  };

  if (callControlAppId && urls.callControl) {
    results.legacyWebhook = await ensureCallControlApplicationWebhook(callControlAppId, urls.callControl);
  }
  if (v3AppId && urls.v3CallControl) {
    results.v3Webhook = await ensureV3CallControlApplicationWebhook(v3AppId, urls.v3CallControl);
  }
  if (credentialConnectionId) {
    results.credential = await ensureCredentialConnectionDeskReady(
      credentialConnectionId,
      ovpId,
      urls.voice,
      { fix: true },
    );
  }
  if (ovpId) {
    results.ovp = await ensureOutboundVoiceProfileDeskReady(ovpId, { fix: true });
  }
  if (v3AppId && ovpId) {
    results.v3AppOvp = await ensureV3AppOutboundProfile(v3AppId, ovpId, { fix: true });
  }
  if (prisma && callControlAppId) {
    results.numbers = await syncPhoneNumbersToCallControlApp(prisma, callControlAppId);
    if (forceNumberResync && results.numbers.updated === 0) {
      // Force re-patch active numbers even when already assigned (can refresh carrier routing).
      const rows = await prisma.phoneNumber.findMany({
        where: { isActive: { not: false } },
        select: { number: true },
      });
      let forced = 0;
      for (const row of rows) {
        try {
          const res = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
            headers: telnyxHeaders(),
            params: { 'filter[phone_number]': row.number },
          });
          const phone = res.data?.data?.[0];
          if (phone?.id) {
            await telnyxApiRequest('patch', `/phone_numbers/${encodeURIComponent(phone.id)}`, {
              connection_id: callControlAppId,
            });
            forced += 1;
          }
        } catch {
          // skip
        }
      }
      results.numbers.forcedResync = forced;
    }
  }

  return results;
}

async function ensureTelnyxProductionSetup(prisma) {
  if (!TELNYX_API_KEY) {
    return { skipped: true, reason: 'no_api_key' };
  }
  return fixTelnyxProduction(prisma, { forceNumberResync: false });
}

function formatSupportReport(audit) {
  const lines = [
    '=== VSP Phone — Telnyx Support Report ===',
    `Generated: ${audit.timestamp}`,
    '',
    'SYMPTOM',
    '- US PSTN inbound: Trying → Not Found (call never reaches application)',
    '- Desk outbound: zero sip-trunking CDRs (INVITE never reaches Telnyx)',
    '- SIP REGISTER succeeds for desk phones (gencred usernames)',
    '',
    'ACCOUNT',
    `Balance: ${JSON.stringify(audit.balance)}`,
    '',
    'CONNECTION IDS',
    `Credential SIP Trunk: ${audit.env.credentialConnectionId}`,
    `Legacy Call Control (inbound DIDs): ${audit.env.callControlAppId}`,
    `V3 Call Control (desk parked outbound): ${audit.env.v3AppId}`,
    `Outbound Voice Profile: ${audit.env.ovpId}`,
    '',
    'WEBHOOK URLS (expected)',
    JSON.stringify(audit.urls, null, 2),
    '',
    'LEGACY CALL CONTROL APP',
    JSON.stringify(audit.legacyApp, null, 2),
    '',
    'V3 CALL CONTROL APP',
    JSON.stringify(audit.v3App, null, 2),
    '',
    'CREDENTIAL CONNECTION',
    JSON.stringify(audit.credentialConnection, null, 2),
    '',
    'OUTBOUND VOICE PROFILE',
    JSON.stringify(audit.outboundVoiceProfile, null, 2),
    '',
    'PHONE NUMBERS',
    ...audit.numbers.map((n) => JSON.stringify(n)),
    '',
    'CDRs TODAY',
    JSON.stringify(audit.cdrs),
    '',
    'RECENT WEBHOOK DELIVERIES',
    ...audit.recentWebhookDeliveries.map((d) => JSON.stringify({
      status: d.status,
      event_type: d.event_type,
      url: d.url || d.webhook_url,
      response_code: d.response_code,
      created_at: d.created_at,
    })),
    '',
    'CONFIG ISSUES DETECTED',
    ...audit.issues.map((i) => `- ${i}`),
    '',
  ];

  if (audit.pstnNotFoundLikelyCarrier) {
    lines.push(
      'REQUEST TO TELNYX',
      'Numbers show status=active and connection_id=VSP-Voice-App in API,',
      'but PSTN callers receive Not Found and zero call-control CDRs/webhooks.',
      'Please verify inbound PSTN routing / LRN provisioning for:',
      ...audit.numbers.map((n) => `- ${n.number} (id ${n.telnyxId})`),
      '',
    );
  }

  return lines.join('\n');
}

module.exports = {
  expectedUrls,
  ensureV3CallControlApplicationWebhook,
  ensureOutboundVoiceProfileDeskReady,
  ensureCredentialConnectionDeskReady,
  ensureV3AppOutboundProfile,
  auditTelnyxProduction,
  fixTelnyxProduction,
  ensureTelnyxProductionSetup,
  formatSupportReport,
};
