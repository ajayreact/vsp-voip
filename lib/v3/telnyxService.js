/**
 * V3 Telnyx read wrapper.
 *
 * Read-only view of tenant-global Telnyx readiness (credential connection +
 * call control application) reused by HealthCheckService. This slice adds NO new
 * Telnyx write paths — it only reads persisted platform settings via the
 * existing lib/telnyxConfig.js helpers.
 */

const { loadPlatformSettings } = require('../platformSettings');
const { getCredentialConnectionId } = require('../telnyxConfig');

async function getTenantTelephonyReadiness(prisma) {
  let platform = null;
  try {
    platform = await loadPlatformSettings(prisma);
  } catch {
    // Platform settings unavailable — treated as "not ready" below.
  }

  const credentialConnectionId = getCredentialConnectionId(platform) || null;
  const callControlApplicationId = platform?.telnyxCallControlApplicationId
    || process.env.TELNYX_CALL_CONTROL_APP_ID?.trim()
    || process.env.TELNYX_CALL_CONTROL_APPLICATION_ID?.trim()
    || null;

  return {
    credentialConnectionId,
    callControlApplicationId,
    credentialReady: Boolean(credentialConnectionId),
    callControlReady: Boolean(callControlApplicationId),
    // Desk-originated outbound webhooks require a Call Control application.
    webhookReady: Boolean(callControlApplicationId),
  };
}

module.exports = { getTenantTelephonyReadiness };
