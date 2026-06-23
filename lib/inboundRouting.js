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

function resolveEffectiveUserId(extension, phoneRecord) {
  return extension?.userId ?? phoneRecord?.assignedUserId ?? null;
}

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

function hasSipRingTargets(targets) {
  return Array.isArray(targets) && targets.some((target) => target.type === 'sip');
}

function targetDedupeKey(target) {
  if (target.type === 'app') return `app:${target.user?.id}`;
  if (target.type === 'sip') return `sip:${target.sipUsername}`;
  if (target.type === 'phone') return `phone:${target.phone}`;
  return JSON.stringify(target);
}

function mergeRingTargets(existing, additions) {
  const merged = [...(existing || [])];
  const seen = new Set(merged.map(targetDedupeKey));
  for (const target of additions || []) {
    const key = targetDedupeKey(target);
    if (seen.has(key)) continue;
    merged.push(target);
    seen.add(key);
  }
  return merged;
}

function summarizeTargetsForLog(targets) {
  return (targets || []).map((target) => {
    if (target.type === 'app') {
      return {
        type: 'app',
        label: target.label,
        userId: target.user?.id || null,
        dial: target.user?.telnyxSipUsername
          ? `sip:${target.user.telnyxSipUsername}@sip.telnyx.com`
          : null,
      };
    }
    if (target.type === 'sip') {
      return {
        type: 'sip',
        label: target.label,
        dial: target.sipUsername
          ? `sip:${target.sipUsername}@sip.telnyx.com`
          : null,
      };
    }
    return {
      type: target.type,
      label: target.label,
      dial: target.phone || null,
    };
  });
}

function logInboundRingTargetResolution(meta) {
  console.log('   ↳ Inbound ring target resolution:', JSON.stringify({
    did: meta.did || null,
    extension: meta.extensionNumber || null,
    extensionUserId: meta.extensionUserId ?? null,
    assignedUserId: meta.assignedUserId ?? null,
    effectiveUserId: meta.effectiveUserId ?? null,
    appTargets: summarizeTargetsForLog(meta.appTargets),
    sipTargets: summarizeTargetsForLog(meta.sipTargets),
    finalTargets: summarizeTargetsForLog(meta.finalTargets),
  }));
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

async function resolveAppTargetForUser(
  prisma,
  tenantId,
  userId,
  credentialConnectionId,
  { extensionId = null, label = null } = {},
) {
  if (!userId) return null;

  let user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });
  if (!user) return null;

  user = await ensureAppUserDialReady(prisma, user, credentialConnectionId);
  if (!user?.telnyxSipUsername) return null;

  return {
    type: 'app',
    user,
    extensionId,
    label: label || user.name,
  };
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

