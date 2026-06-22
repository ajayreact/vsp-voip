const { writeExtensionAuditLog } = require('./extensionSecurity');
const { defaultBusinessHours, isWithinBusinessHours } = require('./businessHours');
const { normalizePhoneNumber } = require('./phone');
const { normalizeRingGroupMembers } = require('./ringGroup');
const { ensureAppUserDialReady } = require('./inboundRouting');

const VALID_DEST_TYPES = new Set(['EXTENSION', 'RING_GROUP', 'EXTERNAL_NUMBER']);
const VALID_DND_ACTIONS = new Set(['VOICEMAIL', 'FORWARD']);

function serializeForwardRule(prefix, forwarding) {
  if (!forwarding) return null;
  return {
    enabled: Boolean(forwarding[`${prefix}Enabled`]),
    destinationType: forwarding[`${prefix}DestinationType`] || null,
    destination: forwarding[`${prefix}Destination`] || null,
  };
}

function serializeForwarding(forwarding) {
  if (!forwarding) {
    return {
      always: emptyRule(),
      busy: emptyRule(),
      noAnswer: emptyRule(),
      schedule: { ...emptyRule(), rules: defaultBusinessHours() },
    };
  }
  return {
    always: serializeForwardRule('always', forwarding) || emptyRule(),
    busy: serializeForwardRule('busy', forwarding) || emptyRule(),
    noAnswer: serializeForwardRule('noAnswer', forwarding) || emptyRule(),
    schedule: {
      ...(serializeForwardRule('schedule', forwarding) || emptyRule()),
      enabled: Boolean(forwarding.scheduleEnabled),
      destinationType: forwarding.scheduleDestinationType || null,
      destination: forwarding.scheduleDestination || null,
      rules: forwarding.scheduleRules || defaultBusinessHours(),
    },
  };
}

function emptyRule() {
  return { enabled: false, destinationType: null, destination: null };
}

function serializeDnd(extension) {
  return {
    enabled: Boolean(extension.doNotDisturb),
    reason: extension.dndReason || null,
    scheduledEnabled: Boolean(extension.dndScheduledEnabled),
    schedule: extension.dndSchedule || defaultBusinessHours(),
    inboundAction: extension.dndInboundAction || 'VOICEMAIL',
  };
}

function isDndScheduleActive(extension, timezone) {
  if (!extension.dndScheduledEnabled || !extension.dndSchedule) return false;
  return isWithinBusinessHours(extension.dndSchedule, timezone);
}

function isDndActive(extension, timezone) {
  if (extension.doNotDisturb) return true;
  return isDndScheduleActive(extension, timezone);
}

function isScheduleForwardActive(forwarding, timezone) {
  if (!forwarding?.scheduleEnabled) return false;
  const rules = forwarding.scheduleRules || forwarding.schedule?.rules;
  return isWithinBusinessHours(rules || defaultBusinessHours(), timezone);
}

function normalizeForwardPayload(rule) {
  if (!rule || typeof rule !== 'object') return null;
  const enabled = Boolean(rule.enabled);
  if (!enabled) {
    return { enabled: false, destinationType: null, destination: null };
  }
  const destinationType = rule.destinationType ? String(rule.destinationType).toUpperCase() : null;
  if (!destinationType || !VALID_DEST_TYPES.has(destinationType)) {
    throw Object.assign(new Error('destinationType must be EXTENSION, RING_GROUP, or EXTERNAL_NUMBER'), { status: 400 });
  }
  const destination = String(rule.destination || '').trim();
  if (!destination) {
    throw Object.assign(new Error('destination is required when forwarding is enabled'), { status: 400 });
  }
  if (destinationType === 'EXTERNAL_NUMBER') {
    const normalized = normalizePhoneNumber(destination);
    if (!normalized) {
      throw Object.assign(new Error('Invalid external phone number'), { status: 400 });
    }
    return { enabled: true, destinationType, destination: normalized };
  }
  return { enabled: true, destinationType, destination };
}

function buildForwardingUpdate(body) {
  const data = {};
  const map = [
    ['always', 'always'],
    ['busy', 'busy'],
    ['noAnswer', 'noAnswer'],
  ];
  for (const [key, prefix] of map) {
    if (body[key] !== undefined) {
      const normalized = normalizeForwardPayload(body[key]);
      if (normalized) {
        data[`${prefix}Enabled`] = normalized.enabled;
        data[`${prefix}DestinationType`] = normalized.destinationType;
        data[`${prefix}Destination`] = normalized.destination;
      }
    }
  }
  if (body.schedule !== undefined) {
    const schedule = body.schedule;
    if (schedule.enabled) {
      const normalized = normalizeForwardPayload({
        enabled: true,
        destinationType: schedule.destinationType,
        destination: schedule.destination,
      });
      data.scheduleEnabled = true;
      data.scheduleDestinationType = normalized.destinationType;
      data.scheduleDestination = normalized.destination;
    } else {
      data.scheduleEnabled = false;
    }
    if (schedule.rules !== undefined) {
      data.scheduleRules = schedule.rules;
    }
  }
  return data;
}

