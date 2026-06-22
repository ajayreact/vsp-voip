const { normalizePhoneNumber } = require('./phone');

function mapCallRecording(record) {
  return {
    id: record.id,
    tenantId: record.tenantId,
    callSid: record.callSid,
    recordingSid: record.recordingSid,
    from: record.from,
    to: record.to,
    direction: record.direction || 'inbound',
    recordingUrl: record.recordingUrl,
    durationSeconds: record.durationSeconds,
    createdAt: record.createdAt,
  };
}

async function resolveTenantIdForRecording(prisma, dialedNumber) {
  const normalized = normalizePhoneNumber(dialedNumber);
  if (!normalized) return null;

  const phone = await prisma.phoneNumber.findUnique({
    where: { number: normalized },
    select: { tenantId: true },
  });
  return phone?.tenantId ?? null;
}

function isCompletedCallRecording(payload) {
  const status = String(
    payload.RecordingStatus || payload.recording_status || 'completed',
  ).toLowerCase();
  return status === 'completed';
}

function inferRecordingDirection(tenantIdFromTo, tenantIdFromFrom) {
  if (tenantIdFromFrom && !tenantIdFromTo) return 'outbound';
  return 'inbound';
}

function buildRecordingClientState({ tenantId, from, to, direction = 'outbound' }) {
  return Buffer.from(JSON.stringify({
    vsp: true,
    tenantId,
    from: normalizePhoneNumber(from),
    to: normalizePhoneNumber(to),
    direction,
  })).toString('base64');
}

function parseRecordingClientState(clientState) {
  if (!clientState) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(clientState), 'base64').toString('utf8'));
    if (!parsed?.vsp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function pickRecordingUrl(payload) {
  const urls = payload.recording_urls
    || payload.public_recording_urls
    || payload.download_urls
    || {};
  return urls.mp3 || urls.wav || Object.values(urls).find(Boolean) || null;
}

function inferDirectionFromConnection(recording, tenantIdFromTo, tenantIdFromFrom) {
  const credId = process.env.TELNYX_CREDENTIAL_CONNECTION_ID?.trim();
  const texmlId = process.env.TELNYX_CONNECTION_ID?.trim();
  if (credId && recording.connection_id === credId) return 'outbound';
  if (texmlId && recording.connection_id === texmlId) return 'inbound';
  return inferRecordingDirection(tenantIdFromTo, tenantIdFromFrom);
}

function computeRecordingDurationSeconds(payload) {
  const started = payload.recording_started_at || payload.start_time;
  const ended = payload.recording_ended_at || payload.end_time;
  if (!started || !ended) return null;
  const seconds = Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

async function saveCallRecordingFromCallControlEvent(prisma, body) {
  const payload = body?.data?.payload;
  if (!payload) return null;

  const recordingUrl = pickRecordingUrl(payload);
  if (!recordingUrl) return null;

  const recordingSid = payload.recording_id || null;
  const callSid = payload.call_session_id || payload.call_control_id || null;
  const durationSeconds = computeRecordingDurationSeconds(payload);

  const clientState = parseRecordingClientState(payload.client_state);
  let from = normalizePhoneNumber(clientState?.from || payload.from) || 'unknown';
  let to = normalizePhoneNumber(clientState?.to || payload.to) || 'unknown';
  let direction = clientState?.direction || 'outbound';
  let tenantId = clientState?.tenantId || null;

  if (!tenantId) {
    const tenantIdFromTo = await resolveTenantIdForRecording(prisma, to);
    const tenantIdFromFrom = await resolveTenantIdForRecording(prisma, from);
    tenantId = tenantIdFromTo || tenantIdFromFrom;
    if (!direction || direction === 'outbound') {
      direction = inferRecordingDirection(tenantIdFromTo, tenantIdFromFrom);
    }
  }

  if (!tenantId) return null;

  if (recordingSid) {
    const existing = await prisma.callRecording.findUnique({ where: { recordingSid } });
    if (existing) return existing;
  }

  return prisma.callRecording.create({
    data: {
      tenantId,
      callSid,
      recordingSid,
      from,
      to,
      direction,
      recordingUrl: String(recordingUrl),
      durationSeconds,
    },
  });
}

async function saveCallRecordingFromTelnyxApi(prisma, recording, { tenantIdFilter } = {}) {
  if (String(recording.status || '').toLowerCase() !== 'completed') return null;

  const recordingSid = recording.id || null;
  if (recordingSid) {
    const existing = await prisma.callRecording.findUnique({ where: { recordingSid } });
    if (existing) return existing;
  }

  const recordingUrl = pickRecordingUrl(recording);
  if (!recordingUrl) return null;

  const from = normalizePhoneNumber(recording.from) || 'unknown';
  const to = normalizePhoneNumber(recording.to) || 'unknown';

  const tenantIdFromTo = await resolveTenantIdForRecording(prisma, to);
  const tenantIdFromFrom = await resolveTenantIdForRecording(prisma, from);
  const tenantId = tenantIdFromTo || tenantIdFromFrom;
  if (!tenantId) return null;
  if (tenantIdFilter && tenantId !== tenantIdFilter) return null;

  const direction = inferDirectionFromConnection(recording, tenantIdFromTo, tenantIdFromFrom);
  const durationSeconds = recording.duration_millis != null
    ? Math.max(1, Math.round(Number(recording.duration_millis) / 1000))
    : computeRecordingDurationSeconds(recording);

  return prisma.callRecording.create({
    data: {
      tenantId,
      callSid: recording.call_session_id || recording.call_control_id || null,
      recordingSid,
      from,
      to,
      direction,
      recordingUrl: String(recordingUrl),
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    },
  });
}

async function saveCallRecordingFromPayload(prisma, payload) {
  const recordingUrl = payload.RecordingUrl || payload.recording_url;
  if (!recordingUrl) return null;
  if (!isCompletedCallRecording(payload)) return null;

  const recordingSid = payload.RecordingSid || payload.recording_sid || null;
  const callSid = payload.CallSid || payload.call_sid || null;
  const from = normalizePhoneNumber(payload.From || payload.from) || 'unknown';
  const to = normalizePhoneNumber(payload.To || payload.to) || 'unknown';
  const durationRaw = payload.RecordingDuration ?? payload.recording_duration;
  const durationSeconds = durationRaw != null && durationRaw !== ''
    ? Number(durationRaw)
    : null;

  if (Number.isFinite(durationSeconds) && durationSeconds <= 0) return null;

  const tenantIdFromTo = await resolveTenantIdForRecording(prisma, to);
  const tenantIdFromFrom = await resolveTenantIdForRecording(prisma, from);
  const tenantId = tenantIdFromTo || tenantIdFromFrom
    || await resolveTenantIdForRecording(prisma, payload.Called || payload.called);
  if (!tenantId) return null;

  const direction = inferRecordingDirection(tenantIdFromTo, tenantIdFromFrom);

  if (recordingSid) {
    const existing = await prisma.callRecording.findUnique({ where: { recordingSid } });
    if (existing) return existing;
  }

  return prisma.callRecording.create({
    data: {
      tenantId,
      callSid,
      recordingSid,
      from,
      to,
      direction,
      recordingUrl: String(recordingUrl),
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    },
  });
}

module.exports = {
  mapCallRecording,
  buildRecordingClientState,
  parseRecordingClientState,
  resolveTenantIdForRecording,
  inferRecordingDirection,
  pickRecordingUrl,
  saveCallRecordingFromTelnyxApi,
  saveCallRecordingFromPayload,
  saveCallRecordingFromCallControlEvent,
};
