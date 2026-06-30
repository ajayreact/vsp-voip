const { getCredentialConnectionId } = require('../telnyxConfig');
const { loadTargetExtension } = require('./DestinationResolver');
const { resolveExtensionRingTargets, hasAppRingTargets } = require('../inboundRouting');
const { handleExtensionOutbound, defaultDeps: extensionDefaultDeps } = require('./ExtensionCallService');
const { logDeskOutboundRoute } = require('./deskOutboundLogger');

function getLoadRingGroupByExtensionNumber() {
  return require('../ringGroupRouter').loadRingGroupByExtensionNumber;
}

const defaultDeps = {
  loadTargetExtension,
  loadRingGroupByExtensionNumber: (...args) => getLoadRingGroupByExtensionNumber()(...args),
  resolveExtensionRingTargets,
  hasAppRingTargets,
  handleExtensionOutbound,
  extensionDeps: extensionDefaultDeps,
};

/**
 * Desk → mobile outbound (V2 orchestration — extension destination with app ring targets).
 * Delegates to ExtensionCallService / existing extension ring flow; no separate dial path.
 *
 * @returns {boolean|null} true/false when handled; null → not a mobile destination (legacy/extension V2)
 */
async function handleMobileOutbound(ctx, deps = defaultDeps) {
  const {
    prisma,
    platform,
    caller,
    destination,
  } = ctx;

  const extensionNumber = destination?.extensionNumber;
  const callControlId = ctx.payload?.call_control_id;

  if (!caller?.tenantId) {
    logDeskOutboundRoute({
      version: 'V2',
      destination: 'MOBILE',
      result: 'skipped',
      reason: 'caller_not_resolved',
      callControlId: callControlId || null,
      extension: extensionNumber ?? null,
    });
    return false;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: caller.tenantId } });
  if (!tenant) {
    logDeskOutboundRoute({
      version: 'V2',
      destination: 'MOBILE',
      result: 'skipped',
      reason: 'tenant_not_found',
      callControlId: callControlId || null,
      tenantId: caller.tenantId,
      extension: extensionNumber ?? null,
    });
    return false;
  }

  const targetExtension = await deps.loadTargetExtension(prisma, tenant.id, extensionNumber);
  if (!targetExtension) {
    const ringGroup = await deps.loadRingGroupByExtensionNumber(
      prisma,
      tenant.id,
      extensionNumber,
    );
    if (ringGroup) {
      return null;
    }
    return null;
  }

  const credentialConnectionId = getCredentialConnectionId(platform);
  const resolution = await deps.resolveExtensionRingTargets(
    prisma,
    targetExtension,
    credentialConnectionId,
  );

  if (!deps.hasAppRingTargets(resolution?.targets || [])) {
    return null;
  }

  logDeskOutboundRoute({
    version: 'V2',
    destination: 'MOBILE',
    phase: 'route_selected',
    callControlId,
    tenantId: tenant.id,
    extension: extensionNumber,
    targetExtensionId: targetExtension.id,
    ringTargetCount: resolution.targets.length,
  });

  return deps.handleExtensionOutbound(
    { ...ctx, skipMobileGate: true },
    deps.extensionDeps,
  );
}

module.exports = {
  handleMobileOutbound,
  defaultDeps,
};
