const { normalizePhoneNumber } = require('./phone');

const {

  normalizeRingGroupMembers,

  normalizeRingStrategy,

  clampRingTimeout,

} = require('./ringGroup');

const {

  resolveRingGroupEntityTargets,

  loadRingGroupForRouting,

} = require('./ringGroupRouter');



function hasAppRingMembers(greeting, phoneRecord) {

  if (phoneRecord?.routingType === 'direct_user' && phoneRecord.assignedUserId) {

    return true;

  }

  if (phoneRecord?.extensionId) {

    return true;

  }

  if (phoneRecord?.ringGroupId) {

    return true;

  }

  if (!greeting?.ringGroupEnabled) return false;

  return normalizeRingGroupMembers(greeting.ringGroupMembers)

    .some((member) => member.type === 'app' && member.userId);

}



function requiresCallControlRouting(greeting, phoneRecord) {

  return hasAppRingMembers(greeting, phoneRecord);

}



function hasAppRingTargets(targets) {

  return Array.isArray(targets) && targets.some((target) => target.type === 'app');

}



async function ensureAppUserDialReady(prisma, user, connectionId) {

  if (!user || !connectionId) return user;

  if (user.telnyxSipUsername) return user;



  try {

    const { getOrCreateUserTelephonyCredential } = require('./softphone');

    await getOrCreateUserTelephonyCredential({

      prisma,

      userId: user.id,

      tenantId: user.tenantId,

      connectionId,

    });

    return prisma.user.findUnique({ where: { id: user.id } });

  } catch (error) {

    console.warn(`   ↳ Could not provision SIP credential for ${user.email}: ${error.message}`);

    return user;

  }

}



async function resolveEntityRingGroup(prisma, tenantId, phoneRecord, credentialConnectionId) {

  const ringGroupId = phoneRecord?.ringGroupId;

  if (!ringGroupId) return null;



  const ringGroup = await loadRingGroupForRouting(prisma, tenantId, ringGroupId);

  if (!ringGroup) return null;



  const resolved = await resolveRingGroupEntityTargets(prisma, ringGroup, credentialConnectionId);

  return {

    ...resolved,

    ringGroupId: ringGroup.id,

  };

}



async function resolveExtensionForPhoneRecord(prisma, tenantId, phoneRecord) {
  if (!phoneRecord) return null;

  if (phoneRecord.extensionId) {
    return prisma.extension.findFirst({
      where: { id: phoneRecord.extensionId, tenantId, status: 'ACTIVE' },
      include: { user: true },
    });
  }

  if (phoneRecord.assignedUserId) {
    return prisma.extension.findFirst({
      where: { tenantId, userId: phoneRecord.assignedUserId, status: 'ACTIVE' },
      include: { user: true },
    });
  }

  return null;
}

async function resolveExtensionRingTargets(prisma, extension, credentialConnectionId) {
  if (!extension?.id) return null;

  let ext = extension;

  if (ext.sipEnabled !== false && !ext.telnyxSipUsername) {
    try {
      const { ensureExtensionTelnyxCredential } = require('./extensionSip');
      ext = await ensureExtensionTelnyxCredential(prisma, ext);
    } catch (error) {
      console.warn(`   ↳ Could not provision desk credential for extension ${ext.extensionNumber}: ${error.message}`);
    }
  }

  const deskTargets = [];
  const appTargets = [];

  if (ext.sipEnabled !== false && ext.telnyxSipUsername) {
    deskTargets.push({
      type: 'sip',
      sipUsername: ext.telnyxSipUsername,
      extensionId: ext.id,
      label: ext.displayName || `Extension ${ext.extensionNumber}`,
    });
  }

  if (ext.userId) {
    let user = ext.user;
    if (!user) {
      user = await prisma.user.findUnique({ where: { id: ext.userId } });
    }
    user = await ensureAppUserDialReady(prisma, user, credentialConnectionId);
    if (user?.telnyxSipUsername) {
      appTargets.push({
        type: 'app',
        user,
        extensionId: ext.id,
        label: user.name,
      });
    }
  }

  const targets = [...deskTargets, ...appTargets];
  const ringTimeout = 25;
  const multiDevice = ext.multiDeviceEnabled !== false;
  const strategy = multiDevice && targets.length > 1 ? 'simultaneous' : 'sequential';

  return {
    targets,
    ringTimeout,
    strategy,
    extensionId: ext.id,
  };
}

