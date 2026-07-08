/**
 * Issue 1 fix — pilot-tenant scoped ring-first gate for inbound PSTN calls.
 *
 * Root cause: handleCallInitiated() in inboundCallControl.js answers the PSTN leg
 * immediately on call.initiated, before any ring target is dialed. Telnyx's own
 * dialDestination() already dials with bridge_on_answer:true + link_to pointing at
 * the (still unanswered) inbound leg, so Telnyx can natively bridge a parked PSTN
 * leg to the dialed leg once it answers — the eager answerCall() is unnecessary and
 * is what causes the caller to hear silence with the timer running during ringing.
 *
 * This module only decides WHETHER to skip that eager answer, scoped to an opt-in
 * tenant allowlist and to calls where every ring target is a provisioned desk phone
 * (V3DeskDevice), so no other call flow, tenant, or target type is affected.
 */

function parseAllowlist(raw) {
  return new Set(String(raw || '').split(',').map((s) => s.trim()).filter(Boolean));
}

function isDeskOnlyRingFirstPilotTenant(tenantId) {
  if (!tenantId) return false;
  const allowlist = parseAllowlist(process.env.DESK_RING_FIRST_PILOT_TENANT_IDS);
  return allowlist.has(String(tenantId));
}

async function targetHasProvisionedDeskDevice(prisma, tenantId, extensionId) {
  if (!extensionId) return false;
  const device = await prisma.v3DeskDevice.findFirst({
    where: {
      tenantId,
      extensionId,
      removedAt: null,
      status: { in: ['ASSIGNED', 'PROVISIONED', 'REGISTERED'] },
    },
    select: { id: true },
  });
  return Boolean(device);
}

/**
 * @param {object} params
 * @param {object} params.prisma
 * @param {string} params.tenantId
 * @param {Array} params.targets - resolved ring targets for this inbound call
 * @param {boolean} params.businessHoursClosed - true if the tenant greeting is closed
 * @param {string|null} params.extPolicyAction - resolved extension inbound policy action
 * @returns {Promise<boolean>} true if the PSTN answer should be deferred
 */
async function shouldDeferPstnAnswerForPilot({
  prisma,
  tenantId,
  targets,
  businessHoursClosed,
  extPolicyAction,
} = {}) {
  if (!isDeskOnlyRingFirstPilotTenant(tenantId)) return false;
  if (businessHoursClosed) return false;
  // Only the plain ring path is eligible — block/voicemail/forward/screen policies
  // all require an answered leg to play a prompt immediately.
  if (extPolicyAction && extPolicyAction !== 'ring') return false;
  if (!Array.isArray(targets) || targets.length === 0) return false;
  if (!prisma) return false;

  const deskRingTargetTypes = new Set(['app', 'sip']);

  for (const target of targets) {
    if (!deskRingTargetTypes.has(target?.type) || !target.extensionId) return false;
    // eslint-disable-next-line no-await-in-loop
    const isDesk = await targetHasProvisionedDeskDevice(prisma, tenantId, target.extensionId);
    if (!isDesk) return false;
  }

  return true;
}

module.exports = {
  isDeskOnlyRingFirstPilotTenant,
  shouldDeferPstnAnswerForPilot,
};
