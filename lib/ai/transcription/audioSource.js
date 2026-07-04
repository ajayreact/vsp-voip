const { streamTelnyxRecording } = require('../../recordingSync');
const { AiTranscriptionError } = require('./errors');
const { getTranscriptionConfig } = require('./config');

async function streamToBuffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function fetchRecordingAudioBuffer({ recordingSid, recordingUrl, logContext }) {
  if (!recordingSid && !recordingUrl) {
    throw new AiTranscriptionError('No recording available for transcription', 'AI_TRANSCRIPTION_NO_AUDIO', 404);
  }

  const { stream, contentType } = await streamTelnyxRecording(recordingSid, {
    fallbackRecordingUrl: recordingUrl,
    logContext,
  });

  const audioBuffer = await streamToBuffer(stream);
  const maxBytes = getTranscriptionConfig().maxAudioBytes;
  if (audioBuffer.length > maxBytes) {
    throw new AiTranscriptionError(
      `Recording exceeds maximum transcription size (${maxBytes} bytes)`,
      'AI_TRANSCRIPTION_AUDIO_TOO_LARGE',
      413,
    );
  }

  return {
    audioBuffer,
    contentType: contentType || 'audio/mpeg',
    fileName: contentType?.includes('wav') ? 'recording.wav' : 'recording.mp3',
  };
}

async function resolveVoicemailAudioSource(prisma, tenantId, voicemailId) {
  const voicemail = await prisma.voicemail.findFirst({
    where: { id: voicemailId, tenantId },
  });
  if (!voicemail) {
    throw new AiTranscriptionError('Voicemail not found', 'VOICEMAIL_NOT_FOUND', 404);
  }
  return {
    entityType: 'voicemail',
    entityId: voicemailId,
    recordingSid: voicemail.recordingSid,
    recordingUrl: voicemail.recordingUrl,
    durationSeconds: voicemail.durationSeconds,
    logContext: { mediaType: 'voicemail', mediaId: voicemailId, callSid: voicemail.callSid },
  };
}

async function resolveCallAudioSource(prisma, tenantId, callId) {
  const callLog = await prisma.callLog.findFirst({
    where: { id: callId, tenantId },
  });
  if (!callLog) {
    throw new AiTranscriptionError('Call not found', 'CALL_NOT_FOUND', 404);
  }
  if (!callLog.endedAt && callLog.status !== 'completed') {
    throw new AiTranscriptionError('Call transcription requires a completed call', 'CALL_NOT_COMPLETED', 409);
  }

  const recording = callLog.callSid
    ? await prisma.callRecording.findFirst({
        where: { tenantId, callSid: callLog.callSid },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  if (!recording?.recordingSid && !recording?.recordingUrl) {
    throw new AiTranscriptionError('No call recording available for transcription', 'AI_TRANSCRIPTION_NO_AUDIO', 404);
  }

  return {
    entityType: 'call',
    entityId: callId,
    recordingSid: recording.recordingSid,
    recordingUrl: recording.recordingUrl,
    durationSeconds: recording.durationSeconds ?? callLog.durationSeconds,
    logContext: { mediaType: 'call', mediaId: callId, callSid: callLog.callSid },
  };
}

async function fetchEntityAudio(prisma, tenantId, entityType, entityId) {
  const source =
    entityType === 'voicemail'
      ? await resolveVoicemailAudioSource(prisma, tenantId, entityId)
      : entityType === 'call'
        ? await resolveCallAudioSource(prisma, tenantId, entityId)
        : null;

  if (!source) {
    throw new AiTranscriptionError(`Unsupported transcription entity: ${entityType}`, 'AI_TRANSCRIPTION_INVALID_ENTITY', 400);
  }

  const audio = await fetchRecordingAudioBuffer(source);
  return { ...source, ...audio };
}

module.exports = {
  streamToBuffer,
  fetchRecordingAudioBuffer,
  resolveVoicemailAudioSource,
  resolveCallAudioSource,
  fetchEntityAudio,
};
