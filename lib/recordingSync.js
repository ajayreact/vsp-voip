const axios = require('axios');
const {
  saveCallRecordingFromTelnyxApi,
  pickRecordingUrl,
} = require('./callRecording');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();
const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

function isHttpRecordingUrl(value) {
  const url = String(value || '').trim();
  return url.startsWith('https://') || url.startsWith('http://');
}

function sanitizeStreamErrorMessage(message, fallback) {
  const text = String(message || '').trim();
  if (!text || /request failed with status code/i.test(text)) {
    return fallback;
  }
  return text;
}

function wrapTelnyxAxiosError(error, fallbackMessage) {
  const status = error.response?.status || error.status || 502;
  const telnyxDetail = error.response?.data?.errors?.[0]?.detail;
  const userMessage = sanitizeStreamErrorMessage(
    telnyxDetail || error.userMessage,
    fallbackMessage,
  );
  return Object.assign(new Error(userMessage), {
    status,
    userMessage,
    telnyx: error.response?.data || null,
  });
}

/**
 * Classify why GET /v2/recordings/{id} returned 404 for a stored row.
 * TeXML Record verb IDs are not guaranteed to resolve on the Call Recordings API.
 */
function classifyRecordingNotFound(recordingSid, logContext = {}) {
  const callSid = String(logContext.callSid || '').trim();
  if (callSid.startsWith('v3:')) {
    return 'legacy_texml';
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(recordingSid || ''))) {
    return 'invalid_or_deleted_call_control';
  }
  return 'unknown_recording_id_format';
}

function logRecordingNotFound(recordingSid, logContext = {}) {
  const classification = classifyRecordingNotFound(recordingSid, logContext);
  console.warn('[RECORDING STREAM] Telnyx recording not found via GET /v2/recordings/{recording_id}', {
    recordingSid,
    classification,
    mediaType: logContext.mediaType || null,
    mediaId: logContext.mediaId || null,
    callSid: logContext.callSid || null,
    hasStoredUrl: Boolean(logContext.recordingUrl),
  });
  return classification;
}

async function fetchTelnyxRecordingPage({ pageSize = 50, pageNumber = 1, callSessionId } = {}) {
  if (!TELNYX_API_KEY) {
    throw Object.assign(new Error('TELNYX_API_KEY is not configured'), { status: 500 });
  }

  const params = {
    'page[size]': Math.min(pageSize, 100),
    'page[number]': pageNumber,
  };
  if (callSessionId) {
    params['filter[call_session_id]'] = callSessionId;
  }

  const response = await axios.get(`${TELNYX_API_BASE}/recordings`, {
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      Accept: 'application/json',
    },
    params,
    timeout: 15000,
  });

  return {
    recordings: response.data?.data || [],
    meta: response.data?.meta || {},
  };
}

/**
 * Telnyx Call Recordings API — Retrieve a call recording
 * GET /v2/recordings/{recording_id}
 * @see https://developers.telnyx.com/api-reference/call-recordings/retrieve-a-call-recording
 */
async function fetchTelnyxRecordingById(recordingId) {
  if (!TELNYX_API_KEY) {
    throw Object.assign(new Error('TELNYX_API_KEY is not configured'), { status: 500 });
  }

  try {
    const response = await axios.get(
      `${TELNYX_API_BASE}/recordings/${encodeURIComponent(recordingId)}`,
      {
        headers: {
          Authorization: `Bearer ${TELNYX_API_KEY}`,
          Accept: 'application/json',
        },
        timeout: 15000,
      },
    );

    return response.data?.data || null;
  } catch (error) {
    throw wrapTelnyxAxiosError(error, 'Unable to retrieve recording from Telnyx');
  }
}

/**
 * Extract a fresh signed download URL from a Telnyx recording resource.
 * Uses download_urls (Call Recordings API) per official schema.
 */
function pickTelnyxDownloadUrl(recording) {
  if (!recording) return null;
  const urls = recording.download_urls || {};
  return urls.mp3 || urls.wav || Object.values(urls).find(Boolean) || null;
}

async function refreshStoredRecordingUrl(prisma, record) {
  if (!record.recordingSid) return record;

  try {
    const telnyxRecording = await fetchTelnyxRecordingById(record.recordingSid);
    const freshUrl = pickTelnyxDownloadUrl(telnyxRecording) || pickRecordingUrl(telnyxRecording);
    if (!freshUrl || freshUrl === record.recordingUrl) return record;

    return prisma.callRecording.update({
      where: { id: record.id },
      data: { recordingUrl: String(freshUrl) },
    });
  } catch {
    return record;
  }
}

async function refreshStoredVoicemailUrl(prisma, record) {
  if (!record.recordingSid) return record;

  try {
    const telnyxRecording = await fetchTelnyxRecordingById(record.recordingSid);
    const freshUrl = pickTelnyxDownloadUrl(telnyxRecording) || pickRecordingUrl(telnyxRecording);
    if (!freshUrl || freshUrl === record.recordingUrl) return record;

    return prisma.voicemail.update({
      where: { id: record.id },
      data: { recordingUrl: String(freshUrl) },
    });
  } catch {
    return record;
  }
}

