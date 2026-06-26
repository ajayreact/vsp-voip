const axios = require('axios');
const {
  TELNYX_SEND_MAX_RETRIES,
  TELNYX_SEND_RETRY_MS,
} = require('./constants');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();
const TELNYX_MESSAGES_URL = 'https://api.telnyx.com/v2/messages';

function telnyxHeaders() {
  return {
    Authorization: `Bearer ${TELNYX_API_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function extractTelnyxError(error) {
  return error.response?.data?.errors?.[0]?.detail
    || error.response?.data?.errors?.[0]?.title
    || error.message;
}

function isRetryableTelnyxError(error) {
  const status = error.response?.status;
  if (!status) return true;
  return status === 429 || status >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTelnyxDeliveryStatus(data) {
  if (!data) return null;
  const toStatus = Array.isArray(data.to) ? data.to[0]?.status : data.to?.status;
  return toStatus || data.status || null;
}

function extractTelnyxDeliveryErrors(data) {
  const errors = [
    ...(Array.isArray(data?.errors) ? data.errors : []),
    ...(Array.isArray(data?.to?.[0]?.errors) ? data.to[0].errors : []),
  ];
  return errors
    .map((item) => item?.detail || item?.title || item?.code)
    .filter(Boolean);
}

async function sendTelnyxMessage(payload) {
  if (!TELNYX_API_KEY) {
    throw Object.assign(new Error('TELNYX_API_KEY is not configured'), { status: 500 });
  }

  let lastError;
  for (let attempt = 1; attempt <= TELNYX_SEND_MAX_RETRIES; attempt += 1) {
    try {
      const response = await axios.post(TELNYX_MESSAGES_URL, payload, {
        headers: telnyxHeaders(),
      });
      return response.data?.data;
    } catch (error) {
      lastError = error;
      if (attempt >= TELNYX_SEND_MAX_RETRIES || !isRetryableTelnyxError(error)) {
        break;
      }
      await sleep(TELNYX_SEND_RETRY_MS * attempt);
    }
  }

  const detail = extractTelnyxError(lastError);
  throw Object.assign(new Error(detail || 'Telnyx rejected the message'), {
    status: lastError?.response?.status || 502,
  });
}

async function fetchTelnyxMessage(telnyxMessageId) {
  if (!TELNYX_API_KEY || !telnyxMessageId) return null;

  const response = await axios.get(`${TELNYX_MESSAGES_URL}/${telnyxMessageId}`, {
    headers: telnyxHeaders(),
  });

  const data = response.data?.data;
  return {
    status: extractTelnyxDeliveryStatus(data),
    deliveryError: extractTelnyxDeliveryErrors(data)[0] || null,
    raw: data,
  };
}

module.exports = {
  sendTelnyxMessage,
  fetchTelnyxMessage,
  extractTelnyxDeliveryStatus,
  extractTelnyxDeliveryErrors,
};
