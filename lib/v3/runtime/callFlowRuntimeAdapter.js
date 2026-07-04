/**
 * Call Flow Runtime Adapter — published V3CallFlow → PhoneNumber routing.
 */

const callFlowNodeService = require('../callFlowNodeService');
const runtimeAdapter = require('./runtimeAdapter');

function resolvePublishedDestination(flow) {
  if (!flow || flow.status !== 'PUBLISHED') return null;
  const def = callFlowNodeService.normalizeDefinition(flow.definition);
  const start = def.nodes.find((n) => n.type === 'START');
  if (!start) return null;
  const edge = callFlowNodeService.getOutgoingEdges(def, start.id)[0];
  if (!edge) return null;
  const target = def.nodes.find((n) => n.id === edge.target);
  if (!target) return null;
  return { node: target, did: flow.did };
}

async function sync(prisma, tenantId, v3EntityId, { action } = {}) {
  const v3 = await prisma.v3CallFlow.findFirst({ where: { id: v3EntityId, tenantId } });
  if (!v3) return { ok: false, skipped: true, reason: 'v3_not_found' };

  if (action === 'delete' || v3.removedAt || v3.status !== 'PUBLISHED') {
    return { ok: true, action: 'skipped', reason: 'not_published_or_removed' };
  }

  const dest = resolvePublishedDestination(v3);
  if (!dest?.did) return { ok: true, skipped: true, reason: 'no_did_or_destination' };

  const phone = await prisma.phoneNumber.findFirst({
    where: { tenantId, number: dest.did, isActive: { not: false } },
  });
  if (!phone) return { ok: false, skipped: true, reason: 'did_not_found' };

  const syncHash = runtimeAdapter.hashPayload({ flowId: v3.id, version: v3.version, dest: dest.node.type });
  const patch = { routingType: 'tenant_default', ringGroupId: null, extensionId: null, forwardDestination: null };

  switch (dest.node.type) {
    case 'EXTENSION':
      patch.routingType = 'direct_user';
      patch.extensionId = dest.node.data?.extensionId || null;
      break;
    case 'RING_GROUP': {
      const rgLink = dest.node.data?.ringGroupId
        ? await runtimeAdapter.getLink(prisma, tenantId, 'ring_group', dest.node.data.ringGroupId)
        : null;
      if (rgLink) {
        patch.routingType = 'ring_group';
        patch.ringGroupId = rgLink.runtimeEntityId;
      }
      break;
    }
    case 'FORWARD':
      patch.routingType = 'forward';
      patch.forwardDestination = dest.node.data?.destination || null;
      break;
    default:
      break;
  }

  await prisma.phoneNumber.update({ where: { id: phone.id }, data: patch });
  await runtimeAdapter.upsertLink(prisma, tenantId, {
    v3EntityType: 'call_flow',
    v3EntityId,
    runtimeEntityType: 'PhoneNumber',
    runtimeEntityId: phone.id,
    syncHash,
    metadata: { did: dest.did, nodeType: dest.node.type, version: v3.version },
  });

  return { ok: true, runtimeEntityId: phone.id, syncHash, routing: patch };
}

async function compare(prisma, tenantId, v3EntityId) {
  const v3 = await prisma.v3CallFlow.findFirst({
    where: { id: v3EntityId, tenantId, removedAt: null, status: 'PUBLISHED' },
  });
  if (!v3) return { level: 'yellow', issue: 'not_published' };
  const link = await runtimeAdapter.getLink(prisma, tenantId, 'call_flow', v3EntityId);
  if (!link) return { level: 'yellow', issue: 'missing_runtime_link' };
  if (link.syncHash !== runtimeAdapter.hashPayload({ flowId: v3.id, version: v3.version, dest: resolvePublishedDestination(v3)?.node?.type })) {
    return { level: 'yellow', issue: 'version_drift' };
  }
  return { level: 'green' };
}

async function repair(prisma, tenantId, v3EntityId) {
  return { repaired: true, result: await sync(prisma, tenantId, v3EntityId) };
}

module.exports = { sync, compare, repair, resolvePublishedDestination };
