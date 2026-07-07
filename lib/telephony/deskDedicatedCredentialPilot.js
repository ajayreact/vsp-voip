/**
 * Symplore pilot — dedicated Telnyx SIP credential per desk phone.
 *
 * Root cause (confirmed with runtime evidence): Phase 2.4a made desk phones and the
 * assigned employee's mobile/softphone app share ONE Telnyx telephony credential
 * (see lib/extensionSip.js, lib/employeeTelephony.js). Telnyx credential connections
 * only keep one device actively registered per credential at a time — whichever
 * device registers most recently wins the slot, and the other device silently
 * becomes "Not Registered" (Telnyx Help Center: "Register multiple devices on one
 * Connection"). That is what caused Symplore's physical desk phones to show
 * "Not Registered" in the office while the employee's mobile/softphone app stayed
 * registered elsewhere.
 *
 * This module scopes the fix (a dedicated desk credential, independent from the
 * employee's app credential) to an opt-in tenant allowlist, so provisioning and ring
 * routing for every other tenant is completely unaffected.
 */

function parseAllowlist(raw) {
  return new Set(String(raw || '').split(',').map((s) => s.trim()).filter(Boolean));
}

function isDedicatedDeskCredentialPilotTenant(tenantId) {
  if (!tenantId) return false;
  const allowlist = parseAllowlist(process.env.DESK_DEDICATED_CREDENTIAL_PILOT_TENANT_IDS);
  return allowlist.has(String(tenantId));
}

module.exports = {
  isDedicatedDeskCredentialPilotTenant,
};
