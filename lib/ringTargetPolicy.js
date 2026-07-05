/**
 * Extension device ring strategy — policy layer over endpoint inventory.
 *
 * endpointType / endpoints[] = descriptive (what surfaces exist).
 * deviceRingStrategy = which PSTN lifecycle path to use (ring-first vs Option A).
 *
 * Temporary pilot override until Extension.deviceRingStrategy ships.
 *
 * @see docs/vsp/pbx/09-extension-routing.md
 */

const { ENDPOINT_TYPES } = require('./ringTargetEndpoints');

const EXTENSION_DEVICE_RING_STRATEGY = Object.freeze({
  SIMULTANEOUS: 'SIMULTANEOUS',
  DESK_FIRST: 'DESK_FIRST',
  MOBILE_FIRST: 'MOBILE_FIRST',
  DESK_ONLY: 'DESK_ONLY',
  MOBILE_ONLY: 'MOBILE_ONLY',
});

/**
 * Production pilot overrides — tenant-scoped (not extension-number global).
 * Remove when Extension.deviceRingStrategy is in DB.
 *
 * Match by extensionId alone, or tenantId + extensionNumber together.
 */
const TEMP_DESK_FIRST_OVERRIDES = Object.freeze([
  {
    tenantId: '00000000-0000-4000-8000-000000000001',
    extensionNumber: '101',
  },
]);

function matchesDeskFirstOverride(extension) {
  if (!extension) return false;

  const tenantId = extension.tenantId || null;
  const extensionNumber = String(extension.extensionNumber || '').trim();
  const extensionId = extension.id || null;

  return TEMP_DESK_FIRST_OVERRIDES.some((override) => {
    if (override.extensionId) {
      return extensionId === override.extensionId;
    }
    if (override.tenantId && override.extensionNumber) {
      return tenantId === override.tenantId
        && extensionNumber === String(override.extensionNumber).trim();
    }
    return false;
  });
}

function resolveDeviceRingStrategy(extension) {
  if (!extension) return EXTENSION_DEVICE_RING_STRATEGY.SIMULTANEOUS;
  if (matchesDeskFirstOverride(extension)) {
    return EXTENSION_DEVICE_RING_STRATEGY.DESK_FIRST;
  }
  return EXTENSION_DEVICE_RING_STRATEGY.SIMULTANEOUS;
}

function hasDeskCapableTarget(target) {
  if (!target) return false;
  if (target.endpointType === ENDPOINT_TYPES.DESK) return true;
  const endpoints = Array.isArray(target.endpoints) ? target.endpoints : [];
  return endpoints.some((item) => item.endpointType === ENDPOINT_TYPES.DESK);
}

function hasActiveMobileOrWebRtcEndpoints(target) {
  const endpoints = Array.isArray(target?.endpoints) ? target.endpoints : [];
  return endpoints.some((item) => (
    (item.endpointType === ENDPOINT_TYPES.MOBILE || item.endpointType === ENDPOINT_TYPES.WEBRTC)
    && item.registered === true
    && item.source !== 'push_token'
  ));
}

function isMobileOnlyAppTarget(target) {
  if (target?.type !== 'app') return false;
  if (hasDeskCapableTarget(target)) return false;
  return (
    target.endpointType === ENDPOINT_TYPES.MOBILE
    || target.endpointType === ENDPOINT_TYPES.WEBRTC
  );
}

function targetUsesRingFirst(target) {
  const strategy = target?.deviceRingStrategy || EXTENSION_DEVICE_RING_STRATEGY.SIMULTANEOUS;
  if (
    strategy === EXTENSION_DEVICE_RING_STRATEGY.DESK_ONLY
    || strategy === EXTENSION_DEVICE_RING_STRATEGY.DESK_FIRST
  ) {
    return hasDeskCapableTarget(target);
  }
  return false;
}

function targetUsesOptionA(target) {
  const strategy = target?.deviceRingStrategy || EXTENSION_DEVICE_RING_STRATEGY.SIMULTANEOUS;

  if (
    strategy === EXTENSION_DEVICE_RING_STRATEGY.DESK_ONLY
    || strategy === EXTENSION_DEVICE_RING_STRATEGY.DESK_FIRST
  ) {
    return false;
  }

  if (
    strategy === EXTENSION_DEVICE_RING_STRATEGY.MOBILE_ONLY
    || strategy === EXTENSION_DEVICE_RING_STRATEGY.MOBILE_FIRST
  ) {
    return true;
  }

  // SIMULTANEOUS — active mobile/WebRTC, mobile-only employee, or legacy push install.
  if (hasActiveMobileOrWebRtcEndpoints(target)) return true;
  if (isMobileOnlyAppTarget(target)) return true;
  if (target?.user?.pushDeviceToken) return true;
  return false;
}

function usesRingFirstPath(targets) {
  if (!Array.isArray(targets) || !targets.length) return false;
  if (targets.some((target) => targetUsesOptionA(target))) return false;
  return targets.some((target) => targetUsesRingFirst(target));
}

function usesOptionARingPath(targets) {
  if (!Array.isArray(targets) || !targets.length) return false;
  return targets.some((target) => targetUsesOptionA(target));
}

module.exports = {
  EXTENSION_DEVICE_RING_STRATEGY,
  TEMP_DESK_FIRST_OVERRIDES,
  matchesDeskFirstOverride,
  resolveDeviceRingStrategy,
  hasDeskCapableTarget,
  hasActiveMobileOrWebRtcEndpoints,
  isMobileOnlyAppTarget,
  targetUsesRingFirst,
  targetUsesOptionA,
  usesRingFirstPath,
  usesOptionARingPath,
};
