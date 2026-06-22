const axios = require('axios');
const {
  saveCallRecordingFromTelnyxApi,
  pickRecordingUrl,
} = require('./callRecording');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();

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

  const response = await axios.get('https://api.telnyx.com/v2/recordings', {
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

async function fetchTelnyxRecordingById(recordingId) {
  if (!TELNYX_API_KEY) {
    throw Object.assign(new Error('TELNYX_API_KEY is not configured'), { status: 500 });
  }

  const response = await axios.get(
    `https://api.telnyx.com/v2/recordings/${encodeURIComponent(recordingId)}`,
    {
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        Accept: 'application/json',
      },
      timeout: 15000,
    },
  );

  return response.data?.data || null;
}

async function refreshStoredRecordingUrl(prisma, record) {
  if (!record.recordingSid) return record;

  try {
    const telnyxRecording = await fetchTelnyxRecordingById(record.recordingSid);
    const freshUrl = pickRecordingUrl(telnyxRecording);
    if (!freshUrl || freshUrl === record.recordingUrl) return record;

    return prisma.callRecording.update({
      where: { id: record.id },
      data: { recordingUrl: String(freshUrl) },
    });
  } catch {
    return record;
  }
}

async function streamTelnyxRecording(recordingSid) {
  if (!TELNYX_API_KEY) {
    throw Object.assign(new Error('TELNYX_API_KEY is not configured'), { status: 500 });
  }
  if (!recordingSid) {
    throw Object.assign(new Error('Recording file id is missing'), { status: 404 });
  }

  const response = await axios.get(
    `https://api.telnyx.com/v2/recordings/${encodeURIComponent(recordingSid)}/actions/download`,
    {
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        Accept: 'audio/mpeg,audio/*,*/*',
      },
      responseType: 'stream',
      maxRedirects: 5,
      timeout: 60000,
    },
  );

  return {
    stream: response.data,
    contentType: response.headers['content-type'] || 'audio/mpeg',
    contentLength: response.headers['content-length'] || null,
  };
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
          const freshUrl = pickRecordingUrl(recording);
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
  refreshCallRecordingUrls,
  syncCallRecordingsFromTelnyx,
  streamTelnyxRecording,
};
