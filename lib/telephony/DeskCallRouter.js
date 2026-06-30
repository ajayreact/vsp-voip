const { isDeskCallRouterV2Enabled } = require('./constants');
const {
  normalizeDeskOutboundPayload,
  isCallControlApplicationOutbound,
  isPstnDestination,
  isTelnyxCredentialSipDestination,
  parseInternalExtensionDestination,
} = require('./PayloadNormalizer');
const { resolveCallerFromPayload } = require('./CallerResolver');
const { resolveOutboundDestination, resolveExtensionNumberFromTo } = require('./DestinationResolver');
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

  const extensionNumber = options.extensionNumber
    ?? parseInternalExtensionDestination(payload?.to);
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

  const destination = await deps.resolveDestination(prisma, payload, caller);
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

  const extensionNumber = options.extensionNumber
    ?? parseInternalExtensionDestination(payload?.to);
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

  const destination = await deps.resolveDestination(prisma, payload, caller);
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

  const destination = await deps.resolveDestination(prisma, payload, caller);
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
 * Resolve extension digits from `to` (numeric, sip:NNN@, or Telnyx gencred credential URI).
 */
async function resolveDeskExtensionNumber(prisma, payload, platform, options, deps) {
  let extensionNumber = options.extensionNumber
    ?? parseInternalExtensionDestination(payload?.to);
  let caller = options.caller ?? null;

  if (!caller?.tenantId) {
    caller = await deps.resolveCaller(prisma, payload, platform, { logCallerResolved: true }) ?? caller;
  }

  if (!extensionNumber && isTelnyxCredentialSipDestination(payload?.to)) {
    extensionNumber = await resolveExtensionNumberFromTo(
      prisma,
      payload?.to,
      caller?.tenantId ?? null,
    );
  }

  return { extensionNumber, caller };
}

/**
 * Unified Desk CC App outbound router (mobile → extension → PSTN).
 *
 * @returns {boolean|null} null → legacy fallback
 */
async function routeDeskOutbound(prisma, payload, platform, options = {}, deps = defaultDeps) {
  const { extensionNumber, caller } = await resolveDeskExtensionNumber(
    prisma,
    payload,
    platform,
    options,
    deps,
  );
  const mergedOptions = {
    ...options,
    caller,
    callerProvided: Boolean(caller?.tenantId) || options.callerProvided,
    extensionNumber,
  };

  if (extensionNumber) {
    const mobileResult = await routeDeskMobileOutboundV2(
      prisma,
      payload,
      platform,
      mergedOptions,
      deps,
    );
    if (mobileResult !== null) return mobileResult;
    return routeDeskExtensionOutboundV2(prisma, payload, platform, mergedOptions, deps);
  }

  if (isPstnDestination(payload?.to)) {
    return routeDeskPstnOutboundV2(prisma, payload, platform, mergedOptions, deps);
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
