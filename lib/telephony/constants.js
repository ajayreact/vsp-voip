/** Shared telephony constants for desk outbound V2. */

const EXTENSION_DIAL_PATTERN = /^\d{2,6}$/;

/** Telnyx credential identity fields (same aliases as lib/voiceTelemetry.js registration). */
const CREDENTIAL_USERNAME_FIELDS = ['sip_username', 'username', 'credential_username', 'user_name'];

/**
 * Desk Call Router V2 — enabled by default (Phase 4).
 * Rollback: set DESK_CALL_ROUTER_V2_LEGACY=true or DESK_CALL_ROUTER_V2=false.
 */
function isDeskCallRouterV2Enabled() {
  if (process.env.DESK_CALL_ROUTER_V2_LEGACY === 'true') return false;
  if (process.env.DESK_CALL_ROUTER_V2 === 'false') return false;
  return true;
}

module.exports = {
  EXTENSION_DIAL_PATTERN,
  CREDENTIAL_USERNAME_FIELDS,
  isDeskCallRouterV2Enabled,
};
