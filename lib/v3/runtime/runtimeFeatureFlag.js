/**
 * V3 Runtime Sync feature flag — disabled by default for safe rollout.
 *
 * V3_RUNTIME_SYNC_ENABLED=false (default) — no sync jobs enqueued or processed.
 * V3_RUNTIME_SYNC_TENANT_ALLOWLIST — optional comma-separated tenant IDs when enabled globally.
 */

function parseBool(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function isV3RuntimeSyncEnabled() {
  return parseBool(process.env.V3_RUNTIME_SYNC_ENABLED);
}

function getTenantAllowlist() {
  const raw = String(process.env.V3_RUNTIME_SYNC_TENANT_ALLOWLIST || '').trim();
  if (!raw) return null;
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

function isRuntimeSyncEnabledForTenant(tenantId) {
  if (!isV3RuntimeSyncEnabled()) return false;
  const allowlist = getTenantAllowlist();
  if (!allowlist) return true;
  return allowlist.has(String(tenantId));
}

module.exports = {
  isV3RuntimeSyncEnabled,
  isRuntimeSyncEnabledForTenant,
  getTenantAllowlist,
};
