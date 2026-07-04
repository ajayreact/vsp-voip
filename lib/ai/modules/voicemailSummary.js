const { getStoredTranscriptText } = require('../transcription/transcriptStore');
const { AiPolicyError } = require('../errors');
const { getEntitySummary, enqueueSummaryGeneration, executeSummaryGeneration } = require('./summaryEngine');

async function buildVoicemailTranscript(prisma, tenantId, voicemail, override) {
  if (override?.trim()) return override.trim();
  if (prisma && tenantId && voicemail?.id) {
    const stored = await getStoredTranscriptText(prisma, tenantId, 'voicemail', voicemail.id);
    if (stored) return stored;
  }

  const from = voicemail.from || 'Unknown caller';
  const duration = voicemail.durationSeconds ?? 0;
  return `[No speech transcript available yet. Voicemail from ${from}, duration ${duration} seconds.]`;
}

async function loadVoicemail(prisma, tenantId, voicemailId) {
  const voicemail = await prisma.voicemail.findFirst({
    where: { id: voicemailId, tenantId },
  });
  if (!voicemail) {
    throw new AiPolicyError('Voicemail not found', 'VOICEMAIL_NOT_FOUND', { status: 404 });
  }
  return voicemail;
}

async function getVoicemailSummary(prisma, tenantId, voicemailId) {
  return getEntitySummary(prisma, tenantId, 'voicemail', voicemailId);
}

async function requestVoicemailSummary(prisma, params) {
  const { tenantId, voicemailId, userId, transcript: transcriptOverride, async: runAsync = true } = params;
  const voicemail = await loadVoicemail(prisma, tenantId, voicemailId);
  const transcript = await buildVoicemailTranscript(prisma, tenantId, voicemail, transcriptOverride);

  const jobParams = {
    tenantId,
    entityType: 'voicemail',
    entityId: voicemailId,
    userId,
    transcript,
    tenantName: params.tenantName,
  };

  if (runAsync) {
    const record = await enqueueSummaryGeneration(prisma, jobParams);
    return { queued: true, summary: record };
  }

  const summary = await executeSummaryGeneration(prisma, jobParams);
  return { queued: false, summary };
}

module.exports = {
  buildVoicemailTranscript,
  getVoicemailSummary,
  requestVoicemailSummary,
};
