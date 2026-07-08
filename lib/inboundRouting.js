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

const { traceDeskDesk } = require('./telephony/deskDeskTrace');
const { isDedicatedDeskCredentialPilotTenant } = require('./telephony/deskDedicatedCredentialPilot');

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

  const effectiveUserId = resolveEffectiveUserId(extension, phoneRecord);
  const appTargets = [];

  if (effectiveUserId) {
    let user = extension.userId === effectiveUserId ? extension.user : null;
    if (!user) {
      user = await prisma.user.findUnique({ where: { id: effectiveUserId } });
    }
    user = await ensureAppUserDialReady(prisma, user, credentialConnectionId);
    if (user?.telnyxSipUsername) {
      appTargets.push({
        type: 'app',
        user,
        extensionId: extension.id,
        label: user.name || extension.displayName || `Extension ${extension.extensionNumber}`,
      });
    }
  }

  // Phase 2.4a: assigned employees ring via User.telnyxSipUsername (app target above).
  // Legacy desk-only extensions (userId null, pre-migration extension credential) still
  // need a reachable SIP target or internal/desk routing fails with empty targets.
  //
  // Symplore pilot only (lib/telephony/deskDedicatedCredentialPilot.js): when the
  // extension has its own dedicated desk Telnyx credential (distinct from the
  // employee's app credential), add it as an additional ring target alongside the
  // app target so the physical desk phone actually gets dialed instead of being
  // silently excluded whenever the employee also has an app target.
  const appUsernames = new Set(
    appTargets.map((t) => t.user?.telnyxSipUsername).filter(Boolean),
  );
  const dedicatedDeskUsername = extension.sipEnabled !== false && extension.telnyxSipUsername
    ? extension.telnyxSipUsername
    : null;
  const isDistinctDeskCredential = Boolean(
    dedicatedDeskUsername
    && isDedicatedDeskCredentialPilotTenant(extension.tenantId)
    && !appUsernames.has(dedicatedDeskUsername),
  );

  const sipTargets = [];
  if (dedicatedDeskUsername && (!appTargets.length || isDistinctDeskCredential)) {
    sipTargets.push({
      type: 'sip',
      sipUsername: dedicatedDeskUsername,
      extensionId: extension.id,
      label: extension.displayName || `Extension ${extension.extensionNumber}`,
    });
  }

  // Pilot tenants: ring the physical desk (dedicated extension credential) before the
  // employee app credential. Runtime evidence showed desk-to-desk internal calls
  // dialing app first (often unregistered on the desk) while the desk phone registers
  // only on extension.telnyxSipUsername — ring legs failed in ~2s with no answer.
  const targets = isDedicatedDeskCredentialPilotTenant(extension.tenantId) && sipTargets.length
    ? [...sipTargets, ...appTargets]
    : [...appTargets, ...sipTargets];
  const ringTimeout = 25;
  const strategy = 'sequential';

  traceDeskDesk('resolveExtensionRingTargets()', {
    tenantId: extension.tenantId ?? null,
    extensionNumber: extension.extensionNumber ?? null,
    effectiveUserId,
    appTargets: appTargets.map((t) => ({
      type: t.type,
      userId: t.user?.id ?? null,
      sipUsername: t.user?.telnyxSipUsername ?? null,
    })),
    sipTargets: sipTargets.map((t) => ({
      type: t.type,
      sipUsername: t.sipUsername ?? null,
    })),
    targets: targets.map((t) => formatTargetDialTo(t)),
    targetCount: targets.length,
  });

  return {
    targets,
    ringTimeout,
    strategy,
    extensionId: extension.id,
    effectiveUserId,
    appTargets,
    sipTargets,
  };
}

async function resolveDirectUserRingTargets(prisma, phoneRecord, credentialConnectionId, tenantId = null) {
  let userId = phoneRecord?.assignedUserId || null;
  let resolvedTenantId = tenantId || phoneRecord?.tenantId || null;

  if (phoneRecord?.extensionId) {
    const extension = await prisma.extension.findFirst({
      where: {
        id: phoneRecord.extensionId,
        ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
        status: 'ACTIVE',
      },
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
