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

function classifyCallType(status, direction) {
  const s = String(status || '').toLowerCase();
  const dir = String(direction || 'inbound').toLowerCase();

  if (['no-answer', 'busy', 'failed', 'canceled', 'cancelled'].includes(s)) {
    return dir === 'outbound' ? 'missed' : 'missed';
  }
  if (dir === 'outbound') return 'outbound';
  if (s === 'completed' || s === 'answered' || s === 'in-progress') return 'inbound';
  return dir === 'outbound' ? 'outbound' : 'inbound';
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
  formatCallDuration,
};
