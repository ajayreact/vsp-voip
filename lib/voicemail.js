const { normalizePhoneNumber } = require('./phone');
const { pickRecordingUrl } = require('./callRecording');

function clampVoicemailMaxLength(value) {
  const length = Number(value);
  if (!Number.isFinite(length)) return 120;
  return Math.min(Math.max(Math.round(length), 30), 600);
}

function mapVoicemailRecord(voicemail) {
  return {
    id: voicemail.id,
    tenantId: voicemail.tenantId,
    extensionId: voicemail.extensionId || null,
    ringGroupId: voicemail.ringGroupId || null,
    callSid: voicemail.callSid,
    recordingSid: voicemail.recordingSid,
    from: voicemail.from,
    to: voicemail.to,
    recordingUrl: voicemail.recordingUrl,
    durationSeconds: voicemail.durationSeconds,
    isRead: voicemail.isRead,
    createdAt: voicemail.createdAt,
  };
}

function buildExtensionVoicemailToLabel(extensionNumber) {
  if (!extensionNumber) return null;
  return `ext:${String(extensionNumber).trim()}`;
}

function resolveSessionVoicemailExtensionId(session) {
  if (!session) return null;
  return session.voicemailExtensionId
    || session.targetExtensionId
    || session.extensionId
    || null;
}

function buildVoicemailClientState({
  tenantId,
  from,
  to,
  ringGroupId,
  extensionId,
}) {
  return Buffer.from(JSON.stringify({
    vsp: true,
    kind: 'voicemail',
    tenantId,
    from: normalizePhoneNumber(from) || from,
    to: normalizePhoneNumber(to) || to,
    ringGroupId: ringGroupId || null,
    extensionId: extensionId || null,
  })).toString('base64');
}

function buildVoicemailClientStateFromSession(session) {
  return buildVoicemailClientState({
    tenantId: session.tenantId,
    from: session.from,
    to: session.to,
    ringGroupId: session.ringGroupId || null,
    extensionId: resolveSessionVoicemailExtensionId(session),
  });
}

function parseVoicemailClientState(clientState) {
  if (!clientState) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(clientState), 'base64').toString('utf8'));
    if (parsed?.kind !== 'voicemail') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function resolveTenantIdForVoicemail(prisma, dialedNumber) {
  const normalized = normalizePhoneNumber(dialedNumber);
  if (!normalized) return null;

  const phone = await prisma.phoneNumber.findUnique({
    where: { number: normalized },
    select: { tenantId: true },
  });
  return phone?.tenantId ?? null;
}

async function resolveExtensionIdForVoicemail(prisma, tenantId, { extensionId, to, ringGroupId }) {
  if (extensionId) {
    const ext = await prisma.extension.findFirst({
      where: { id: extensionId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (ext) return ext.id;
  }

  const toRaw = String(to || '').trim();
  const extMatch = toRaw.match(/^ext:(\d{2,6})$/i);
  if (extMatch) {
    const ext = await prisma.extension.findFirst({
      where: { tenantId, extensionNumber: extMatch[1], status: 'ACTIVE' },
      select: { id: true },
    });
    if (ext) return ext.id;
  }

  const normalized = normalizePhoneNumber(to);
  if (normalized) {
    const phone = await prisma.phoneNumber.findUnique({
      where: { number: normalized },
      select: { extensionId: true, tenantId: true },
    });
    if (phone?.tenantId === tenantId && phone.extensionId) {
      return phone.extensionId;
    }
  }

  if (ringGroupId) {
    const members = await prisma.ringGroupMember.findMany({
      where: { ringGroupId, isActive: true },
      select: { extensionId: true },
      take: 2,
    });
    if (members.length === 1) {
      return members[0].extensionId;
    }
  }

  return null;
}

function extensionVoicemailWhereClause(tenantId, extensionId, didNumbers = []) {
  const or = [{ extensionId }];
  if (didNumbers.length) {
    or.push({ to: { in: didNumbers } });
  }
  return { tenantId, OR: or };
}

async function saveVoicemailFromPayload(prisma, payload) {
  const recordingUrl = payload.RecordingUrl || payload.recording_url;
  if (!recordingUrl) return null;

  const recordingSid = payload.RecordingSid || payload.recording_sid || null;
  const callSid = payload.CallSid || payload.call_sid || null;
  const from = normalizePhoneNumber(payload.From || payload.from) || 'unknown';
  const to = normalizePhoneNumber(payload.To || payload.to) || 'unknown';
  const durationRaw = payload.RecordingDuration ?? payload.recording_duration;
  const durationSeconds = durationRaw != null && durationRaw !== ''
    ? Number(durationRaw)
    : null;

  let tenantId = await resolveTenantIdForVoicemail(prisma, to);
  if (!tenantId) {
    tenantId = await resolveTenantIdForVoicemail(prisma, payload.Called || payload.called);
  }
  if (!tenantId) return null;

  const extensionId = await resolveExtensionIdForVoicemail(prisma, tenantId, { to });

  if (recordingSid) {
    const existing = await prisma.voicemail.findUnique({ where: { recordingSid } });
    if (existing) return existing;
  }

  return prisma.voicemail.create({
    data: {
      tenantId,
      extensionId,
      callSid,
      recordingSid,
      from,
      to,
      recordingUrl: String(recordingUrl),
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    },
  });
}

async function saveVoicemailFromCallControlEvent(prisma, body) {
  const payload = body?.data?.payload;
  if (!payload) return null;

  const recordingUrl = pickRecordingUrl(payload);
  if (!recordingUrl) return null;

  const clientState = parseVoicemailClientState(payload.client_state);
  const recordingSid = payload.recording_id || null;
  const callSid = payload.call_session_id || payload.call_control_id || null;
  const from = normalizePhoneNumber(clientState?.from || payload.from) || 'unknown';
  const to = normalizePhoneNumber(clientState?.to || payload.to) || 'unknown';
  let tenantId = clientState?.tenantId || null;

  if (!tenantId) {
    tenantId = await resolveTenantIdForVoicemail(prisma, to);
  }
  if (!tenantId) return null;

  const extensionId = await resolveExtensionIdForVoicemail(prisma, tenantId, {
    extensionId: clientState?.extensionId,
    to: clientState?.to || to,
    ringGroupId: clientState?.ringGroupId,
  });

  const started = payload.recording_started_at || payload.start_time;
  const ended = payload.recording_ended_at || payload.end_time;
  let durationSeconds = null;
  if (started && ended) {
    durationSeconds = Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 1000);
  }

  if (recordingSid) {
    const existing = await prisma.voicemail.findUnique({ where: { recordingSid } });
    if (existing) return existing;
  }

  return prisma.voicemail.create({
    data: {
      tenantId,
      extensionId,
      ringGroupId: clientState?.ringGroupId || null,
      callSid,
      recordingSid,
      from,
      to,
      recordingUrl: String(recordingUrl),
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    },
  });
}

module.exports = {
  clampVoicemailMaxLength,
  mapVoicemailRecord,
  buildExtensionVoicemailToLabel,
  resolveSessionVoicemailExtensionId,
  buildVoicemailClientState,
  buildVoicemailClientStateFromSession,
  parseVoicemailClientState,
  resolveExtensionIdForVoicemail,
  extensionVoicemailWhereClause,
  saveVoicemailFromPayload,
  saveVoicemailFromCallControlEvent,
};
