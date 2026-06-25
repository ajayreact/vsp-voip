const { mapVoicemailRecord } = require('./voicemail');
const { normalizeRingGroupMembers } = require('./ringGroup');
const { resolveRingGroupEntityTargets } = require('./ringGroupRouter');

const VALID_STRATEGIES = new Set(['SIMULTANEOUS', 'SEQUENTIAL', 'ROUND_ROBIN', 'LONGEST_IDLE']);

const RING_GROUP_INCLUDE = {
  members: {
    where: { isActive: true },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    include: {
      extension: {
        select: {
          id: true,
          extensionNumber: true,
          displayName: true,
          status: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              telnyxSipUsername: true,
              sipRegistered: true,
              softphoneOnlineAt: true,
            },
          },
        },
      },
    },
  },
  phoneNumbers: {
    select: { id: true, number: true, label: true },
  },
  _count: {
    select: { voicemails: true },
  },
};

function normalizeStrategy(value) {
  const strategy = String(value || 'SIMULTANEOUS').toUpperCase();
  if (!VALID_STRATEGIES.has(strategy)) {
    throw Object.assign(new Error('ringStrategy must be SIMULTANEOUS, SEQUENTIAL, ROUND_ROBIN, or LONGEST_IDLE'), { status: 400 });
  }
  return strategy;
}

function clampTimeout(value) {
  const timeout = Number(value);
  if (!Number.isFinite(timeout)) return 25;
  return Math.min(Math.max(Math.round(timeout), 10), 60);
}

const { normalizeExtensionNumber: normalizeStrictExtensionNumber } = require('./extensionNumber');

function normalizeExtensionNumber(value) {
  if (value == null || value === '') return null;
  return normalizeStrictExtensionNumber(value);
}

function serializeMember(member) {
  const ext = member.extension;
  return {
    id: member.id,
    ringGroupId: member.ringGroupId,
    extensionId: member.extensionId,
    priority: member.priority,
    isActive: member.isActive,
    lastAnsweredAt: member.lastAnsweredAt,
    lastRungAt: member.lastRungAt,
    extension: ext
      ? {
        id: ext.id,
        extensionNumber: ext.extensionNumber,
        displayName: ext.displayName,
        status: ext.status,
        user: ext.user
          ? {
            id: ext.user.id,
            name: ext.user.name,
            email: ext.user.email,
            hasSipCredential: Boolean(ext.user.telnyxSipUsername),
            sipRegistered: ext.user.sipRegistered,
          }
          : null,
      }
      : null,
  };
}

