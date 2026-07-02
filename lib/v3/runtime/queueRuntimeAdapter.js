/**
 * Queue Runtime Adapter — V3Queue → legacy RingGroup (queue agents via RingGroupMember).
 */

const { createRingGroup, updateRingGroup } = require('../../ringGroups');
const ringGroupRuntimeAdapter = require('./ringGroupRuntimeAdapter');
const runtimeAdapter = require('./runtimeAdapter');

function queueRuntimeName(v3) {
  return `V3 Queue: ${v3.name}`;
}

async function sync(prisma, tenantId, v3EntityId, { action } = {}) {
  const v3 = await prisma.v3Queue.findFirst({ where: { id: v3EntityId, tenantId } });
  if (!v3) return { ok: false, skipped: true, reason: 'v3_not_found' };

  const link = await runtimeAdapter.getLink(prisma, tenantId, 'queue', v3EntityId);
  const syncHash = runtimeAdapter.hashPayload(v3);

  if (action === 'delete' || v3.removedAt || !v3.isActive) {
    if (link) {
      await prisma.ringGroup.update({
        where: { id: link.runtimeEntityId },
        data: { isActive: false },
      }).catch(() => null);
    }
    return { ok: true, action: 'deactivated', runtimeEntityId: link?.runtimeEntityId || null };
  }

  const body = {
    name: queueRuntimeName(v3),
    extensionNumber: v3.queueNumber,
    ringStrategy: runtimeAdapter.mapV3Strategy(v3.strategy),
    ringTimeoutSeconds: v3.queueTimeoutSeconds,
    isActive: true,
  };

  let runtimeId;
  if (link) {
    const updated = await updateRingGroup(prisma, tenantId, link.runtimeEntityId, body);
    runtimeId = updated.id;
  } else {
    const created = await createRingGroup(prisma, tenantId, body);
    runtimeId = created.id;
  }

  await ringGroupRuntimeAdapter.syncMembers(prisma, tenantId, runtimeId, v3.agentExtensionIds);
  await runtimeAdapter.upsertLink(prisma, tenantId, {
    v3EntityType: 'queue',
    v3EntityId,
    runtimeEntityType: 'RingGroup',
    runtimeEntityId: runtimeId,
    syncHash,
    metadata: { name: v3.name, queue: true },
  });

  return { ok: true, runtimeEntityId: runtimeId, syncHash };
}

async function compare(prisma, tenantId, v3EntityId) {
  const v3 = await prisma.v3Queue.findFirst({ where: { id: v3EntityId, tenantId, removedAt: null } });
  const link = await runtimeAdapter.getLink(prisma, tenantId, 'queue', v3EntityId);
  if (!v3) return { level: 'red', issue: 'missing_v3' };
  if (!link) return { level: 'yellow', issue: 'missing_runtime_link' };
  const runtime = await prisma.ringGroup.findFirst({ where: { id: link.runtimeEntityId, tenantId, isActive: true } });
  if (!runtime) return { level: 'red', issue: 'missing_runtime' };
  return { level: 'green' };
}

async function repair(prisma, tenantId, v3EntityId) {
  const check = await compare(prisma, tenantId, v3EntityId);
  if (check.level === 'green') return { repaired: false, reason: 'already_synced' };
  return { repaired: true, result: await sync(prisma, tenantId, v3EntityId) };
}

module.exports = { sync, compare, repair };
