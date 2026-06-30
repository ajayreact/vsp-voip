const { isDeskCallRouterV2Enabled } = require('./constants');
const {
  normalizeDeskOutboundPayload,
  isCallControlApplicationOutbound,
  isPstnDestination,
  parseInternalExtensionDestination,
} = require('./PayloadNormalizer');
const { resolveCallerFromPayload } = require('./CallerResolver');
const { resolveOutboundDestination } = require('./DestinationResolver');
const { handlePstnOutbound } = require('./PstnCallService');
const { handleExtensionOutbound } = require('./ExtensionCallService');
const { handleMobileOutbound } = require('./MobileCallService');
const { logDeskOutboundRoute, logDeskTelephonyEvent } = require('./deskOutboundLogger');

function logDestinationResolved(payload, caller, destination) {
  logDeskTelephonyEvent('destination.resolved', {
    callControlId: payload?.call_control_id || null,
    tenantId: destination?.tenantId ?? caller?.tenantId ?? null,
    kind: destination?.kind ?? null,
    extension: destination?.extensionNumber ?? null,
    pstnNumber: destination?.pstnNumber ?? null,
  });
}

const defaultDeps = {
  resolveCaller: resolveCallerFromPayload,
  resolveDestination: resolveOutboundDestination,
  pstnService: { handlePstnOutbound },
  extensionService: { handleExtensionOutbound },
  mobileService: { handleMobileOutbound },
};

/**
 * Phase 3C: Desk → Mobile via V2 router (extension with app ring targets).
 *
 * @returns {boolean|null} true/false when V2 handled; null → use extension/legacy handler
 */
async function routeDeskMobileOutboundV2(prisma, payload, platform, options = {}, deps = defaultDeps) {
  if (!isDeskCallRouterV2Enabled()) {
    return null;
  }

  if (!isCallControlApplicationOutbound(payload, platform)) {
    return null;
  }

  const extensionNumber = parseInternalExtensionDestination(payload?.to);
  if (!extensionNumber) {
    return null;
  }

  const normalized = normalizeDeskOutboundPayload(payload, platform);

  if (!normalized.outboundGate?.ok) {
    logDeskOutboundRoute({
      version: 'V2',
      destination: 'MOBILE',
      result: 'skipped',
      reason: normalized.outboundGate.reason,
      callControlId: normalized.callControlId,
      extension: extensionNumber,
    });
    return false;
  }

  let caller = options.caller ?? null;
  if (!options.callerProvided) {
    caller = await deps.resolveCaller(prisma, payload, platform, { logCallerResolved: true });
  }

  const destination = deps.resolveDestination(payload, caller);
  if (destination.kind !== 'EXTENSION') {
    return null;
  }
  logDestinationResolved(payload, caller, destination);

  const result = await deps.mobileService.handleMobileOutbound({
    prisma,
    payload,
    platform,
    caller,
    destination,
    bridge: options.bridge,
  });

  if (result === null) {
    return null;
  }

  return result;
}

/**
 * Phase 3B: Desk → Extension via V2 router.
 *
 * @returns {boolean|null} true/false when V2 handled; null → use legacy handler
 */
async function routeDeskExtensionOutboundV2(prisma, payload, platform, options = {}, deps = defaultDeps) {
  if (!isDeskCallRouterV2Enabled()) {
    return null;
  }

  if (!isCallControlApplicationOutbound(payload, platform)) {
    return null;
  }

  const extensionNumber = parseInternalExtensionDestination(payload?.to);
  if (!extensionNumber) {
    return null;
  }

  const normalized = normalizeDeskOutboundPayload(payload, platform);

  if (!normalized.outboundGate?.ok) {
    logDeskOutboundRoute({
      version: 'V2',
      destination: 'EXTENSION',
      result: 'skipped',
      reason: normalized.outboundGate.reason,
      callControlId: normalized.callControlId,
      extension: extensionNumber,
    });
    return false;
  }

  let caller = options.caller ?? null;
  if (!options.callerProvided) {
    caller = await deps.resolveCaller(prisma, payload, platform, { logCallerResolved: true });
  }

  const destination = deps.resolveDestination(payload, caller);
  if (destination.kind !== 'EXTENSION') {
    return null;
  }
  logDestinationResolved(payload, caller, destination);

  const result = await deps.extensionService.handleExtensionOutbound({
    prisma,
    payload,
    platform,
    caller,
    destination,
    bridge: options.bridge,
  });

  if (result === null) {
    return null;
  }

  return result;
}

/**
 * Phase 3A: Desk → PSTN via V2 router.
 *
 * @returns {boolean|null} true/false when V2 handled; null → use legacy passthrough
 */
async function routeDeskPstnOutboundV2(prisma, payload, platform, options = {}, deps = defaultDeps) {
  if (!isDeskCallRouterV2Enabled()) {
    return null;
  }

  if (!isCallControlApplicationOutbound(payload, platform)) {
    return null;
  }

  if (!isPstnDestination(payload?.to)) {
    return null;
  }

  const normalized = normalizeDeskOutboundPayload(payload, platform);

  if (!normalized.outboundGate?.ok) {
    logDeskOutboundRoute({
      router: 'V2',
      destination: 'PSTN',
      result: 'skipped',
      reason: normalized.outboundGate.reason,
      callControlId: normalized.callControlId,
    });
    return false;
  }

  let caller = options.caller ?? null;
  if (!options.callerProvided) {
    caller = await deps.resolveCaller(prisma, payload, platform, { logCallerResolved: true });
  }

  const destination = deps.resolveDestination(payload, caller);
  if (destination.kind !== 'PSTN') {
    return null;
  }
  logDestinationResolved(payload, caller, destination);

  logDeskOutboundRoute({
    version: 'V2',
    destination: 'PSTN',
    phase: 'route_selected',
    callControlId: normalized.callControlId,
    tenantId: destination.tenantId ?? caller?.tenantId ?? null,
    pstnNumber: destination.pstnNumber,
  });

  if (!caller?.tenantId) {
    logDeskOutboundRoute({
      version: 'V2',
      destination: 'PSTN',
      result: 'warning',
      reason: 'caller_not_resolved',
      callControlId: normalized.callControlId,
    });
  }

  return await deps.pstnService.handlePstnOutbound({
    prisma,
    payload,
    platform,
    caller,
    destination,
    bridge: options.bridge,
  });
}

/** @deprecated alias — use routeDeskPstnOutboundV2 */
async function handleDeskOutboundInitiated(prisma, payload, platform, options, deps) {
  return routeDeskPstnOutboundV2(prisma, payload, platform, options, deps);
}

/**
 * Unified Desk CC App outbound router (mobile → extension → PSTN).
 *
 * @returns {boolean|null} null → legacy fallback
 */
async function routeDeskOutbound(prisma, payload, platform, options = {}, deps = defaultDeps) {
  const extensionNumber = parseInternalExtensionDestination(payload?.to);

  if (extensionNumber) {
    const mobileResult = await routeDeskMobileOutboundV2(
      prisma,
      payload,
      platform,
      options,
      deps,
    );
    if (mobileResult !== null) return mobileResult;
    return routeDeskExtensionOutboundV2(prisma, payload, platform, options, deps);
  }

  if (isPstnDestination(payload?.to)) {
    return routeDeskPstnOutboundV2(prisma, payload, platform, options, deps);
  }

  return null;
}

module.exports = {
  routeDeskOutbound,
  routeDeskMobileOutboundV2,
  routeDeskExtensionOutboundV2,
  routeDeskPstnOutboundV2,
  handleDeskOutboundInitiated,
  defaultDeps,
};
