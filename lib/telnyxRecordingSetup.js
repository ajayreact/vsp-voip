const axios = require('axios');
const { getCredentialConnectionId } = require('./telnyxConfig');
const { loadPlatformSettings } = require('./platformSettings');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();

function getApiPublicUrl() {
  return process.env.API_PUBLIC_URL?.trim()?.replace(/\/$/, '') || null;
}

async function telnyxRequest(method, path, data) {
  if (!TELNYX_API_KEY) {
    throw Object.assign(new Error('TELNYX_API_KEY is not configured'), { status: 500 });
  }

  const response = await axios({
    method,
    url: `https://api.telnyx.com/v2${path}`,
    data,
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 15000,
  });

  return response.data?.data ?? null;
}

async function getCredentialConnection(connectionId) {
  if (!connectionId) return null;
  return telnyxRequest('get', `/credential_connections/${encodeURIComponent(connectionId)}`);
}

async function getOutboundVoiceProfileId(connectionId) {
  const connection = await getCredentialConnection(connectionId);
  return connection?.outbound?.outbound_voice_profile_id || null;
}

async function ensureCredentialConnectionWebhook(connectionId, voiceWebhookUrl) {
  if (!connectionId || !voiceWebhookUrl) {
    return { updated: false, reason: 'missing_connection_or_url' };
  }

  const connection = await getCredentialConnection(connectionId);
  if (!connection) {
    return { updated: false, reason: 'connection_not_found' };
  }

  if (connection.webhook_event_url === voiceWebhookUrl
    && connection.sip_uri_calling_preference === 'internal') {
    return { updated: false, reason: 'already_configured', webhookUrl: voiceWebhookUrl };
  }

  await telnyxRequest('patch', `/credential_connections/${encodeURIComponent(connectionId)}`, {
    webhook_event_url: voiceWebhookUrl,
    webhook_api_version: '2',
    sip_uri_calling_preference: 'internal',
  });

  return { updated: true, webhookUrl: voiceWebhookUrl };
}

async function ensureOutboundVoiceProfileRecording(profileId) {
  if (!profileId) {
    return { updated: false, reason: 'missing_profile' };
  }

  const profile = await telnyxRequest('get', `/outbound_voice_profiles/${encodeURIComponent(profileId)}`);
  if (!profile) {
    return { updated: false, reason: 'profile_not_found' };
  }

  const currentType = profile.call_recording?.call_recording_type || 'none';
  if (currentType === 'all') {
    return {
      updated: false,
      reason: 'already_enabled',
      profileId,
      callRecording: profile.call_recording,
    };
  }

  const callRecording = await telnyxRequest(
    'patch',
    `/outbound_voice_profiles/${encodeURIComponent(profileId)}`,
    {
      call_recording: {
        call_recording_type: 'all',
        call_recording_channels: 'dual',
        call_recording_format: 'mp3',
      },
    },
  );

  return {
    updated: true,
    profileId,
    callRecording: callRecording?.call_recording || null,
  };
}

