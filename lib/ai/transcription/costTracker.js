/**
 * Per-minute STT pricing in microdollars (1 USD = 1_000_000 microdollars).
 */
const STT_PRICING_PER_MINUTE = {
  'whisper-1': 6_000,
  noop: 0,
  'local-whisper': 0,
};

function calculateSttCostMicros(model, durationSeconds = 0) {
  const perMinute = STT_PRICING_PER_MINUTE[model] ?? STT_PRICING_PER_MINUTE['whisper-1'];
  const minutes = Math.max(durationSeconds, 0) / 60;
  return Math.round(minutes * perMinute);
}

module.exports = {
  STT_PRICING_PER_MINUTE,
  calculateSttCostMicros,
};
