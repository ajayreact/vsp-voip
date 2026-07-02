/**
 * Tenant Portal V3 — feature flag.
 *
 * The entire V3 surface (routes/v3.js + services under lib/v3/) is inert unless
 * V3_PORTAL_ENABLED is truthy. When disabled, `requireV3Enabled` responds 404 so
 * the new routes are indistinguishable from non-existent ones. This lets V3 ship
 * alongside the existing portal with zero behavioral change until explicitly
 * enabled per environment.
 */

function isV3PortalEnabled() {
  const value = String(process.env.V3_PORTAL_ENABLED || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function requireV3Enabled(req, res, next) {
  if (!isV3PortalEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }
  return next();
}

module.exports = { isV3PortalEnabled, requireV3Enabled };