async function streamSignedRecordingUrl(downloadUrl) {
  if (!isHttpRecordingUrl(downloadUrl)) {
    throw Object.assign(new Error('Recording download link is not available'), { status: 404 });
  }

  try {
    const response = await axios.get(downloadUrl, {
      responseType: 'stream',
      maxRedirects: 5,
      timeout: 60000,
    });

    return {
      stream: response.data,
      contentType: response.headers['content-type'] || 'audio/mpeg',
      contentLength: response.headers['content-length'] || null,
      freshRecordingUrl: downloadUrl,
    };
  } catch (error) {
    throw wrapTelnyxAxiosError(error, 'Unable to download recording audio');
  }
}

/**
 * Stream a Call Control recording using the documented Telnyx flow:
 * 1. GET /v2/recordings/{recording_id} (Bearer TELNYX_API_KEY)
 * 2. Read download_urls.mp3|wav (fresh signed URLs)
 * 3. GET the signed URL (no Authorization header)
 */
async function streamTelnyxRecording(recordingSid, options = {}) {
  const { fallbackRecordingUrl, logContext } = options;

  if (!TELNYX_API_KEY) {
    throw Object.assign(new Error('Recording service is not configured'), { status: 500 });
  }
  if (!recordingSid) {
    throw Object.assign(new Error('Recording file id is missing'), { status: 404 });
  }

  let telnyxRecording;
  try {
    telnyxRecording = await fetchTelnyxRecordingById(recordingSid);
  } catch (error) {
    if (error.status === 404) {
      logRecordingNotFound(recordingSid, {
        ...logContext,
        recordingUrl: fallbackRecordingUrl,
      });
      if (isHttpRecordingUrl(fallbackRecordingUrl)) {
        return streamSignedRecordingUrl(fallbackRecordingUrl);
      }
      throw Object.assign(
        new Error('Recording is no longer available from Telnyx'),
        { status: 404, userMessage: 'Recording is no longer available from Telnyx' },
      );
    }
    throw error;
  }

  if (!telnyxRecording) {
    throw Object.assign(new Error('Recording is no longer available from Telnyx'), { status: 404 });
  }

  const downloadUrl = pickTelnyxDownloadUrl(telnyxRecording);
  if (!downloadUrl) {
    throw Object.assign(
      new Error('Recording audio is not ready yet. Please try again shortly.'),
      { status: 404 },
    );
  }

  const streamed = await streamSignedRecordingUrl(downloadUrl);
  return {
    ...streamed,
    freshRecordingUrl: downloadUrl,
  };
}

function pipeRecordingStreamToResponse(res, { stream, contentType, contentLength }) {
  res.setHeader('Content-Type', contentType);
  if (contentLength) {
    res.setHeader('Content-Length', contentLength);
  }
  res.setHeader('Accept-Ranges', 'bytes');
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to stream audio' });
    }
  });
  stream.pipe(res);
}

function toRecordingStreamHttpError(error, mediaLabel = 'recording') {
  const status = error.status || 502;
  const message = sanitizeStreamErrorMessage(
    error.userMessage || error.message,
    `Unable to play ${mediaLabel}. Please try again.`,
  );
  return { status, error: message };
}

async function refreshCallRecordingUrls(prisma, records) {
  const refreshed = await Promise.all(
    records.map((record) => refreshStoredRecordingUrl(prisma, record)),
  );
  return refreshed;
}

async function syncCallRecordingsFromTelnyx(prisma, {
  tenantId,
  callSessionId,
  maxPages = 5,
  pageSize = 50,
} = {}) {
  let imported = 0;
  let refreshed = 0;
  let skipped = 0;
  let total = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const { recordings, meta } = await fetchTelnyxRecordingPage({
      pageSize,
      pageNumber: page,
      callSessionId,
    });

    if (!recordings.length) break;
    total += recordings.length;

    for (const recording of recordings) {
      if (recording.id) {
        const existing = await prisma.callRecording.findUnique({
          where: { recordingSid: recording.id },
        });
        if (existing) {
          const freshUrl = pickTelnyxDownloadUrl(recording) || pickRecordingUrl(recording);
          if (freshUrl && freshUrl !== existing.recordingUrl) {
            await prisma.callRecording.update({
              where: { id: existing.id },
              data: { recordingUrl: String(freshUrl) },
            });
            refreshed += 1;
          } else {
            skipped += 1;
          }
          continue;
        }
      }

      const saved = await saveCallRecordingFromTelnyxApi(prisma, recording, { tenantIdFilter: tenantId });
      if (saved) imported += 1;
      else skipped += 1;
    }

    const totalPages = meta?.total_pages || meta?.totalPages;
    if (totalPages && page >= totalPages) break;
    if (recordings.length < pageSize) break;
  }

  return { imported, refreshed, skipped, total };
}

module.exports = {
  fetchTelnyxRecordingPage,
  fetchTelnyxRecordingById,
  pickTelnyxDownloadUrl,
  refreshCallRecordingUrls,
  refreshStoredVoicemailUrl,
  syncCallRecordingsFromTelnyx,
  streamTelnyxRecording,
  pipeRecordingStreamToResponse,
  toRecordingStreamHttpError,
  classifyRecordingNotFound,
};
