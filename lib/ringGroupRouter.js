const { clampRingTimeout } = require('./ringGroup');

const ENGINE_STRATEGIES = new Set(['simultaneous', 'sequential']);

function normalizeEngineStrategy(ringStrategy) {
  const value = String(ringStrategy || 'SIMULTANEOUS').toUpperCase();
  if (value === 'SIMULTANEOUS') return 'simultaneous';
  return 'sequential';
}

function rotateMembers(members, pointer) {
  if (!members.length) return [];
  const start = ((Number(pointer) || 0) % members.length + members.length) % members.length;
  return [...members.slice(start), ...members.slice(0, start)];
}

function sortByLongestIdle(members) {
  return [...members].sort((a, b) => {
    const aTime = a.lastAnsweredAt ? new Date(a.lastAnsweredAt).getTime() : 0;
    const bTime = b.lastAnsweredAt ? new Date(b.lastAnsweredAt).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.priority - b.priority;
  });
}

function orderMembersForStrategy(members, ringStrategy, roundRobinPointer) {
  const active = members
    .filter((m) => m.isActive !== false)
    .sort((a, b) => a.priority - b.priority);

  const strategy = String(ringStrategy || 'SIMULTANEOUS').toUpperCase();
  if (strategy === 'LONGEST_IDLE') return sortByLongestIdle(active);
  if (strategy === 'ROUND_ROBIN') return rotateMembers(active, roundRobinPointer);
  return active;
}

async function resolveRingGroupEntityTargets(prisma, ringGroup, credentialConnectionId) {
  if (!ringGroup?.isActive) {
    return { targets: [], ringTimeout: 25, strategy: 'sequential', ringGroup: null, orderedMembers: [] };
  }

  const { resolveExtensionRingTargets } = require('./inboundRouting');

  const members = await prisma.ringGroupMember.findMany({
    where: { ringGroupId: ringGroup.id, isActive: true },
    include: {
      extension: {
        include: {
          user: true,
        },
      },
    },
  });

  const orderedMembers = orderMembersForStrategy(
    members,
    ringGroup.ringStrategy,
    ringGroup.roundRobinPointer,
  );

  const targets = [];
  for (const member of orderedMembers) {
    const extension = member.extension;
    if (!extension || extension.status !== 'ACTIVE') continue;

    const resolution = await resolveExtensionRingTargets(
      prisma,
      extension,
      credentialConnectionId,
    );
    if (!resolution?.targets?.length) continue;

    for (const target of resolution.targets) {
      targets.push({
        ...target,
        extensionId: extension.id,
        memberId: member.id,
      });
    }
  }

  const ringTimeout = clampRingTimeout(ringGroup.ringTimeoutSeconds);
  const engineStrategy = normalizeEngineStrategy(ringGroup.ringStrategy);
  const effectiveTimeout = targets.length > 0 ? Math.max(ringTimeout, 35) : ringTimeout;

  return {
    targets,
    ringTimeout: effectiveTimeout,
    strategy: engineStrategy,
    ringGroup,
    orderedMembers,
  };
}

async function loadRingGroupForRouting(prisma, tenantId, ringGroupId) {
  if (!ringGroupId) return null;
  return prisma.ringGroup.findFirst({
    where: { id: ringGroupId, tenantId, isActive: true },
  });
}

async function loadRingGroupByExtensionNumber(prisma, tenantId, extensionNumber) {
  if (!extensionNumber) return null;
  return prisma.ringGroup.findFirst({
    where: { tenantId, extensionNumber: String(extensionNumber), isActive: true },
  });
}

module.exports = {
  ENGINE_STRATEGIES,
  normalizeEngineStrategy,
  orderMembersForStrategy,
  resolveRingGroupEntityTargets,
  loadRingGroupForRouting,
  loadRingGroupByExtensionNumber,
};
