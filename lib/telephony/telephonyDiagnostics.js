/**
 * Telephony diagnostics flag — LOGS ONLY. Zero functional behavior change.
 *
 * Enable on server (api + telephony-v3-worker):
 *   TELEPHONY_DIAGNOSTICS=true
 *
 * When enabled it activates the existing [TRACE] anchors across the
 * Desk→Desk pipeline (webhook → destination → ring targets → desk router →
 * internal dial → Telnyx dial request/response) without changing routing,
 * Call Control, SIP, Telnyx, tenant, or database behavior.
 *
 * Removable in one commit:
 *   - delete this file
 *   - revert the `TELEPHONY_DIAGNOSTICS` check in deskDeskTrace.js
 *   - delete scripts/telephony-diagnostics-report.js
 *
 * Read the timeline with:
 *   docker compose logs api telephony-v3-worker --since 30m 2>&1 \
 *     | node scripts/telephony-diagnostics-report.js --stdin
 */
function isTelephonyDiagnosticsEnabled() {
  const v = process.env.TELEPHONY_DIAGNOSTICS;
  return v === '1' || v === 'true';
}

module.exports = {
  isTelephonyDiagnosticsEnabled,
};