async function resolveExtensionRingTargets(prisma, extension, credentialConnectionId, phoneRecord = null) {
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

  const effectiveUserId = resolveEffectiveUserId(ext, phoneRecord);
  if (effectiveUserId) {
    let user = ext.userId === effectiveUserId ? ext.user : null;
    if (!user) {
      user = await prisma.user.findUnique({ where: { id: effectiveUserId } });
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
    effectiveUserId,
    appTargets,
    sipTargets: deskTargets,
  };
}

async function resolveDirectUserRingTargets(prisma, phoneRecord, credentialConnectionId, tenantId = null) {
  let userId = phoneRecord?.assignedUserId || null;
  let resolvedTenantId = tenantId || phoneRecord?.tenantId || null;

  if (phoneRecord?.extensionId) {
    const extension = await prisma.extension.findFirst({
      where: { id: phoneRecord.extensionId, status: 'ACTIVE' },
      select: { userId: true, tenantId: true },
    });
    userId = resolveEffectiveUserId(extension, phoneRecord);
    resolvedTenantId = resolvedTenantId || extension?.tenantId || null;
  }

  if (!userId) return null;

  const appTarget = await resolveAppTargetForUser(
    prisma,
    resolvedTenantId,
    userId,
    credentialConnectionId,
  );
  if (!appTarget) return { targets: [], ringTimeout: 25, strategy: 'sequential' };

  return {
    targets: [appTarget],
    ringTimeout: 25,
    strategy: 'sequential',
  };
}

async function resolveGreetingRingTargets(prisma, tenantId, greeting, credentialConnectionId, ringTimeout) {
  if (!greeting?.ringGroupEnabled) {
    return { targets: [], ringTimeout, strategy: 'sequential' };
  }

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

  const targets = [];
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

async function resolveRingTargets(prisma, tenantId, greeting, phoneRecord, credentialConnectionId) {
  const ringTimeout = clampRingTimeout(greeting?.ringTimeout);
  let targets = [];
  let strategy = 'sequential';
  let effectiveTimeout = ringTimeout;
  let extensionId = null;
  let extensionNumber = null;
  let extensionUserId = null;
  let effectiveUserId = null;

  const routingMeta = {
    did: phoneRecord?.number || null,
    assignedUserId: phoneRecord?.assignedUserId ?? null,
  };

  const entityGroup = await resolveEntityRingGroup(prisma, tenantId, phoneRecord, credentialConnectionId);
  if (entityGroup) {
    logInboundRingTargetResolution({
      did: routingMeta.did,
      extensionNumber: null,
      extensionUserId: null,
      assignedUserId: routingMeta.assignedUserId,
      effectiveUserId: null,
      appTargets: (entityGroup.targets || []).filter((t) => t.type === 'app'),
      sipTargets: (entityGroup.targets || []).filter((t) => t.type === 'sip'),
      finalTargets: entityGroup.targets || [],
    });

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
    logInboundRingTargetResolution({
      did: routingMeta.did,
      extensionNumber: null,
      extensionUserId: null,
      assignedUserId: routingMeta.assignedUserId,
      effectiveUserId: null,
      appTargets: [],
      sipTargets: [],
      finalTargets: [],
    });

    return { targets: [], ringTimeout, strategy: 'sequential', ringGroupId: phoneRecord.ringGroupId };
  }

  let extensionResolution = null;

  if (phoneRecord?.extensionId || (phoneRecord?.routingType === 'direct_user' && phoneRecord.assignedUserId)) {
    const extension = await resolveExtensionForPhoneRecord(prisma, tenantId, phoneRecord);
    if (extension) {
      extensionNumber = extension.extensionNumber;
      extensionUserId = extension.userId ?? null;
      extensionResolution = await resolveExtensionRingTargets(
        prisma,
        extension,
        credentialConnectionId,
        phoneRecord,
      );
      if (extensionResolution) {
        targets = mergeRingTargets(targets, extensionResolution.targets);
        strategy = extensionResolution.strategy;
        extensionId = extensionResolution.extensionId;
        effectiveTimeout = extensionResolution.ringTimeout;
        effectiveUserId = extensionResolution.effectiveUserId ?? null;
      }
    }
  }

  if (!hasAppRingTargets(targets) && phoneRecord?.assignedUserId) {
    const assignedApp = await resolveAppTargetForUser(
      prisma,
      tenantId,
      phoneRecord.assignedUserId,
      credentialConnectionId,
      { extensionId, label: null },
    );
    if (assignedApp) {
      targets = mergeRingTargets(targets, [assignedApp]);
      if (!effectiveUserId) effectiveUserId = phoneRecord.assignedUserId;
    }
  }

  if (!hasAppRingTargets(targets)) {
    const greetingResolution = await resolveGreetingRingTargets(
      prisma,
      tenantId,
      greeting,
      credentialConnectionId,
      ringTimeout,
    );
    if (greetingResolution.targets.length) {
      targets = mergeRingTargets(targets, greetingResolution.targets);
      strategy = greetingResolution.strategy;
      effectiveTimeout = greetingResolution.ringTimeout;
    }
  }

  if (!targets.length && greeting?.forwardEnabled && greeting.forwardNumber) {
    const phone = normalizePhoneNumber(greeting.forwardNumber);
    if (phone) {
      targets.push({ type: 'phone', phone, label: 'Forward' });
    }
  }

  if (extensionResolution && targets.length > 1 && extensionId) {
    const extension = await prisma.extension.findUnique({
      where: { id: extensionId },
      select: { multiDeviceEnabled: true },
    });
    if (extension?.multiDeviceEnabled !== false) {
      strategy = 'simultaneous';
    }
  }

  const appTargets = targets.filter((t) => t.type === 'app');
  const sipTargets = targets.filter((t) => t.type === 'sip');

  logInboundRingTargetResolution({
    did: routingMeta.did,
    extensionNumber,
    extensionUserId,
    assignedUserId: routingMeta.assignedUserId,
    effectiveUserId,
    appTargets,
    sipTargets,
    finalTargets: targets,
  });

  return {
    targets,
    ringTimeout: effectiveTimeout,
    strategy,
    extensionId,
    routingDebug: {
      did: routingMeta.did,
      extensionNumber,
      extensionUserId,
      assignedUserId: routingMeta.assignedUserId,
      effectiveUserId,
      appTargets: summarizeTargetsForLog(appTargets),
      sipTargets: summarizeTargetsForLog(sipTargets),
      finalTargets: summarizeTargetsForLog(targets),
    },
  };
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
  resolveEffectiveUserId,
  hasAppRingMembers,
  requiresCallControlRouting,
  hasAppRingTargets,
  hasSipRingTargets,
  mergeRingTargets,
  summarizeTargetsForLog,
  resolveRingTargets,
  resolveExtensionForPhoneRecord,
  resolveExtensionRingTargets,
  resolveDirectUserRingTargets,
  resolveAppTargetForUser,
  resolveGreetingRingTargets,
  ensureAppUserDialReady,
  resolveEntityRingGroup,
  formatTargetDialTo,
};
