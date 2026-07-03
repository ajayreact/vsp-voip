const { GLOBAL_FLAGS } = require('../telephony-v3/constants');
const { isV3CallControlApplicationOutbound } = require('./PayloadNormalizer');
const { resolveCallerFromPayload } = require('./CallerResolver');
const featureFlags = require('../telephony-v3/FeatureFlags/featureFlagService');

/**
 * True when global V3 ingress is configured to accept webhooks.
 */
function isV3IngressConfigured() {
  return process.env[GLOBAL_FLAGS.TELEPHONY_V3_INGRESS_ENABLED] === 'true';
}

/**
 * True when tenant flags permit V3 desk outbound execution (answer + dial via worker).
 * When false, legacy handleParkedWebRtcOutboundInitiated must handle the call.
 *
 * @param {import('../types').V3FeatureFlagSnapshot} flags
 */
function tenantFlagsPermitV3DeskExecution(flags) {
  return flags.engineEnabled === true
    && flags.deskEnabled === true
    && flags.observeOnly !== true;
}

/**
 * Resolve tenant + evaluate whether V3 should bridge/consume a desk parked outbound webhook.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} payload Telnyx call.initiated payload
 * @param {object} platform Platform settings
 * @returns {Promise<{ shouldBridge: boolean, tenantId: string|null, reason: string }>}
 */
async function evaluateV3DeskOutboundBridge(prisma, payload, platform) {
  if (!isV3CallControlApplicationOutbound(payload)) {
    return { shouldBridge: false, tenantId: null, reason: 'not_v3_call_control_app' };
  }

  if (!isV3IngressConfigured()) {
    return { shouldBridge: false, tenantId: null, reason: 'ingress_disabled' };
  }

  const caller = await resolveCallerFromPayload(prisma, payload, platform);
  const tenantId = caller?.tenantId ? String(caller.tenantId) : null;

  if (!tenantId) {
    return { shouldBridge: false, tenantId: null, reason: 'tenant_unresolved' };
  }

  const flags = await featureFlags.getTenantFlags(tenantId);

  if (!flags.engineEnabled) {
    return { shouldBridge: false, tenantId, reason: 'engine_disabled' };
  }
  if (!flags.deskEnabled) {
    return { shouldBridge: false, tenantId, reason: 'desk_disabled' };
  }
  if (flags.observeOnly) {
    return { shouldBridge: false, tenantId, reason: 'observe_only' };
  }

  return { shouldBridge: true, tenantId, reason: 'v3_desk_execution_enabled' };
}

module.exports = {
  isV3IngressConfigured,
  tenantFlagsPermitV3DeskExecution,
  evaluateV3DeskOutboundBridge,
};
