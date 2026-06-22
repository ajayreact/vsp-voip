const axios = require('axios');
const { loadPlatformSettings } = require('./platformSettings');
const { getMessagingProfileId } = require('./sms');
const { getApiPublicUrl } = require('./telnyxRecordingSetup');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();

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

async function getMessagingProfile(messagingProfileId) {
  if (!messagingProfileId) return null;
  return telnyxRequest('get', `/messaging_profiles/${encodeURIComponent(messagingProfileId)}`);
}

async function ensureMessagingProfileWebhook(messagingProfileId, smsWebhookUrl) {
  if (!messagingProfileId || !smsWebhookUrl) {
    return { updated: false, reason: 'missing_profile_or_url' };
  }

  const profile = await getMessagingProfile(messagingProfileId);
  if (!profile) {
    return { updated: false, reason: 'profile_not_found' };
  }

  if (profile.webhook_url === smsWebhookUrl) {
    return {
      updated: false,
      reason: 'already_configured',
      webhookUrl: smsWebhookUrl,
      profileName: profile.name,
    };
  }

  await telnyxRequest('patch', `/messaging_profiles/${encodeURIComponent(messagingProfileId)}`, {
    webhook_url: smsWebhookUrl,
    webhook_api_version: '2',
  });

  return {
    updated: true,
    webhookUrl: smsWebhookUrl,
    profileName: profile.name,
  };
}

async function getMessagingPhoneNumber(normalizedNumber) {
  if (!normalizedNumber) return null;
  try {
    return await telnyxRequest(
      'get',
      `/messaging_phone_numbers/${encodeURIComponent(normalizedNumber)}`,
    );
  } catch {
    return null;
  }
}

async function getMessagingSetupStatus(prisma, tenantNumbers = []) {
  const apiPublicUrl = getApiPublicUrl();
  const port = process.env.PORT || 3000;
  const localBase = `http://localhost:${port}`;
  const webhookBase = apiPublicUrl || localBase;
  const smsWebhookUrl = `${webhookBase}/webhook/sms`;

  const platform = prisma ? await loadPlatformSettings(prisma) : null;
  const messagingProfileId = getMessagingProfileId(platform);

  if (!messagingProfileId) {
    return {
      messagingProfileId: null,
      smsWebhookUrl,
      webhooksReachable: Boolean(apiPublicUrl),
      profileWebhookConfigured: false,
      profileWebhookUrl: null,
      numbersOnProfile: [],
      message: 'Messaging profile ID is not configured.',
    };
  }

  let profileWebhookUrl = null;
  let profileName = null;
  try {
    const profile = await getMessagingProfile(messagingProfileId);
    profileWebhookUrl = profile?.webhook_url || null;
    profileName = profile?.name || null;
  } catch (error) {
    return {
      messagingProfileId,
      profileName: null,
      smsWebhookUrl,
      webhooksReachable: Boolean(apiPublicUrl),
      profileWebhookConfigured: false,
      profileWebhookUrl: null,
      numbersOnProfile: [],
      message: error.response?.data?.errors?.[0]?.detail || error.message,
    };
  }

  const numbersOnProfile = [];
  for (const number of tenantNumbers) {
    const normalized = String(number || '').trim();
    if (!normalized) continue;
    const messagingNumber = await getMessagingPhoneNumber(normalized);
    numbersOnProfile.push({
      number: normalized,
      onProfile: messagingNumber?.messaging_profile_id === messagingProfileId,
      messagingProfileId: messagingNumber?.messaging_profile_id || null,
    });
  }

  const allNumbersOnProfile = numbersOnProfile.length
    ? numbersOnProfile.every((item) => item.onProfile)
    : true;

  let message = 'SMS webhooks are configured.';
  if (!apiPublicUrl) {
    message = 'Set API_PUBLIC_URL (ngrok URL) so Telnyx can POST SMS delivery updates.';
  } else if (profileWebhookUrl !== smsWebhookUrl) {
    message = 'Restart the API after setting API_PUBLIC_URL to auto-update the Telnyx messaging profile webhook.';
  } else if (!allNumbersOnProfile) {
    message = 'One or more sender numbers are not assigned to your messaging profile in Telnyx.';
  }

  return {
    messagingProfileId,
    profileName,
    smsWebhookUrl,
    webhooksReachable: Boolean(apiPublicUrl),
    profileWebhookConfigured: profileWebhookUrl === smsWebhookUrl,
    profileWebhookUrl,
    numbersOnProfile,
    message,
  };
}

async function ensureTelnyxMessagingSetup(prisma) {
  const apiPublicUrl = getApiPublicUrl();
  if (!apiPublicUrl) {
    return { webhook: null };
  }

  const platform = prisma ? await loadPlatformSettings(prisma) : null;
  const messagingProfileId = getMessagingProfileId(platform);
  if (!messagingProfileId) {
    return { webhook: null };
  }

  const smsWebhookUrl = `${apiPublicUrl}/webhook/sms`;
  const webhook = await ensureMessagingProfileWebhook(messagingProfileId, smsWebhookUrl);
  return { webhook };
}

module.exports = {
  ensureMessagingProfileWebhook,
  getMessagingSetupStatus,
  ensureTelnyxMessagingSetup,
  getMessagingPhoneNumber,
};
