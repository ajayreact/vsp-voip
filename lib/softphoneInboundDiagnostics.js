const { normalizeRingGroupMembers } = require('./ringGroup');
const {
  resolveRingTargets,
  resolveEffectiveUserId,
  summarizeTargetsForLog,
} = require('./inboundRouting');
const { loadCredentialConnectionId } = require('./softphone');
const { getCallControlSetupStatus } = require('./telnyxCallControlSetup');
const {
  loadRingGroupForRouting,
  resolveRingGroupEntityTargets,
} = require('./ringGroupRouter');

/**
 * Resolve whether a tenant user can receive inbound PSTN → WebRTC calls.
 * Covers greeting ring group, direct_user, extension assignment, and entity ring groups.
 */
async function resolveSoftphoneInboundRoutingDiagnostics(prisma, tenantId, userId) {
  const [greeting, user, phoneNumbers, connectionId, callControlSetup] = await Promise.all([
    prisma.greeting.findUnique({ where: { tenantId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        telnyxSipUsername: true,
        pushDeviceToken: true,
        pushDevicePlatform: true,
      },
    }),
    prisma.phoneNumber.findMany({
      where: { tenantId, isActive: { not: false } },
      select: {
        id: true,
        number: true,
        routingType: true,
        assignedUserId: true,
        extensionId: true,
        ringGroupId: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    loadCredentialConnectionId(prisma),
    getCallControlSetupStatus(prisma),
  ]);

  const ringMembers = normalizeRingGroupMembers(greeting?.ringGroupMembers);
  const greetingAppMembers = ringMembers.filter((member) => member.type === 'app' && member.userId);
  const userInGreetingRingGroup = greetingAppMembers.some((member) => member.userId === userId);

  const directUserNumbers = phoneNumbers.filter(
    (phone) => phone.routingType === 'direct_user' && phone.assignedUserId === userId,
  );

  const extensionLinkedNumbers = [];
  for (const phone of phoneNumbers) {
    let extension = null;
    if (phone.extensionId) {
      extension = await prisma.extension.findFirst({
        where: { id: phone.extensionId, tenantId, status: 'ACTIVE' },
        select: {
          id: true,
          extensionNumber: true,
          displayName: true,
          userId: true,
        },
      });
    } else if (phone.routingType === 'direct_user' && phone.assignedUserId) {
      extension = await prisma.extension.findFirst({
        where: { tenantId, userId: phone.assignedUserId, status: 'ACTIVE' },
        select: {
          id: true,
          extensionNumber: true,
          displayName: true,
          userId: true,
        },
      });
    }

    const effectiveUserId = resolveEffectiveUserId(extension, phone);
    const userMatchesExtension = effectiveUserId === userId;

    if (userMatchesExtension) {
      extensionLinkedNumbers.push({
        number: phone.number,
        extensionId: extension?.id || null,
        extensionNumber: extension?.extensionNumber || null,
        displayName: extension?.displayName || null,
        extensionUserId: extension?.userId || null,
        assignedUserId: phone.assignedUserId || null,
        effectiveUserId,
      });
    }
  }

  const entityRingGroups = [];
  const seenRingGroupIds = new Set();
  for (const phone of phoneNumbers) {
    if (!phone.ringGroupId || seenRingGroupIds.has(phone.ringGroupId)) continue;

    const ringGroup = await loadRingGroupForRouting(prisma, tenantId, phone.ringGroupId);
    if (!ringGroup) continue;

    seenRingGroupIds.add(phone.ringGroupId);
    const resolved = await resolveRingGroupEntityTargets(prisma, ringGroup, connectionId);
    const appTargets = (resolved?.targets || []).filter((target) => target.type === 'app');
    const userIncludedAsApp = appTargets.some((target) => target.user?.id === userId);

    if (userIncludedAsApp || resolved?.targets?.length) {
      entityRingGroups.push({
        number: phone.number,
        ringGroupId: ringGroup.id,
        ringGroupName: ringGroup.name,
        userIncludedAsApp,
        memberCount: resolved?.orderedMembers?.length || 0,
        appTargetCount: appTargets.length,
      });
    }
  }

  const routingMethods = {
    greetingRingGroup: {
      active: Boolean(greeting?.ringGroupEnabled),
      userIncluded: userInGreetingRingGroup,
      memberCount: ringMembers.length,
      appMemberCount: greetingAppMembers.length,
    },
    directUser: {
      active: directUserNumbers.length > 0,
      numbers: directUserNumbers.map((phone) => phone.number),
    },
    extensionAssignment: {
      active: extensionLinkedNumbers.length > 0,
      assignments: extensionLinkedNumbers,
    },
    entityRingGroup: {
      active: entityRingGroups.length > 0,
      groups: entityRingGroups,
    },
  };

  const hasRoutingPath = Boolean(
    (routingMethods.greetingRingGroup.active && routingMethods.greetingRingGroup.userIncluded)
    || routingMethods.directUser.active
    || routingMethods.extensionAssignment.active
    || routingMethods.entityRingGroup.groups.some((group) => group.userIncludedAsApp),
  );

  const callControlReady = Boolean(
    callControlSetup.webhooksReachable
    && callControlSetup.applicationWebhookConfigured,
  );

  const sipProvisioned = Boolean(user?.telnyxSipUsername);
  const ready = Boolean(callControlReady && hasRoutingPath && sipProvisioned);

  let message = 'Inbound WebRTC routing is configured.';
  if (!callControlSetup.webhooksReachable) {
    message = callControlSetup.message;
  } else if (!callControlSetup.applicationWebhookConfigured) {
    message = callControlSetup.message;
  } else if (!hasRoutingPath) {
    message = 'No inbound routing path targets this user. Add them to a ring group (type: app), assign direct_user routing on a DID, or link an extension with this employee.';
  } else if (!sipProvisioned) {
    message = 'Open the softphone once while logged in to provision WebRTC SIP credentials for inbound calls.';
  }

  const numberTargets = [];
  for (const phone of phoneNumbers) {
    try {
      const extension = phone.extensionId
        ? await prisma.extension.findFirst({
          where: { id: phone.extensionId, tenantId, status: 'ACTIVE' },
          select: { userId: true, extensionNumber: true },
        })
        : null;

      const resolved = await resolveRingTargets(
        prisma,
        tenantId,
        greeting,
        phone,
        connectionId,
      );

      const appTargets = (resolved?.targets || []).filter((target) => target.type === 'app');
      const sipTargets = (resolved?.targets || []).filter((target) => target.type === 'sip');

      numberTargets.push({
        number: phone.number,
        routingType: phone.routingType,
        extensionNumber: extension?.extensionNumber || null,
        extensionUserId: extension?.userId || null,
        assignedUserId: phone.assignedUserId || null,
        effectiveUserId: resolved?.routingDebug?.effectiveUserId
          ?? resolveEffectiveUserId(extension, phone),
        appTargets: resolved?.routingDebug?.appTargets || summarizeTargetsForLog(appTargets),
        sipTargets: resolved?.routingDebug?.sipTargets || summarizeTargetsForLog(sipTargets),
        finalTargets: resolved?.routingDebug?.finalTargets || summarizeTargetsForLog(resolved?.targets),
        targetCount: resolved?.targets?.length || 0,
        appTargetCount: appTargets.length,
        userTargeted: appTargets.some((target) => target.user?.id === userId),
        userHasSipUsername: appTargets.some(
          (target) => target.user?.id === userId && target.user?.telnyxSipUsername,
        ),
      });
    } catch (error) {
      numberTargets.push({
        number: phone.number,
        error: error.message,
      });
    }
  }

  return {
    ready,
    message,
    callControlReady,
    hasRoutingPath,
    sipProvisioned,
    sipUsername: user?.telnyxSipUsername || null,
    webrtcDialUri: user?.telnyxSipUsername
      ? `sip:${user.telnyxSipUsername}@sip.telnyx.com`
      : null,
    routingMethods,
    numberTargets,
    sampleNumberTargets: numberTargets.slice(0, 3),
    pushTokenRegistered: Boolean(user?.pushDeviceToken),
    pushPlatform: user?.pushDevicePlatform || null,
  };
}

module.exports = {
  resolveSoftphoneInboundRoutingDiagnostics,
};