function serializeRingGroup(row, { includeMembers = true } = {}) {
  const payload = {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    extensionNumber: row.extensionNumber,
    ringStrategy: row.ringStrategy,
    ringTimeoutSeconds: row.ringTimeoutSeconds,
    roundRobinPointer: row.roundRobinPointer,
    voicemailEnabled: row.voicemailEnabled,
    voicemailGreetingUrl: row.voicemailGreetingUrl,
    callRecordingEnabled: row.callRecordingEnabled,
    isActive: row.isActive,
    memberCount: row._count?.members ?? row.members?.length ?? 0,
    voicemailCount: row._count?.voicemails ?? 0,
    phoneNumbers: row.phoneNumbers?.map((n) => ({
      id: n.id,
      number: n.number,
      label: n.label,
    })) ?? [],
    analytics: {
      callsOffered: row.callsOffered ?? 0,
      callsAnswered: row.callsAnswered ?? 0,
      callsMissed: row.callsMissed ?? 0,
      averageAnswerTimeSeconds: row.callsAnswered > 0
        ? Math.round((row.totalAnswerTimeMs || 0) / row.callsAnswered / 1000)
        : 0,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  if (includeMembers && row.members) {
    payload.members = row.members.map(serializeMember);
  }

  return payload;
}

async function listRingGroups(prisma, tenantId) {
  const rows = await prisma.ringGroup.findMany({
    where: { tenantId },
    include: {
      members: { where: { isActive: true }, select: { id: true } },
      phoneNumbers: { select: { id: true, number: true, label: true } },
      _count: { select: { voicemails: true, members: true } },
    },
    orderBy: { name: 'asc' },
  });

  return rows.map((row) => serializeRingGroup(row, { includeMembers: false }));
}

async function getRingGroupDetail(prisma, tenantId, ringGroupId) {
  const row = await prisma.ringGroup.findFirst({
    where: { id: ringGroupId, tenantId },
    include: RING_GROUP_INCLUDE,
  });
  if (!row) throw Object.assign(new Error('Ring group not found'), { status: 404 });
  return serializeRingGroup(row);
}

async function createRingGroup(prisma, tenantId, body) {
  const name = String(body.name || '').trim();
  if (!name) throw Object.assign(new Error('name is required'), { status: 400 });

  const extensionNumber = body.extensionNumber != null
    ? normalizeExtensionNumber(body.extensionNumber)
    : null;

  const data = {
    tenantId,
    name,
    extensionNumber,
    ringStrategy: body.ringStrategy ? normalizeStrategy(body.ringStrategy) : 'SIMULTANEOUS',
    ringTimeoutSeconds: clampTimeout(body.ringTimeoutSeconds),
    voicemailEnabled: body.voicemailEnabled !== false,
    voicemailGreetingUrl: body.voicemailGreetingUrl || null,
    callRecordingEnabled: body.callRecordingEnabled !== false,
    isActive: body.isActive !== false,
  };

  const created = await prisma.ringGroup.create({
    data,
    include: RING_GROUP_INCLUDE,
  });

  return serializeRingGroup(created);
}

async function updateRingGroup(prisma, tenantId, ringGroupId, body) {
  const existing = await prisma.ringGroup.findFirst({ where: { id: ringGroupId, tenantId } });
  if (!existing) throw Object.assign(new Error('Ring group not found'), { status: 404 });

  const data = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw Object.assign(new Error('name cannot be empty'), { status: 400 });
    data.name = name;
  }
  if (body.extensionNumber !== undefined) {
    data.extensionNumber = body.extensionNumber ? normalizeExtensionNumber(body.extensionNumber) : null;
  }
  if (body.ringStrategy !== undefined) data.ringStrategy = normalizeStrategy(body.ringStrategy);
  if (body.ringTimeoutSeconds !== undefined) data.ringTimeoutSeconds = clampTimeout(body.ringTimeoutSeconds);
  if (body.voicemailEnabled !== undefined) data.voicemailEnabled = Boolean(body.voicemailEnabled);
  if (body.voicemailGreetingUrl !== undefined) data.voicemailGreetingUrl = body.voicemailGreetingUrl || null;
  if (body.callRecordingEnabled !== undefined) data.callRecordingEnabled = Boolean(body.callRecordingEnabled);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const updated = await prisma.ringGroup.update({
    where: { id: ringGroupId },
    data,
    include: RING_GROUP_INCLUDE,
  });

  return serializeRingGroup(updated);
}

async function deleteRingGroup(prisma, tenantId, ringGroupId) {
  const existing = await prisma.ringGroup.findFirst({ where: { id: ringGroupId, tenantId } });
  if (!existing) throw Object.assign(new Error('Ring group not found'), { status: 404 });

  await prisma.phoneNumber.updateMany({
    where: { ringGroupId },
    data: { ringGroupId: null, routingType: 'tenant_default' },
  });

  await prisma.ringGroup.update({
    where: { id: ringGroupId },
    data: { isActive: false },
  });

  return { deleted: true };
}

async function addRingGroupMember(prisma, tenantId, ringGroupId, body) {
  const group = await prisma.ringGroup.findFirst({ where: { id: ringGroupId, tenantId } });
  if (!group) throw Object.assign(new Error('Ring group not found'), { status: 404 });

  const extensionId = String(body.extensionId || '').trim();
  if (!extensionId) throw Object.assign(new Error('extensionId is required'), { status: 400 });

  const extension = await prisma.extension.findFirst({
    where: { id: extensionId, tenantId, status: 'ACTIVE' },
  });
  if (!extension) throw Object.assign(new Error('Extension not found or inactive'), { status: 400 });

  const priority = body.priority != null ? Number(body.priority) : undefined;

  const member = await prisma.ringGroupMember.upsert({
    where: {
      ringGroupId_extensionId: { ringGroupId, extensionId },
    },
    create: {
      ringGroupId,
      extensionId,
      priority: Number.isFinite(priority) ? Math.round(priority) : 0,
      isActive: true,
    },
    update: {
      isActive: true,
      ...(Number.isFinite(priority) ? { priority: Math.round(priority) } : {}),
    },
    include: {
      extension: {
        select: {
          id: true,
          extensionNumber: true,
          displayName: true,
          status: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              telnyxSipUsername: true,
              sipRegistered: true,
            },
          },
        },
      },
    },
  });

  return serializeMember(member);
}

