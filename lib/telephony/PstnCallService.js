const { getCallControlApplicationId } = require('../telnyxCallControlSetup');
const { resolveParkedOutboundPstnFrom } = require('./CallerResolver');
const { logDeskOutboundRoute, logDeskTelephonyEvent } = require('./deskOutboundLogger');
const defaultBridge = require('./CallBridgeService');

/**
 * Desk → PSTN outbound (V2 orchestration only — reuses existing CLI + dial helpers).
 *
 * @param {object} ctx
 * @param {import('@prisma/client').PrismaClient} ctx.prisma
 * @param {object} ctx.payload Raw Telnyx payload
 * @param {object} ctx.platform Platform settings
 * @param {object|null} ctx.caller Resolved caller (may be null)
 * @param {{ kind: string, pstnNumber?: string, tenantId?: string|null }} ctx.destination
 * @param {object} [ctx.bridge] CallBridgeService adapter (injectable for tests)
 */
async function handlePstnOutbound(ctx) {
  const {
    prisma,
    payload,
    platform,
    caller,
    destination,
    bridge = defaultBridge,
  } = ctx;

  const callControlApplicationId = getCallControlApplicationId(platform);
  if (!callControlApplicationId) {
    logDeskOutboundRoute({
      router: 'V2',
      destination: 'PSTN',
      result: 'skipped',
      reason: 'missing_call_control_application_id',
      callControlId: payload?.call_control_id || null,
      tenantId: destination?.tenantId ?? caller?.tenantId ?? null,
    });
    return false;
  }

  const callControlId = payload?.call_control_id;
  const to = destination?.pstnNumber || String(payload?.to || '').trim();
  const rawFrom = String(payload?.from || '').trim();

  if (!callControlId || !to) {
    logDeskOutboundRoute({
      router: 'V2',
      destination: 'PSTN',
      result: 'skipped',
      reason: 'missing_call_control_id_or_destination',
      callControlId: callControlId || null,
      tenantId: destination?.tenantId ?? caller?.tenantId ?? null,
    });
    return false;
  }

  const from = await resolveParkedOutboundPstnFrom(prisma, payload, caller);
  if (from !== rawFrom) {
    logDeskOutboundRoute({
      router: 'V2',
      destination: 'PSTN',
      phase: 'caller_id_normalized',
      callControlId,
      tenantId: destination?.tenantId ?? caller?.tenantId ?? null,
      rawFrom,
      from,
    });
  }

  logDeskOutboundRoute({
    router: 'V2',
    destination: 'PSTN',
    phase: 'dial',
    callControlId,
    tenantId: destination?.tenantId ?? caller?.tenantId ?? null,
    to,
    from,
  });

  try {
    const dialResult = await bridge.dialAndBridge(callControlId, {
      to,
      from,
      connectionId: callControlApplicationId,
      timeoutSecs: 45,
    });

    logDeskOutboundRoute({
      version: 'V2',
      destination: 'PSTN',
      result: 'dialed',
      callControlId,
      tenantId: destination?.tenantId ?? caller?.tenantId ?? null,
      outboundLegId: dialResult?.call_control_id ?? null,
    });
    logDeskTelephonyEvent('bridge.created', {
      callControlId,
      outboundLegId: dialResult?.call_control_id ?? null,
      tenantId: destination?.tenantId ?? caller?.tenantId ?? null,
      destination: to,
      route: 'PSTN',
    });

    return true;
  } catch (error) {
    logDeskOutboundRoute({
      version: 'V2',
      destination: 'PSTN',
      result: 'error',
      callControlId,
      tenantId: destination?.tenantId ?? caller?.tenantId ?? null,
      error: error.message,
    });
    logDeskTelephonyEvent('bridge.failed', {
      callControlId,
      tenantId: destination?.tenantId ?? caller?.tenantId ?? null,
      destination: to,
      route: 'PSTN',
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  handlePstnOutbound,
};