async function getRecordingSetupStatus(prisma) {
  const apiPublicUrl = getApiPublicUrl();
  const port = process.env.PORT || 3000;
  const localBase = `http://localhost:${port}`;
  const webhookBase = apiPublicUrl || localBase;
  const voiceWebhookUrl = `${webhookBase}/webhook/voice`;
  const callRecordingWebhookUrl = `${webhookBase}/webhook/call-recording`;

  const platform = prisma ? await loadPlatformSettings(prisma) : null;
  const connectionId = getCredentialConnectionId(platform);
  let credentialWebhookUrl = null;
  let outboundRecordingEnabled = false;
  let outboundVoiceProfileId = null;

  if (connectionId && TELNYX_API_KEY) {
    try {
      const connection = await getCredentialConnection(connectionId);
      credentialWebhookUrl = connection?.webhook_event_url || null;
      outboundVoiceProfileId = connection?.outbound?.outbound_voice_profile_id || null;
      if (outboundVoiceProfileId) {
        const profile = await telnyxRequest(
          'get',
          `/outbound_voice_profiles/${encodeURIComponent(outboundVoiceProfileId)}`,
        );
        outboundRecordingEnabled = profile?.call_recording?.call_recording_type === 'all';
      }
    } catch (error) {
      return {
        apiPublicUrlConfigured: Boolean(apiPublicUrl),
        apiPublicUrl: apiPublicUrl || null,
        voiceWebhookUrl,
        callRecordingWebhookUrl,
        credentialConnectionId: connectionId,
        credentialWebhookConfigured: false,
        credentialWebhookUrl,
        outboundVoiceProfileId,
        outboundRecordingEnabled: false,
        webhooksReachable: Boolean(apiPublicUrl),
        message: error.message,
      };
    }
  }

  return {
    apiPublicUrlConfigured: Boolean(apiPublicUrl),
    apiPublicUrl: apiPublicUrl || null,
    voiceWebhookUrl,
    callRecordingWebhookUrl,
    credentialConnectionId: connectionId,
    credentialWebhookConfigured: Boolean(credentialWebhookUrl),
    credentialWebhookUrl,
    outboundVoiceProfileId,
    outboundRecordingEnabled,
    webhooksReachable: Boolean(apiPublicUrl),
    message: apiPublicUrl
      ? 'Telnyx can reach your webhooks for instant recording delivery.'
      : 'Set API_PUBLIC_URL (e.g. ngrok) so Telnyx can POST recording webhooks. Recordings can still be synced from Telnyx on this page.',
  };
}

async function ensureCredentialConnectionOutbound(connectionId, profileId) {
  if (!connectionId || !profileId) {
    return { updated: false, reason: 'missing_connection_or_profile' };
  }

  const connection = await getCredentialConnection(connectionId);
  if (!connection) {
    return { updated: false, reason: 'connection_not_found' };
  }

  const currentProfileId = connection?.outbound?.outbound_voice_profile_id || null;
  if (currentProfileId === profileId) {
    return { updated: false, reason: 'already_configured', profileId };
  }

  await telnyxRequest('patch', `/credential_connections/${encodeURIComponent(connectionId)}`, {
    outbound: {
      outbound_voice_profile_id: profileId,
    },
  });

  console.log(`   ↳ Assigned Outbound Voice Profile ${profileId} to credential connection ${connectionId}`);
  return { updated: true, profileId, previousProfileId: currentProfileId };
}

async function ensureTelnyxRecordingSetup(prisma) {
  const apiPublicUrl = getApiPublicUrl();
  const port = process.env.PORT || 3000;
  const webhookBase = apiPublicUrl || `http://localhost:${port}`;
  const voiceWebhookUrl = `${webhookBase}/webhook/voice`;

  const platform = prisma ? await loadPlatformSettings(prisma) : null;
  const connectionId = getCredentialConnectionId(platform);
  const results = {
    webhook: null,
    outboundProfile: null,
    outboundRecording: null,
  };

  if (connectionId) {
    if (apiPublicUrl) {
      results.webhook = await ensureCredentialConnectionWebhook(connectionId, voiceWebhookUrl);
    }

    const envProfileId = process.env.TELNYX_OUTBOUND_VOICE_PROFILE_ID?.trim() || null;
    let profileId = await getOutboundVoiceProfileId(connectionId);

    if (!profileId && envProfileId) {
      results.outboundProfile = await ensureCredentialConnectionOutbound(connectionId, envProfileId);
      profileId = envProfileId;
    }

    if (profileId) {
      results.outboundRecording = await ensureOutboundVoiceProfileRecording(profileId);
    } else if (!profileId) {
      console.warn(
        '⚠️ Credential connection has no Outbound Voice Profile — WebRTC outbound calls will not connect.',
        'Set TELNYX_OUTBOUND_VOICE_PROFILE_ID in .env or assign VSP-Outbound on VSP-SIP-Trunk in Telnyx Portal.',
      );
    }
  }

  return results;
}

module.exports = {
  getApiPublicUrl,
  getRecordingSetupStatus,
  ensureTelnyxRecordingSetup,
  ensureCredentialConnectionWebhook,
  ensureCredentialConnectionOutbound,
  ensureOutboundVoiceProfileRecording,
  getCredentialConnection,
  getOutboundVoiceProfileId,
};
