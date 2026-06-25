const axios = require('axios');
const { getApiPublicUrl } = require('./telnyxRecordingSetup');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();

async function telnyxApiRequest(method, path, data) {
  if (!TELNYX_API_KEY) {
    throw Object.assign(new Error('TELNYX_API_KEY is not configured'), { status: 500 });
  }

  try {
    const response = await axios({
      method,
      url: `https://api.telnyx.com/v2${path}`,
      data,
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 20000,
    });

    return response.data?.data ?? response.data ?? null;
  } catch (error) {
    const status = error.response?.status;
    const detail = error.response?.data?.errors?.[0]?.detail
      || error.response?.data?.errors?.[0]?.title
      || error.message;
    const enriched = new Error(detail || error.message);
    enriched.status = status;
    enriched.telnyx = error.response?.data;
    throw enriched;
  }
}

async function callControlAction(callControlId, action, body = {}) {
  if (!callControlId) {
    throw Object.assign(new Error('callControlId is required'), { status: 400 });
  }

  return telnyxApiRequest(
    'post',
    `/calls/${encodeURIComponent(callControlId)}/actions/${action}`,
    body,
  );
}

async function answerCall(callControlId, clientState) {
  const body = clientState ? { client_state: clientState } : {};
  return callControlAction(callControlId, 'answer', body);
}

async function speakCall(callControlId, text, clientState) {
  return callControlAction(callControlId, 'speak', {
    payload: String(text || '').slice(0, 5000),
    voice: 'female',
    language: 'en-US',
    ...(clientState ? { client_state: clientState } : {}),
  });
}

async function gatherUsingSpeak(callControlId, {
  prompt,
  validDigits = '0123456789*#',
  maximumDigits = 1,
  timeoutMillis = 10000,
  clientState,
}) {
  return callControlAction(callControlId, 'gather_using_speak', {
    payload: String(prompt || '').slice(0, 5000),
    voice: 'female',
    language: 'en-US',
    valid_digits: validDigits,
    maximum_digits: maximumDigits,
    timeout_millis: timeoutMillis,
    inter_digit_timeout_millis: 3000,
    ...(clientState ? { client_state: clientState } : {}),
  });
}

async function dialDestination(callControlId, {
  to,
  from,
  fromDisplayName,
  connectionId,
  timeoutSecs = 25,
  clientState,
}) {
  const apiPublic = getApiPublicUrl();
  const webhookUrl = apiPublic ? `${apiPublic}/webhook/call-control` : null;

  // Telnyx POST /calls requires a Call Control Application ID (not the SIP
  // credential connection used to create telephony credentials for WebRTC).
  // from_display_name surfaces the original PSTN ANI on the WebRTC incoming screen.
  return telnyxApiRequest('post', '/calls', {
    to,
    from,
    ...(fromDisplayName ? { from_display_name: String(fromDisplayName).slice(0, 128) } : {}),
    connection_id: connectionId,
    timeout_secs: timeoutSecs,
    link_to: callControlId,
    bridge_on_answer: true,
    ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
    ...(clientState ? { client_state: clientState } : {}),
  });
}

async function hangupCall(callControlId) {
  return callControlAction(callControlId, 'hangup', {});
}

/**
 * Transfer a call leg to a new destination.
 * @see https://developers.telnyx.com/api-reference/call-commands/transfer-call
 * Expected webhooks: call.initiated, call.bridged, call.answered or call.hangup
 */
async function transferCall(callControlId, {
  to,
  from,
  fromDisplayName,
  clientState,
  targetLegClientState,
  commandId,
  timeoutSecs,
  timeLimitSecs,
  audioUrl,
  earlyMedia,
  parkAfterUnbridge,
  sendDigitsOnAnswer,
  customHeaders,
} = {}) {
  if (!to) {
    throw Object.assign(new Error('to is required for transfer'), { status: 400 });
  }

  return callControlAction(callControlId, 'transfer', {
    to: String(to),
    ...(from ? { from: String(from) } : {}),
    ...(fromDisplayName ? { from_display_name: String(fromDisplayName).slice(0, 128) } : {}),
    ...(clientState ? { client_state: clientState } : {}),
    ...(targetLegClientState ? { target_leg_client_state: targetLegClientState } : {}),
    ...(commandId ? { command_id: commandId } : {}),
    ...(timeoutSecs != null ? { timeout_secs: timeoutSecs } : {}),
    ...(timeLimitSecs != null ? { time_limit_secs: timeLimitSecs } : {}),
    ...(audioUrl ? { audio_url: audioUrl } : {}),
    ...(earlyMedia != null ? { early_media: Boolean(earlyMedia) } : {}),
    ...(parkAfterUnbridge ? { park_after_unbridge: parkAfterUnbridge } : {}),
    ...(sendDigitsOnAnswer ? { send_digits_on_answer: sendDigitsOnAnswer } : {}),
    ...(Array.isArray(customHeaders) && customHeaders.length
      ? { custom_headers: customHeaders }
      : {}),
  });
}

