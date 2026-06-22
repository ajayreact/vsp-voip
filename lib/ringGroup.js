const { normalizePhoneNumber } = require('./phone');

function normalizeRingGroupMembers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const type = String(item.type || 'phone').toLowerCase() === 'app' ? 'app' : 'phone';
      return {
        type,
        userId: type === 'app' ? (String(item.userId || '').trim() || null) : null,
        phone: type === 'phone'
          ? normalizePhoneNumber(item.phone || item.number || '')
          : null,
        label: String(item.label || '').trim(),
      };
    })
    .filter((item) => (item.type === 'app' && item.userId) || (item.type === 'phone' && item.phone));
}

function normalizeRingStrategy(value) {
  const strategy = String(value || 'simultaneous').toLowerCase();
  if (strategy === 'sequential') return 'sequential';
  if (strategy === 'round_robin' || strategy === 'longest_idle') return 'sequential';
  return 'simultaneous';
}

function normalizeRingStrategyEnum(value) {
  const map = {
    simultaneous: 'SIMULTANEOUS',
    sequential: 'SEQUENTIAL',
    round_robin: 'ROUND_ROBIN',
    longest_idle: 'LONGEST_IDLE',
  };
  const key = String(value || 'simultaneous').toLowerCase();
  return map[key] || 'SIMULTANEOUS';
}

function clampRingTimeout(value) {
  const timeout = Number(value);
  if (!Number.isFinite(timeout)) return 25;
  return Math.min(Math.max(Math.round(timeout), 10), 60);
}

module.exports = {
  normalizeRingGroupMembers,
  normalizeRingStrategy,
  normalizeRingStrategyEnum,
  clampRingTimeout,
};
