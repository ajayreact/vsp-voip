/**
 * Safe JSON parse — returns null on invalid input instead of throwing.
 * @param {string|null|undefined} raw
 * @returns {Record<string, unknown>|null}
 */
function safeJsonParse(raw) {
  if (raw == null || raw === '') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

module.exports = { safeJsonParse };