/**
 * Bridge two call control legs.
 * @see https://developers.telnyx.com/api-reference/call-commands/bridge-calls
 * Expected webhooks: call.bridged on both legs
 */
async function bridgeCalls(callControlId, {
  otherCallControlId,
  clientState,
  commandId,
  parkAfterUnbridge,
  holdAfterUnbridge,
  preventDoubleBridge,
  playRingtone,
  muteDtmf,
} = {}) {
  if (!otherCallControlId) {
    throw Object.assign(new Error('otherCallControlId is required for bridge'), { status: 400 });
  }

  return callControlAction(callControlId, 'bridge', {
    call_control_id: String(otherCallControlId),
    ...(clientState ? { client_state: clientState } : {}),
    ...(commandId ? { command_id: commandId } : {}),
    ...(parkAfterUnbridge ? { park_after_unbridge: parkAfterUnbridge } : {}),
    ...(holdAfterUnbridge != null ? { hold_after_unbridge: Boolean(holdAfterUnbridge) } : {}),
    ...(preventDoubleBridge != null ? { prevent_double_bridge: Boolean(preventDoubleBridge) } : {}),
    ...(playRingtone != null ? { play_ringtone: Boolean(playRingtone) } : {}),
    ...(muteDtmf ? { mute_dtmf: muteDtmf } : {}),
  });
}

async function startCallRecording(callControlId, clientState) {
  return callControlAction(callControlId, 'record_start', {
    format: 'mp3',
    channels: 'dual',
    ...(clientState ? { client_state: clientState } : {}),
  });
}

async function startVoicemailRecording(callControlId, { maxLength = 120, clientState }) {
  return callControlAction(callControlId, 'record_start', {
    format: 'mp3',
    channels: 'single',
    max_length: Math.min(Math.max(Number(maxLength) || 120, 30), 600),
    play_beep: true,
    ...(clientState ? { client_state: clientState } : {}),
  });
}

function formatWebRtcDialTo(sipUsername) {
  const username = String(sipUsername || '').trim();
  if (!username) return null;
  if (username.startsWith('sip:')) return username;
  return `sip:${username}@sip.telnyx.com`;
}

async function getTelephonyCredential(credentialId) {
  return telnyxApiRequest('get', `/telephony_credentials/${encodeURIComponent(credentialId)}`);
}

async function createTelephonyCredential(connectionId, name, tag = 'vsp-softphone') {
  return telnyxApiRequest('post', '/telephony_credentials', {
    connection_id: connectionId,
    name: String(name || 'vsp-softphone').slice(0, 64),
    tag: String(tag || 'vsp-softphone').slice(0, 64),
  });
}

async function createExtensionTelephonyCredential(connectionId, name) {
  return createTelephonyCredential(connectionId, name, 'vsp-extension-desk');
}

async function deleteTelephonyCredential(credentialId) {
  if (!credentialId) return null;
  return telnyxApiRequest('delete', `/telephony_credentials/${encodeURIComponent(credentialId)}`);
}

async function createTelephonyCredentialToken(credentialId) {
  const response = await axios.post(
    `https://api.telnyx.com/v2/telephony_credentials/${encodeURIComponent(credentialId)}/token`,
    {},
    {
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 20000,
    },
  );

  const loginToken = typeof response.data === 'string'
    ? response.data
    : response.data?.data;
  if (!loginToken || typeof loginToken !== 'string') {
    throw Object.assign(new Error('Telnyx did not return a login token'), { status: 502 });
  }
  return loginToken;
}

module.exports = {
  telnyxApiRequest,
  callControlAction,
  answerCall,
  speakCall,
  gatherUsingSpeak,
  dialDestination,
  hangupCall,
  transferCall,
  bridgeCalls,
  startCallRecording,
  startVoicemailRecording,
  formatWebRtcDialTo,
  getTelephonyCredential,
  createTelephonyCredential,
  createExtensionTelephonyCredential,
  deleteTelephonyCredential,
  createTelephonyCredentialToken,
};
