const axios = require('axios');
const { loadPlatformSettings } = require('./platformSettings');
const { getTelnyxConnectionConfig } = require('./telnyxConfig');
const { getMessagingProfileId } = require('./sms');

async function getTelnyxStatus(prisma) {
  const platform = await loadPlatformSettings(prisma);
  const { connectionId, connectionName } = getTelnyxConnectionConfig(platform);
  const messagingProfileId = getMessagingProfileId(platform);
  const apiKey = process.env.TELNYX_API_KEY?.trim();
  const port = process.env.PORT || 3000;
  const apiPublic = process.env.API_PUBLIC_URL || `http://localhost:${port}`;
  const smsWebhookUrl = `${apiPublic}/webhook/sms`;

  if (!apiKey) {
    return {
      apiKeyConfigured: false,
      connected: false,
      connectionId,
      connectionName,
      messagingProfileId,
      webhookUrl: `${apiPublic}/webhook`,
      statusCallbackUrl: `${apiPublic}/webhook/status`,
      smsWebhookUrl,
      voiceWebhookUrl: `${apiPublic}/webhook/voice`,
      callRecordingWebhookUrl: `${apiPublic}/webhook/call-recording`,
      message: 'TELNYX_API_KEY is not set in server .env',
    };
  }

  let connected = false;
  let message = 'Telnyx API connected';
  try {
    await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      params: { 'page[size]': 1 },
      timeout: 10000,
    });
    connected = true;
  } catch (error) {
    message = error.response?.data?.errors?.[0]?.detail || error.message;
  }

  return {
    apiKeyConfigured: true,
    connected,
    connectionId,
    connectionName,
    messagingProfileId,
    webhookUrl: `${apiPublic}/webhook`,
    statusCallbackUrl: `${apiPublic}/webhook/status`,
    smsWebhookUrl,
    voiceWebhookUrl: `${apiPublic}/webhook/voice`,
    callRecordingWebhookUrl: `${apiPublic}/webhook/call-recording`,
    message,
  };
}

module.exports = { getTelnyxStatus };
