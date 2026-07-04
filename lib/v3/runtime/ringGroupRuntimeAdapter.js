/**
 * Ring Group Runtime Adapter — V3RingGroup → legacy RingGroup + RingGroupMember.
 */

const { randomUUID } = require('crypto');
const { createRingGroup, updateRingGroup, addRingGroupMember } = require('../../ringGroups');
const runtimeAdapter = require('./runtimeAdapter');

async function syncMembers(prisma, tenantId, ringGroupId, memberExtensionIds) {
  const members = Array.isArray(memberExtensionIds) ? memberExtensionIds : [];
  const existing = await prisma.ringGroupMember.findMany({
    where: { ringGroupId },
    select: { id: true, extensionId: true, isActive: true },
  });
  const existingMap = new Map(existing.map((m) => [m.extensionId, m]));
  const desired = new Set(members);

  for (const extId of members) {
    const ext = await prisma.extension.findFirst({ where: { id: extId, tenantId, status: 'ACTIVE' } });
    if (!ext) continue;
    const found = existingMap.get(extId);
    if (found) {
      if (!found.isActive) {
        await prisma.ringGroupMember.update({ where: { id: found.id }, data: { isActive: true } });
      }
    } else {
      await addRingGroupMember(prisma, tenantId, ringGroupId, { extensionId: extId });
    }
  }

  for (const row of existing) {
    if (!desired.has(row.extensionId) && row.isActive) {
      await prisma.ringGroupMember.update({ where: { id: row.id }, data: { isActive: false } });
    }
  }
}

async function sync(prisma, tenantId, v3EntityId, { action } = {}) {
  const v3 = await prisma.v3RingGroup.findFirst({ where: { id: v3EntityId, tenantId } });
  if (!v3) {
    return { ok: false, skipped: true, reason: 'v3_not_found' };
  }

  const link = await runtimeAdapter.getLink(prisma, tenantId, 'ring_group', v3EntityId);
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
    name: v3.name,
    extensionNumber: v3.extensionNumber,
    ringStrategy: runtimeAdapter.mapV3Strategy(v3.strategy),
    ringTimeoutSeconds: v3.ringTimeoutSeconds,
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

  await syncMembers(prisma, tenantId, runtimeId, v3.memberExtensionIds);
  await runtimeAdapter.upsertLink(prisma, tenantId, {
    v3EntityType: 'ring_group',
    v3EntityId: v3EntityId,
    runtimeEntityType: 'RingGroup',
    runtimeEntityId: runtimeId,
    syncHash,
    metadata: { name: v3.name },
  });

  return { ok: true, runtimeEntityId: runtimeId, syncHash };
}

async function compare(prisma, tenantId, v3EntityId) {
  const v3 = await prisma.v3RingGroup.findFirst({ where: { id: v3EntityId, tenantId, removedAt: null } });
  const link = await runtimeAdapter.getLink(prisma, tenantId, 'ring_group', v3EntityId);
  if (!v3) return { level: 'red', issue: 'missing_v3' };
  if (!link) return { level: 'yellow', issue: 'missing_runtime_link' };
  const runtime = await prisma.ringGroup.findFirst({ where: { id: link.runtimeEntityId, tenantId } });
  if (!runtime || !runtime.isActive) return { level: 'red', issue: 'missing_runtime' };
  if (runtime.name !== v3.name) return { level: 'yellow', issue: 'name_drift' };
  return { level: 'green' };
}

async function repair(prisma, tenantId, v3EntityId) {
  const check = await compare(prisma, tenantId, v3EntityId);
  if (check.level === 'green') return { repaired: false, reason: 'already_synced' };
  const result = await sync(prisma, tenantId, v3EntityId, { action: 'sync' });
  return { repaired: true, result };
}

module.exports = { sync, compare, repair, syncMembers };
