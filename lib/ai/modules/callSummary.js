const { getStoredTranscriptText } = require('../transcription/transcriptStore');
const { AiPolicyError } = require('../errors');
const { getEntitySummary, enqueueSummaryGeneration, executeSummaryGeneration } = require('./summaryEngine');

async function buildCallTranscript(prisma, tenantId, callLog, override) {
  if (override?.trim()) return override.trim();
  if (prisma && tenantId && callLog?.id) {
    const stored = await getStoredTranscriptText(prisma, tenantId, 'call', callLog.id);
    if (stored) return stored;
  }

  const direction = callLog.direction || 'unknown';
  const from = callLog.from || 'Unknown';
  const to = callLog.to || 'Unknown';
  const duration = callLog.durationSeconds ?? 0;
  const status = callLog.status || 'completed';
  return `[No speech transcript available yet. ${direction} call from ${from} to ${to}, status ${status}, duration ${duration} seconds.]`;
}

async function loadCallLog(prisma, tenantId, callId) {
  const callLog = await prisma.callLog.findFirst({
    where: { id: callId, tenantId },
  });
  if (!callLog) {
    throw new AiPolicyError('Call not found', 'CALL_NOT_FOUND', { status: 404 });
  }
  return callLog;
}

async function getCallSummary(prisma, tenantId, callId) {
  return getEntitySummary(prisma, tenantId, 'call', callId);
}

async function requestCallSummary(prisma, params) {
  const { tenantId, callId, userId, transcript: transcriptOverride, async: runAsync = true } = params;
  const callLog = await loadCallLog(prisma, tenantId, callId);

  if (!callLog.endedAt && callLog.status !== 'completed') {
    throw new AiPolicyError('Call summary is only available after call completion', 'CALL_NOT_COMPLETED', {
      status: 409,
    });
  }

  const transcript = await buildCallTranscript(prisma, tenantId, callLog, transcriptOverride);
  const jobParams = {
    tenantId,
    entityType: 'call',
    entityId: callId,
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
  buildCallTranscript,
  getCallSummary,
  requestCallSummary,
};
