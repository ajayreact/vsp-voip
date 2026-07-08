/**
 * Ring-first PSTN caller-abandon lifecycle helpers.
 *
 * Outbound desk-leg call.hangup during ring-first (bridgeOnAnswer:false) is
 * almost always Telnyx-initiated — we do not call hangupCall() on the outbound
 * sequential-no-answer path today. Legs we cancel via abandonInboundCaller()
 * are marked in session.legCancelRequested so handleHangup() can distinguish
 * API-initiated hangups from Telnyx cascade hangups in logs.
 */

const RING_IN_PROGRESS_STAGES = new Set(['init', 'connect', 'ringing', 'preamble']);

/** dial.ended statuses that mean "try next ring target" while PSTN is still waiting. */
const DIAL_PROGRESSION_STATUSES = new Set(['no-answer', 'busy', 'failed', 'timeout']);

function isRingInProgressStage(stage) {
  return RING_IN_PROGRESS_STAGES.has(String(stage || ''));
}

function isCallerAbandoned(session) {
  return Boolean(session?.callerAbandoned);
}

/** Inbound PSTN leg hangup payload — caller disconnected before bridge. */
function inboundHangupIndicatesCallerAbandoned(payload) {
  const cause = String(payload?.hangup_cause || '').toLowerCase();
  if (cause === 'originator_cancel' || cause === 'caller_cancel') return true;
  const source = String(payload?.hangup_source || '').toLowerCase();
  return source === 'caller';
}

function isDialProgressionStatus(dialStatus) {
  return DIAL_PROGRESSION_STATUSES.has(String(dialStatus || '').toLowerCase());
}

function isLegCancelApiInitiated(session, legCallControlId) {
  if (!session?.legCancelRequested || !legCallControlId) return false;
  return Boolean(session.legCancelRequested[legCallControlId]);
}

function markLegCancelRequested(session, legCallControlId) {
  if (!session || !legCallControlId) return session;
  if (!session.legCancelRequested) session.legCancelRequested = {};
  session.legCancelRequested[legCallControlId] = Date.now();
  return session;
}

function isOutboundLegTerminalForAnswer(leg) {
  if (!leg) return false;
  return leg.status === 'cancelled' || leg.status === 'failed';
}

function shouldBlockRingProgression(session) {
  return isCallerAbandoned(session);
}

/** Ring-first parked PSTN: outbound hangup is not callee no-answer — do not advance. */
function shouldDeferOutboundHangupAdvance(session) {
  return Boolean(session?.deferPstnAnswerUntilAgent && !session?.pstnAnswered);
}

function hangupOriginDiagnostics(payload, session, legCallControlId) {
  return {
    hangup_cause: payload?.hangup_cause ?? null,
    hangup_source: payload?.hangup_source ?? null,
    sip_hangup_cause: payload?.sip_hangup_cause ?? null,
    apiCancelInitiated: isLegCancelApiInitiated(session, legCallControlId),
    callerAbandoned: isCallerAbandoned(session),
    deferPstnAnswer: Boolean(session?.deferPstnAnswerUntilAgent && !session?.pstnAnswered),
  };
}

module.exports = {
  RING_IN_PROGRESS_STAGES,
  DIAL_PROGRESSION_STATUSES,
  isRingInProgressStage,
  isCallerAbandoned,
  inboundHangupIndicatesCallerAbandoned,
  isDialProgressionStatus,
  isLegCancelApiInitiated,
  markLegCancelRequested,
  isOutboundLegTerminalForAnswer,
  shouldBlockRingProgression,
  shouldDeferOutboundHangupAdvance,
  hangupOriginDiagnostics,
};