async function removeRingGroupMember(prisma, tenantId, ringGroupId, memberId) {
  const group = await prisma.ringGroup.findFirst({ where: { id: ringGroupId, tenantId } });
  if (!group) throw Object.assign(new Error('Ring group not found'), { status: 404 });

  const member = await prisma.ringGroupMember.findFirst({
    where: { id: memberId, ringGroupId },
  });
  if (!member) throw Object.assign(new Error('Member not found'), { status: 404 });

  await prisma.ringGroupMember.update({
    where: { id: memberId },
    data: { isActive: false },
  });

  return { removed: true };
}

async function reorderRingGroupMembers(prisma, tenantId, ringGroupId, memberIds) {
  const group = await prisma.ringGroup.findFirst({ where: { id: ringGroupId, tenantId } });
  if (!group) throw Object.assign(new Error('Ring group not found'), { status: 404 });

  if (!Array.isArray(memberIds)) {
    throw Object.assign(new Error('memberIds array is required'), { status: 400 });
  }

  await prisma.$transaction(
    memberIds.map((id, index) =>
      prisma.ringGroupMember.updateMany({
        where: { id: String(id), ringGroupId },
        data: { priority: index },
      })),
  );

  return getRingGroupDetail(prisma, tenantId, ringGroupId);
}

async function assignPhoneNumberToRingGroup(prisma, tenantId, phoneNumberId, ringGroupId) {
  const phone = await prisma.phoneNumber.findFirst({ where: { id: phoneNumberId, tenantId } });
  if (!phone) throw Object.assign(new Error('Phone number not found'), { status: 404 });

  if (ringGroupId) {
    const group = await prisma.ringGroup.findFirst({ where: { id: ringGroupId, tenantId, isActive: true } });
    if (!group) throw Object.assign(new Error('Ring group not found'), { status: 404 });
  }

  const updated = await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: {
      ringGroupId: ringGroupId || null,
      routingType: ringGroupId ? 'ring_group' : phone.routingType,
    },
  });

  return updated;
}

