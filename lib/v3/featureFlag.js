/**
 * Tenant Portal V3 — V2 retired; portal is always enabled.
 * requireV3Enabled remains as a no-op middleware hook for route mounting.
 */

function isV3PortalEnabled() {
  return true;
}

function requireV3Enabled(_req, _res, next) {
  return next();
}

module.exports = { isV3PortalEnabled, requireV3Enabled };