async function resolveDestinationLabel(prisma, tenantId, type, destination) {
  if (!type || !destination) return null;
  if (type === 'EXTERNAL_NUMBER') return destination;
  if (type === 'EXTENSION') {
    const ext = await prisma.extension.findFirst({
      where: {
        tenantId,
        OR: [{ id: destination }, { extensionNumber: destination }],
      },
      select: { extensionNumber: true, displayName: true },
    });
    return ext ? `${ext.extensionNumber} — ${ext.displayName}` : destination;
  }
  if (type === 'RING_GROUP') {
    const group = await prisma.ringGroup.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [{ id: destination }, { name: destination }, { extensionNumber: destination }],
      },
    });
    if (group) return group.name;
    const greeting = await prisma.greeting.findUnique({ where: { tenantId } });
    if (destination === 'default' || destination === greeting?.ringGroupName) {
      return greeting?.ringGroupName || 'Default ring group';
    }
    return destination;
  }
  return destination;
}

async function enrichForwardingLabels(prisma, tenantId, forwarding) {
  const serialized = serializeForwarding(forwarding);
  if (!serialized) return null;
  for (const key of ['always', 'busy', 'noAnswer']) {
    const rule = serialized[key];
    if (rule?.enabled) {
      rule.destinationLabel = await resolveDestinationLabel(
        prisma,
        tenantId,
        rule.destinationType,
        rule.destination,
      );
    }
  }
  if (serialized.schedule?.enabled) {
    serialized.schedule.destinationLabel = await resolveDestinationLabel(
      prisma,
      tenantId,
      serialized.schedule.destinationType,
      serialized.schedule.destination,
    );
  }
  return serialized;
}

async function resolveForwardTargets(prisma, tenantId, type, destination, credentialConnectionId) {
  if (!type || !destination) return [];

  if (type === 'EXTERNAL_NUMBER') {
    const phone = normalizePhoneNumber(destination);
    return phone ? [{ type: 'phone', phone, label: phone }] : [];
  }

  if (type === 'EXTENSION') {
    const ext = await prisma.extension.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        OR: [{ id: destination }, { extensionNumber: destination }],
      },
      include: {
        user: true,
      },
    });
    if (!ext) return [];
    const { resolveExtensionRingTargets } = require('./inboundRouting');
    const resolution = await resolveExtensionRingTargets(prisma, ext, credentialConnectionId);
    return resolution?.targets || [];
  }

  if (type === 'RING_GROUP') {
    const group = await prisma.ringGroup.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [{ id: destination }, { name: destination }, { extensionNumber: destination }],
      },
    });
    if (group) {
      const { resolveRingGroupEntityTargets } = require('./ringGroupRouter');
      const resolved = await resolveRingGroupEntityTargets(prisma, group, credentialConnectionId);
      return resolved.targets;
    }

    const greeting = await prisma.greeting.findUnique({ where: { tenantId } });
    if (!greeting?.ringGroupEnabled) return [];
    const members = normalizeRingGroupMembers(greeting.ringGroupMembers);
    const appUserIds = members.filter((m) => m.type === 'app' && m.userId).map((m) => m.userId);
    let appUsers = appUserIds.length
      ? await prisma.user.findMany({ where: { tenantId, id: { in: appUserIds } } })
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
    return targets;
  }

  return [];
}

async function findExtensionForPhoneRecord(prisma, tenantId, phoneRecord) {
  if (phoneRecord?.extensionId) {
    return prisma.extension.findFirst({
      where: {
        id: phoneRecord.extensionId,
        tenantId,
        status: 'ACTIVE',
      },
      include: {
        forwarding: true,
        security: true,
        user: true,
      },
    });
  }
  if (!phoneRecord?.assignedUserId) return null;
  return prisma.extension.findFirst({
    where: {
      tenantId,
      userId: phoneRecord.assignedUserId,
      status: 'ACTIVE',
    },
    include: {
      forwarding: true,
      security: true,
      user: true,
    },
  });
}

async function updateExtensionDnd(prisma, tenantId, extensionId, body, actor = {}) {
  const existing = await prisma.extension.findFirst({ where: { id: extensionId, tenantId } });
  if (!existing) throw Object.assign(new Error('Extension not found'), { status: 404 });

  const before = {
    doNotDisturb: existing.doNotDisturb,
    dndReason: existing.dndReason,
    dndScheduledEnabled: existing.dndScheduledEnabled,
    dndInboundAction: existing.dndInboundAction,
  };

  const data = {};
  if (body.enabled !== undefined) data.doNotDisturb = Boolean(body.enabled);
  if (body.reason !== undefined) data.dndReason = body.reason ? String(body.reason).slice(0, 200) : null;
  if (body.scheduledEnabled !== undefined) data.dndScheduledEnabled = Boolean(body.scheduledEnabled);
  if (body.schedule !== undefined) data.dndSchedule = body.schedule;
  if (body.inboundAction !== undefined) {
    const action = String(body.inboundAction).toUpperCase();
    if (!VALID_DND_ACTIONS.has(action)) {
      throw Object.assign(new Error('inboundAction must be VOICEMAIL or FORWARD'), { status: 400 });
    }
    data.dndInboundAction = action;
  }

  const updated = await prisma.extension.update({ where: { id: extensionId }, data });

  await writeExtensionAuditLog(prisma, {
    tenantId,
    extensionId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    category: 'dnd',
    action: 'dnd.updated',
    summary: updated.doNotDisturb ? 'DND enabled' : 'DND settings updated',
    changes: { before, after: data },
  });

  return updated;
}