async function resolveDirectUserRingTargets(prisma, phoneRecord, credentialConnectionId) {
  let userId = phoneRecord?.assignedUserId || null;

  if (phoneRecord?.extensionId) {
    const extension = await prisma.extension.findFirst({
      where: { id: phoneRecord.extensionId, status: 'ACTIVE' },
      select: { userId: true },
    });
    if (extension?.userId) userId = extension.userId;
  }

  if (!userId) return null;

  let user = await prisma.user.findUnique({ where: { id: userId } });
  user = await ensureAppUserDialReady(prisma, user, credentialConnectionId);
  if (!user?.telnyxSipUsername) return { targets: [], ringTimeout: 25, strategy: 'sequential' };

  return {
    targets: [{ type: 'app', user, label: user.name }],
    ringTimeout: 25,
    strategy: 'sequential',
  };
}

async function resolveRingTargets(prisma, tenantId, greeting, phoneRecord, credentialConnectionId) {

  const ringTimeout = clampRingTimeout(greeting?.ringTimeout);

  const targets = [];



  if (phoneRecord?.extensionId || (phoneRecord?.routingType === 'direct_user' && phoneRecord.assignedUserId)) {
    const extension = await resolveExtensionForPhoneRecord(prisma, tenantId, phoneRecord);
    if (extension) {
      const direct = await resolveExtensionRingTargets(prisma, extension, credentialConnectionId);
      if (direct) return direct;
    }

    const legacy = await resolveDirectUserRingTargets(prisma, phoneRecord, credentialConnectionId);
    if (legacy) return legacy;
  }



  const entityGroup = await resolveEntityRingGroup(prisma, tenantId, phoneRecord, credentialConnectionId);

  if (entityGroup) {

    return {

      targets: entityGroup.targets,

      ringTimeout: entityGroup.ringTimeout,

      strategy: entityGroup.strategy,

      ringGroup: entityGroup.ringGroup,

      ringGroupId: entityGroup.ringGroupId,

      orderedMembers: entityGroup.orderedMembers,

    };

  }



  if (phoneRecord?.routingType === 'ring_group' && phoneRecord?.ringGroupId) {

    return { targets: [], ringTimeout, strategy: 'sequential', ringGroupId: phoneRecord.ringGroupId };

  }



  if (greeting?.ringGroupEnabled) {

    const members = normalizeRingGroupMembers(greeting.ringGroupMembers);

    const strategy = normalizeRingStrategy(greeting.ringStrategy);

    const appUserIds = members.filter((m) => m.type === 'app' && m.userId).map((m) => m.userId);



    let appUsers = appUserIds.length

      ? await prisma.user.findMany({

        where: {

          tenantId,

          id: { in: appUserIds },

        },

      })

      : [];



    if (credentialConnectionId && appUsers.length) {

      appUsers = await Promise.all(

        appUsers.map((user) => ensureAppUserDialReady(prisma, user, credentialConnectionId)),

      );

    }



    for (const member of members) {

      if (member.type === 'app' && member.userId) {

        const user = appUsers.find((item) => item.id === member.userId);

        if (user?.telnyxSipUsername) {

          targets.push({ type: 'app', user, label: member.label || user.name });

        }

      } else if (member.phone) {

        targets.push({ type: 'phone', phone: member.phone, label: member.label });

      }

    }



    const appTargetCount = targets.filter((t) => t.type === 'app').length;

    const effectiveTimeout = appTargetCount > 0

      ? Math.max(ringTimeout, 35)

      : ringTimeout;



    return { targets, ringTimeout: effectiveTimeout, strategy };

  }



  if (greeting?.forwardEnabled && greeting.forwardNumber) {

    const phone = normalizePhoneNumber(greeting.forwardNumber);

    if (phone) {

      targets.push({ type: 'phone', phone, label: 'Forward' });

    }

  }



  return { targets, ringTimeout, strategy: 'sequential' };

}



function hasSipRingTargets(targets) {
  return Array.isArray(targets) && targets.some((target) => target.type === 'sip');
}

function formatTargetDialTo(target) {
  const { formatWebRtcDialTo } = require('./telnyxCallControl');
  if (target.type === 'app') {
    return formatWebRtcDialTo(target.user?.telnyxSipUsername);
  }
  if (target.type === 'sip') {
    return formatWebRtcDialTo(target.sipUsername);
  }
  return target.phone || null;
}

module.exports = {

  hasAppRingMembers,

  requiresCallControlRouting,

  hasAppRingTargets,

  hasSipRingTargets,

  resolveRingTargets,

  resolveExtensionForPhoneRecord,

  resolveExtensionRingTargets,

  resolveDirectUserRingTargets,

  ensureAppUserDialReady,

  resolveEntityRingGroup,

  formatTargetDialTo,

};

