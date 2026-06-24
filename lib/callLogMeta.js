function parseDurationSeconds(payload) {
  const raw =
    payload.CallDuration
    ?? payload.call_duration
    ?? payload.Duration
    ?? payload.duration;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** Telnyx-aligned terminal statuses used for classification. */
const INBOUND_MISSED_STATUSES = new Set(['no-answer', 'missed']);

/**
 * Map raw Telnyx / softphone status + direction to a stable callType taxonomy.
 *
 * Taxonomy:
 *   completed path: answered | outbound | inbound
 *   inbound unanswered: missed
 *   outbound unanswered: outbound_no_answer
 *   busy | failed | cancelled | rejected
 */
function classifyCallType(status, direction) {
  const s = String(status || '').toLowerCase();
  const dir = String(direction || 'inbound').toLowerCase();

  if (dir === 'outbound') {
    if (s === 'no-answer' || s === 'outbound_no_answer') return 'outbound_no_answer';
    if (s === 'busy') return 'busy';
    if (s === 'failed') return 'failed';
    if (s === 'canceled' || s === 'cancelled') return 'cancelled';
    if (s === 'rejected') return 'rejected';
    if (['completed', 'answered', 'ended', 'connected', 'in-progress'].includes(s)) return 'outbound';
    return 'outbound';
  }

  // inbound
  if (INBOUND_MISSED_STATUSES.has(s)) return 'missed';
  if (s === 'busy') return 'busy';
  if (s === 'failed') return 'failed';
  if (s === 'canceled' || s === 'cancelled') return 'cancelled';
  if (s === 'rejected') return 'rejected';
  if (['completed', 'answered', 'ended', 'connected', 'in-progress'].includes(s)) return 'answered';
  return 'inbound';
}

/**
 * Normalize softphone client status strings to Telnyx-style status for classifyCallType.
 */
function normalizeSoftphoneLogStatus(status, direction, { userDeclined, acceptedByUser, userCancelled } = {}) {
  const s = String(status || '').toLowerCase();
  const dir = String(direction || 'outbound').toLowerCase();

  if (['completed', 'ended', 'connected'].includes(s)) return 'completed';
  if (dir === 'inbound') {
    if (userDeclined || acceptedByUser) return 'rejected';
    if (s === 'missed') return 'no-answer';
    return s || 'no-answer';
  }

  // outbound granular termination
  if (s === 'outbound_no_answer' || s === 'no-answer') return 'no-answer';
  if (s === 'busy') return 'busy';
  if (s === 'failed') return 'failed';
  if (s === 'cancelled' || s === 'canceled' || userCancelled) return 'cancelled';
  if (s === 'rejected') return userCancelled ? 'cancelled' : 'no-answer';
  return s || 'failed';
}

/** Human-readable label for portal / reporting UIs. */
function callTypeDisplayLabel(callType) {
  switch (String(callType || '').toLowerCase()) {
    case 'missed':
      return 'Missed';
    case 'outbound_no_answer':
      return 'No Answer';
    case 'busy':
      return 'Busy';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'rejected':
      return 'Rejected';
    case 'answered':
      return 'Inbound';
    case 'inbound':
      return 'Inbound';
    case 'outbound':
      return 'Outbound';
    default:
      return callType
        ? String(callType).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Unknown';
  }
}

function formatCallDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

module.exports = {
  parseDurationSeconds,
  classifyCallType,
  normalizeSoftphoneLogStatus,
  callTypeDisplayLabel,
  formatCallDuration,
};