async function updateExtensionForwarding(prisma, tenantId, extensionId, body, actor = {}) {
  const existing = await prisma.extension.findFirst({ where: { id: extensionId, tenantId } });
  if (!existing) throw Object.assign(new Error('Extension not found'), { status: 404 });

  const before = await prisma.extensionForwarding.findUnique({ where: { extensionId } });
  const data = buildForwardingUpdate(body);
  const forwarding = await prisma.extensionForwarding.upsert({
    where: { extensionId },
    create: { extensionId, ...data },
    update: data,
  });

  await writeExtensionAuditLog(prisma, {
    tenantId,
    extensionId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    category: 'forwarding',
    action: 'forwarding.updated',
    summary: 'Call forwarding rules updated',
    changes: { before, after: data },
  });

  return forwarding;
}

async function updateExtensionBusinessFeatures(prisma, tenantId, extensionId, body, actor = {}) {
  const existing = await prisma.extension.findFirst({ where: { id: extensionId, tenantId } });
  if (!existing) throw Object.assign(new Error('Extension not found'), { status: 404 });

  const data = {};
  if (body.doNotDisturb !== undefined) data.doNotDisturb = Boolean(body.doNotDisturb);
  if (body.callScreeningEnabled !== undefined) data.callScreeningEnabled = Boolean(body.callScreeningEnabled);
  if (body.intercomEnabled !== undefined) data.intercomEnabled = Boolean(body.intercomEnabled);
  if (body.callRecordingEnabled !== undefined) data.callRecordingEnabled = Boolean(body.callRecordingEnabled);
  if (body.voicemailEnabled !== undefined) data.voicemailEnabled = Boolean(body.voicemailEnabled);

  if (Object.keys(data).length) {
    await prisma.extension.update({ where: { id: extensionId }, data });
  }
  if (body.dnd) await updateExtensionDnd(prisma, tenantId, extensionId, body.dnd, actor);
  if (body.forwarding) await updateExtensionForwarding(prisma, tenantId, extensionId, body.forwarding, actor);
}

async function initiateIntercom(prisma, tenantId, fromExtensionId, targetExtensionNumber) {
  const fromExt = await prisma.extension.findFirst({
    where: { id: fromExtensionId, tenantId, status: 'ACTIVE' },
    include: { user: true },
  });
  if (!fromExt) throw Object.assign(new Error('Source extension not found'), { status: 404 });
  if (!fromExt.intercomEnabled) {
    throw Object.assign(new Error('Intercom is not enabled on this extension'), { status: 400 });
  }
  if (!fromExt.user?.telnyxSipUsername) {
    throw Object.assign(new Error('Source extension has no registered softphone user'), { status: 400 });
  }

  const target = await prisma.extension.findFirst({
    where: { tenantId, extensionNumber: String(targetExtensionNumber).trim(), status: 'ACTIVE' },
    include: { user: true },
  });
  if (!target) throw Object.assign(new Error('Target extension not found'), { status: 404 });
  if (!target.intercomEnabled) {
    throw Object.assign(new Error('Intercom is not enabled on target extension'), { status: 400 });
  }
  if (!target.user?.telnyxSipUsername) {
    throw Object.assign(new Error('Target extension has no registered softphone user'), { status: 400 });
  }

  return {
    mode: 'intercom',
    from: {
      extensionNumber: fromExt.extensionNumber,
      displayName: fromExt.displayName,
      sipUsername: fromExt.user.telnyxSipUsername,
    },
    target: {
      extensionNumber: target.extensionNumber,
      displayName: target.displayName,
      sipUsername: target.user.telnyxSipUsername,
    },
    dialUri: `sip:${target.user.telnyxSipUsername}`,
    autoAnswer: true,
    message: `Intercom ${fromExt.extensionNumber} → ${target.extensionNumber}`,
  };
}

function formatCallerName(from, phoneRecord) {
  const digits = normalizePhoneNumber(from) || from;
  return digits;
}

module.exports = {
  serializeForwarding,
  serializeDnd,
  enrichForwardingLabels,
  isDndActive,
  isScheduleForwardActive,
  normalizeForwardPayload,
  buildForwardingUpdate,
  resolveForwardTargets,
  findExtensionForPhoneRecord,
  updateExtensionDnd,
  updateExtensionForwarding,
  updateExtensionBusinessFeatures,
  initiateIntercom,
  formatCallerName,
  resolveDestinationLabel,
};
