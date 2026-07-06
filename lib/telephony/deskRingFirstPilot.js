/**
 * Pilot-tenant scoped opt-in for the desk-only ring-first PSTN defer gate.
 *
 * Root cause (Issue 1 — caller timer starts immediately): `usesRingFirstPath`
 * (lib/ringTargetPolicy.js) only defers the PSTN answer when the extension's
 * `deviceRingStrategy` is explicitly set to DESK_ONLY / DESK_FIRST. Extensions
 * that were never migrated to that field (the default is SIMULTANEOUS) fall
 * through to the eager-answer path even when every ring target is a desk
 * phone — see docs/vsp/pbx/21-event-sequence.md, which documents the intended
 * defer gate as "endpointType === 'desk' on all ring targets", not the
 * deviceRingStrategy field.
 *
 * Rather than changing the global default for every tenant (regression risk
 * called out explicitly by the user), this lets a tenant allowlist opt into
 * "all targets are desk endpoints" as an additional, equivalent ring-first
 * trigger — without touching `usesRingFirstPath` / `ringTargetPolicy.js` at
 * all for tenants not in the allowlist.
 *
 * DESK_RING_FIRST_PILOT_TENANT_IDS — comma-separated tenant IDs (optional).
 */

function parseAllowlist(raw) {
  return new Set(String(raw || '').split(',').map((s) => s.trim()).filter(Boolean));
}

function isDeskOnlyRingFirstPilotTenant(tenantId) {
  if (!tenantId) return false;
  const allowlist = parseAllowlist(process.env.DESK_RING_FIRST_PILOT_TENANT_IDS);
  return allowlist.has(String(tenantId));
}

module.exports = {
  isDeskOnlyRingFirstPilotTenant,
};