async function listRingGroupVoicemails(prisma, tenantId, ringGroupId, limit = 50) {
  const group = await prisma.ringGroup.findFirst({ where: { id: ringGroupId, tenantId } });
  if (!group) throw Object.assign(new Error('Ring group not found'), { status: 404 });

  const rows = await prisma.voicemail.findMany({
    where: { tenantId, ringGroupId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });

  return rows.map((row) => ({
    ...mapVoicemailRecord(row),
    ringGroupId: row.ringGroupId,
  }));
}

async function getRingGroupAnalytics(prisma, tenantId, ringGroupId) {
  const group = await prisma.ringGroup.findFirst({ where: { id: ringGroupId, tenantId } });
  if (!group) throw Object.assign(new Error('Ring group not found'), { status: 404 });

  return {
    callsOffered: group.callsOffered,
    callsAnswered: group.callsAnswered,
    callsMissed: group.callsMissed,
    averageAnswerTimeSeconds: group.callsAnswered > 0
      ? Math.round(group.totalAnswerTimeMs / group.callsAnswered / 1000)
      : 0,
    answerRatePercent: group.callsOffered > 0
      ? Math.round((group.callsAnswered / group.callsOffered) * 100)
      : 0,
  };
}

async function recordRingGroupOffered(prisma, ringGroupId, callSid) {
  if (!ringGroupId) return;
  const offeredAt = new Date();
  await prisma.ringGroup.update({
    where: { id: ringGroupId },
    data: { callsOffered: { increment: 1 } },
  });
  if (callSid) {
    await prisma.callLog.updateMany({
      where: { callSid },
      data: { ringGroupId, offeredAt },
    });
  }
}

async function recordRingGroupAnswered(prisma, session, memberId) {
  const ringGroupId = session?.ringGroupId;
  if (!ringGroupId) return;

  const offeredAt = session.ringGroupOfferedAt ? new Date(session.ringGroupOfferedAt).getTime() : null;
  const answerTimeMs = offeredAt ? Math.max(0, Date.now() - offeredAt) : 0;

  await prisma.ringGroup.update({
    where: { id: ringGroupId },
    data: {
      callsAnswered: { increment: 1 },
      totalAnswerTimeMs: { increment: answerTimeMs },
      ...(session.ringGroup?.ringStrategy === 'ROUND_ROBIN'
        ? { roundRobinPointer: { increment: 1 } }
        : {}),
    },
  });

  if (memberId) {
    await prisma.ringGroupMember.update({
      where: { id: memberId },
      data: { lastAnsweredAt: new Date() },
    });
  }

  if (session.callSessionId) {
    await prisma.callLog.updateMany({
      where: { callSid: session.callSessionId },
      data: { ringGroupId, answeredAt: new Date(), status: 'completed', callType: 'answered' },
    });
  }
}

async function recordRingGroupMissed(prisma, ringGroupId, callSid) {
  if (!ringGroupId) return;
  await prisma.ringGroup.update({
    where: { id: ringGroupId },
    data: { callsMissed: { increment: 1 } },
  });
  if (callSid) {
    await prisma.callLog.updateMany({
      where: { callSid },
      data: { ringGroupId, status: 'missed', callType: 'missed' },
    });
  }
}

async function markMembersRung(prisma, memberIds) {
  if (!memberIds?.length) return;
  await prisma.ringGroupMember.updateMany({
    where: { id: { in: memberIds } },
    data: { lastRungAt: new Date() },
  });
}

async function migrateLegacyGreetingRingGroup(prisma, tenantId) {
  const greeting = await prisma.greeting.findUnique({ where: { tenantId } });
  if (!greeting?.ringGroupEnabled) return null;

  const existing = await prisma.ringGroup.findFirst({
    where: { tenantId, name: greeting.ringGroupName || 'Main ring group' },
  });
  if (existing) return existing;

  const members = normalizeRingGroupMembers(greeting.ringGroupMembers);
  const strategyMap = {
    simultaneous: 'SIMULTANEOUS',
    sequential: 'SEQUENTIAL',
  };
  const ringStrategy = strategyMap[String(greeting.ringStrategy || '').toLowerCase()] || 'SIMULTANEOUS';

  const group = await prisma.ringGroup.create({
    data: {
      tenantId,
      name: greeting.ringGroupName || 'Main ring group',
      ringStrategy,
      ringTimeoutSeconds: greeting.ringTimeout || 25,
      voicemailEnabled: greeting.voicemailEnabled !== false,
      callRecordingEnabled: greeting.callRecordingEnabled !== false,
    },
  });

  for (let i = 0; i < members.length; i += 1) {
    const member = members[i];
    if (member.type === 'app' && member.userId) {
      const ext = await prisma.extension.findFirst({
        where: { tenantId, userId: member.userId },
      });
      if (ext) {
        await prisma.ringGroupMember.create({
          data: {
            ringGroupId: group.id,
            extensionId: ext.id,
            priority: i,
          },
        });
      }
    }
  }

  return group;
}

async function listRingGroupDestinations(prisma, tenantId) {
  const groups = await prisma.ringGroup.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true, extensionNumber: true },
    orderBy: { name: 'asc' },
  });
  return groups;
}

async function simulateRingGroupRouting(prisma, tenantId, ringGroupId, credentialConnectionId) {
  const group = await prisma.ringGroup.findFirst({ where: { id: ringGroupId, tenantId } });
  if (!group) throw Object.assign(new Error('Ring group not found'), { status: 404 });
  return resolveRingGroupEntityTargets(prisma, group, credentialConnectionId);
}

module.exports = {
  listRingGroups,
  getRingGroupDetail,
  createRingGroup,
  updateRingGroup,
  deleteRingGroup,
  addRingGroupMember,
  removeRingGroupMember,
  reorderRingGroupMembers,
  assignPhoneNumberToRingGroup,
  listRingGroupVoicemails,
  getRingGroupAnalytics,
  recordRingGroupOffered,
  recordRingGroupAnswered,
  recordRingGroupMissed,
  markMembersRung,
  migrateLegacyGreetingRingGroup,
  listRingGroupDestinations,
  simulateRingGroupRouting,
  serializeRingGroup,
};
