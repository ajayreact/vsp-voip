const { mapVoicemailRecord, extensionVoicemailWhereClause } = require('./voicemail');
const {
  serializeDnd,
  serializeForwarding,
  enrichForwardingLabels,
  updateExtensionDnd,
  updateExtensionForwarding,
  updateExtensionBusinessFeatures,
  initiateIntercom,
} = require('./extensionFeatures');
const { serializeSecurity } = require('./extensionSecurity');
const {
  buildOwnershipPayload,
  loadExtensionPhoneNumber,
  resolveExtensionPhoneNumber,
  syncPhoneNumbersForExtension,
  setExtensionPrimaryDid,
} = require('./extensionOwnership');
const { ensureExtensionTelnyxCredential } = require('./extensionSip');

/** Clear temporary employee ownership from other extensions before reassignment. */
async function releaseEmployeeFromOtherExtensions(prisma, tenantId, userId, exceptExtensionId = null) {
  if (!userId) return;

  const released = await prisma.extension.findMany({
    where: {
      tenantId,
      userId,
      status: 'ACTIVE',
      ...(exceptExtensionId ? { id: { not: exceptExtensionId } } : {}),
    },
    select: { id: true },
  });

  if (!released.length) return;

  await prisma.extension.updateMany({
    where: { id: { in: released.map((ext) => ext.id) } },
    data: { userId: null },
  });

  for (const ext of released) {
    const phone = await loadExtensionPhoneNumber(prisma, ext.id);
    if (phone?.assignedUserId === userId) {
      await prisma.phoneNumber.update({
        where: { id: phone.id },
        data: { assignedUserId: null },
      });
    }
  }
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const MOBILE_STALE_MS = 24 * 60 * 60 * 1000;
const MOBILE_EXPIRED_MS = 30 * 24 * 60 * 60 * 1000;

const EXTENSION_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      softphoneOnlineAt: true,
      sipRegistered: true,
      sipRegistrationCheckedAt: true,
      telnyxSipUsername: true,
      devices: {
        orderBy: { lastSeenAt: 'desc' },
      },
      assignedNumbers: {
        take: 1,
        select: { id: true, number: true, label: true },
      },
    },
  },
  primaryPhoneNumber: {
    select: { id: true, number: true, label: true, routingType: true, isActive: true },
  },
  forwarding: true,
  security: true,
  voicemailSettings: true,
  devices: {
    orderBy: [{ status: 'asc' }, { lastRegistrationAt: 'desc' }],
  },
};

function normalizeExtensionNumber(value) {
  const num = String(value || '').trim();
  if (!/^\d{2,6}$/.test(num)) {
    throw Object.assign(new Error('Extension number must be 2–6 digits'), { status: 400 });
  }
  return num;
}

function isUserWebRtcOnline(user, now = Date.now()) {
  if (!user?.softphoneOnlineAt) return false;
  const onlineAt = new Date(user.softphoneOnlineAt).getTime();
  return Boolean(user.sipRegistered) && now - onlineAt <= ONLINE_WINDOW_MS;
}

function mobileDeviceStatus(lastSeenAt, now = Date.now()) {
  if (!lastSeenAt) return 'OFFLINE';
  const age = now - new Date(lastSeenAt).getTime();
  if (age <= MOBILE_STALE_MS) return 'ONLINE';
  if (age <= MOBILE_EXPIRED_MS) return 'OFFLINE';
  return 'EXPIRED';
}

function deriveDeviceRows(extension, now = Date.now()) {
  const rows = [];
  const user = extension.user;

  if (extension.webrtcEnabled && user?.telnyxSipUsername) {
    const online = isUserWebRtcOnline(user, now);
    rows.push({
      deviceType: 'WEBRTC',
      deviceName: 'Web softphone',
      platform: 'webrtc',
      userDeviceId: null,
      status: online ? 'ONLINE' : 'OFFLINE',
      lastRegistrationAt: user.softphoneOnlineAt || user.sipRegistrationCheckedAt || null,
    });
  }

  if (user?.devices?.length) {
    for (const device of user.devices) {
      rows.push({
        deviceType: 'MOBILE',
        deviceName: device.deviceName || `${device.platform} device`,
        platform: device.platform,
        userDeviceId: device.id,
        status: mobileDeviceStatus(device.lastSeenAt, now),
        lastRegistrationAt: device.lastSeenAt,
      });
    }
  }

  if (extension.sipEnabled && extension.telnyxSipUsername) {
    const online = Boolean(extension.sipRegistered);
    rows.push({
      deviceType: 'SIP',
      deviceName: extension.sipUsername
        ? `Desk SIP (${extension.sipUsername})`
        : `Desk SIP (${extension.extensionNumber})`,
      platform: 'sip',
      userDeviceId: null,
      status: online ? 'ONLINE' : 'OFFLINE',
      lastRegistrationAt: extension.sipRegistrationCheckedAt || null,
    });
  } else if (extension.sipEnabled && (extension.sipUsername || extension.sipPassword)) {
    rows.push({
      deviceType: 'SIP',
      deviceName: extension.sipUsername ? `Desk SIP (${extension.sipUsername})` : 'Desk SIP',
      platform: 'sip',
      userDeviceId: null,
      status: 'OFFLINE',
      lastRegistrationAt: null,
    });
  }

  return rows;
}

async function syncExtensionDevices(prisma, extension) {
  const derived = deriveDeviceRows(extension);
  await prisma.extensionDevice.deleteMany({ where: { extensionId: extension.id } });

  if (!derived.length) return [];

  await prisma.extensionDevice.createMany({
    data: derived.map((row) => ({
      extensionId: extension.id,
      deviceType: row.deviceType,
      deviceName: row.deviceName,
      platform: row.platform,
      userDeviceId: row.userDeviceId,
      status: row.status,
      lastRegistrationAt: row.lastRegistrationAt,
    })),
  });

  return prisma.extensionDevice.findMany({
    where: { extensionId: extension.id },
    orderBy: [{ status: 'asc' }, { lastRegistrationAt: 'desc' }],
  });
}

function serializeDevice(device) {
  return {
    id: device.id,
    deviceType: device.deviceType,
    deviceName: device.deviceName,
    platform: device.platform,
    status: device.status,
    lastRegistrationAt: device.lastRegistrationAt?.toISOString?.() || device.lastRegistrationAt || null,
  };
}

function registrationSummary(extension, devices, now = Date.now()) {
  const user = extension.user;
  const onlineDevices = devices.filter((d) => d.status === 'ONLINE');
  const lastRegistration = devices.reduce((latest, device) => {
    if (!device.lastRegistrationAt) return latest;
    const ts = new Date(device.lastRegistrationAt).getTime();
    return !latest || ts > latest ? ts : latest;
  }, null);

  return {
    webrtcEnabled: extension.webrtcEnabled,
    sipEnabled: extension.sipEnabled,
    multiDeviceEnabled: extension.multiDeviceEnabled,
    isLive: onlineDevices.length > 0,
    currentRegistration: onlineDevices[0]
      ? {
        deviceType: onlineDevices[0].deviceType,
        deviceName: onlineDevices[0].deviceName,
        platform: onlineDevices[0].platform,
      }
      : null,
    lastRegistrationAt: lastRegistration ? new Date(lastRegistration).toISOString() : null,
    connectedDeviceCount: onlineDevices.length,
    totalDeviceCount: devices.length,
    sipRegistered: Boolean(user?.sipRegistered),
    softphoneOnlineAt: user?.softphoneOnlineAt?.toISOString?.() || null,
  };
}

function registrationMonitoringRow(extension, devices) {
  const deviceRows = devices.map(serializeDevice);
  const online = deviceRows.some((d) => d.status === 'ONLINE');
  const lastRegistration = deviceRows.reduce((latest, device) => {
    if (!device.lastRegistrationAt) return latest;
    const ts = new Date(device.lastRegistrationAt).getTime();
    return !latest || ts > latest ? ts : latest;
  }, null);

  return {
    extensionId: extension.id,
    extensionNumber: extension.extensionNumber,
    displayName: extension.displayName,
    status: online ? 'ONLINE' : 'OFFLINE',
    lastRegistrationAt: lastRegistration ? new Date(lastRegistration).toISOString() : null,
    deviceCount: deviceRows.length,
    connectedDeviceCount: deviceRows.filter((d) => d.status === 'ONLINE').length,
    doNotDisturb: Boolean(extension.doNotDisturb),
    callScreeningEnabled: Boolean(extension.callScreeningEnabled),
    intercomEnabled: Boolean(extension.intercomEnabled),
  };
}

async function serializeExtension(extension, devices, { forwardingDetail = null, phoneNumber = null } = {}) {
  const deviceRows = (devices || extension.devices || []).map(serializeDevice);
  const registeredCount = deviceRows.filter((d) => d.status === 'ONLINE').length;
  const did = resolveExtensionPhoneNumber(extension, phoneNumber);
  const ownership = buildOwnershipPayload(extension, deviceRows, did);

  return {
    id: extension.id,
    extensionNumber: extension.extensionNumber,
    displayName: extension.displayName,
    email: extension.email,
    status: extension.status,
    department: extension.department,
    userId: extension.userId,
    user: extension.user
      ? {
        id: extension.user.id,
        name: extension.user.name,
        email: extension.user.email,
      }
      : null,
    primaryPhoneNumberId: extension.primaryPhoneNumberId || ownership.primaryDid?.id || null,
    ownership,
    employeeName: ownership.employee.name,
    assignedDidNumber: ownership.assignedDidNumber,
    deviceRegistration: ownership.deviceRegistration,
    lastSeen: ownership.lastSeen,
    inboundRecipient: ownership.inboundRecipient,
    lastActivityAt: extension.lastActivityAt?.toISOString?.() || null,
    createdAt: extension.createdAt?.toISOString?.() || extension.createdAt,
    features: {
      voicemailEnabled: extension.voicemailEnabled,
      callRecordingEnabled: extension.callRecordingEnabled,
      doNotDisturb: extension.doNotDisturb,
      callScreeningEnabled: extension.callScreeningEnabled,
      intercomEnabled: extension.intercomEnabled,
    },
    dnd: serializeDnd(extension),
    registration: registrationSummary(extension, deviceRows),
    deviceCount: deviceRows.length,
    registeredDeviceCount: registeredCount,
    devices: deviceRows,
    voicemailSettings: extension.voicemailSettings
      ? {
        enabled: extension.voicemailSettings.enabled,
        greetingUrl: extension.voicemailSettings.greetingUrl,
        emailNotifications: extension.voicemailSettings.emailNotifications,
        notificationEmail: extension.voicemailSettings.notificationEmail,
      }
      : null,
    forwarding: forwardingDetail || serializeForwarding(extension.forwarding),
    security: serializeSecurity(extension.security),
  };
}

async function suggestNextExtensionNumber(prisma, tenantId) {
  const existing = await prisma.extension.findMany({
    where: { tenantId },
    select: { extensionNumber: true },
    orderBy: { extensionNumber: 'asc' },
  });

  const used = new Set(existing.map((row) => row.extensionNumber));
  for (let n = 101; n <= 9999; n += 1) {
    const candidate = String(n);
    if (!used.has(candidate)) return candidate;
  }
  throw Object.assign(new Error('No extension numbers available'), { status: 409 });
}

async function createExtensionDefaults(prisma, extensionId, payload = {}) {
  await Promise.all([
    prisma.extensionForwarding.create({
      data: { extensionId },
    }),
    prisma.extensionSecurity.create({
      data: { extensionId },
    }),
    prisma.extensionVoicemailSettings.create({
      data: {
        extensionId,
        enabled: payload.voicemailEnabled !== false,
        emailNotifications: Boolean(payload.emailNotifications),
        notificationEmail: payload.notificationEmail || null,
      },
    }),
  ]);
}

async function loadExtension(prisma, tenantId, extensionId, { syncDevices = true } = {}) {
  const normalizedId = String(extensionId || '').trim();
  if (process.env.NODE_ENV !== 'production') {
    console.log('[extensions] loadExtension', { extensionId: normalizedId, tenantId });
  }

  const extension = await prisma.extension.findFirst({
    where: { id: normalizedId, tenantId },
    include: EXTENSION_INCLUDE,
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('[extensions] loadExtension result', {
      extensionId: normalizedId,
      tenantId,
      found: Boolean(extension),
      extensionNumber: extension?.extensionNumber || null,
    });
  }

  if (!extension) {
    throw Object.assign(new Error('Extension not found'), { status: 404 });
  }

  const phoneNumber = await loadExtensionPhoneNumber(prisma, extensionId);
  const devices = syncDevices
    ? await syncExtensionDevices(prisma, extension)
    : extension.devices;

  return { extension, devices, phoneNumber };
}

async function listExtensions(prisma, tenantId) {
  const extensions = await prisma.extension.findMany({
    where: { tenantId },
    include: EXTENSION_INCLUDE,
    orderBy: [{ extensionNumber: 'asc' }],
  });

  const results = [];
  for (const extension of extensions) {
    const devices = await syncExtensionDevices(prisma, extension);
    const phoneNumber = await loadExtensionPhoneNumber(prisma, extension.id);
    results.push(await serializeExtension(extension, devices, { phoneNumber }));
  }
  return results;
}

async function getExtensionDetail(prisma, tenantId, extensionId) {
  const { extension, devices, phoneNumber } = await loadExtension(prisma, tenantId, extensionId);
  const forwardingDetail = await enrichForwardingLabels(prisma, tenantId, extension.forwarding);
  return serializeExtension(extension, devices, { forwardingDetail, phoneNumber });
}

async function createExtension(prisma, tenantId, body, actor = {}) {
  const extensionNumber = body.extensionNumber
    ? normalizeExtensionNumber(body.extensionNumber)
    : await suggestNextExtensionNumber(prisma, tenantId);

  const displayName = String(body.displayName || '').trim();
  if (!displayName) {
    throw Object.assign(new Error('Display name is required'), { status: 400 });
  }

  const email = body.email ? String(body.email).trim().toLowerCase() : null;
  const department = body.department ? String(body.department).trim() : null;
  const userId = body.userId ? String(body.userId) : null;

  if (userId) {
    const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw Object.assign(new Error('Assigned user not found in this organization'), { status: 400 });

    await releaseEmployeeFromOtherExtensions(prisma, tenantId, userId);
  }

  const extension = await prisma.extension.create({
    data: {
      tenantId,
      extensionNumber,
      displayName,
      email,
      department,
      userId,
      status: 'ACTIVE',
      voicemailEnabled: body.voicemailEnabled !== false,
      callRecordingEnabled: body.callRecordingEnabled !== false,
      webrtcEnabled: body.webrtcEnabled !== false,
      sipEnabled: body.sipEnabled !== false,
      sipUsername: extensionNumber,
      multiDeviceEnabled: body.multiDeviceEnabled !== false,
    },
    include: EXTENSION_INCLUDE,
  });

  await createExtensionDefaults(prisma, extension.id, body);

  try {
    await ensureExtensionTelnyxCredential(prisma, extension);
  } catch (error) {
    console.warn(`Extension ${extensionNumber}: desk Telnyx credential not created on insert: ${error.message}`);
  }

  if (userId) {
    await syncPhoneNumbersForExtension(prisma, tenantId, extension, { userId });
  }

  if (body.primaryPhoneNumberId) {
    await setExtensionPrimaryDid(
      prisma,
      tenantId,
      extension.id,
      String(body.primaryPhoneNumberId),
      actor,
    );
  }

  const full = await prisma.extension.findUnique({
    where: { id: extension.id },
    include: EXTENSION_INCLUDE,
  });
  const devices = await syncExtensionDevices(prisma, full);
  const phoneNumber = await loadExtensionPhoneNumber(prisma, extension.id);
  return serializeExtension(full, devices, { phoneNumber });
}

async function updateExtension(prisma, tenantId, extensionId, body) {
  const existing = await prisma.extension.findFirst({
    where: { id: extensionId, tenantId },
  });
  if (!existing) throw Object.assign(new Error('Extension not found'), { status: 404 });

  if (body.extensionNumber !== undefined) {
    normalizeExtensionNumber(body.extensionNumber);
  }

  if (body.userId) {
    const user = await prisma.user.findFirst({ where: { id: body.userId, tenantId } });
    if (!user) throw Object.assign(new Error('Assigned user not found in this organization'), { status: 400 });
  }

  const data = {};
  if (body.extensionNumber !== undefined) data.extensionNumber = normalizeExtensionNumber(body.extensionNumber);
  if (body.displayName !== undefined) data.displayName = String(body.displayName).trim();
  if (body.email !== undefined) data.email = body.email ? String(body.email).trim().toLowerCase() : null;
  if (body.department !== undefined) data.department = body.department ? String(body.department).trim() : null;
  if (body.userId !== undefined) data.userId = body.userId || null;
  if (body.status !== undefined) data.status = body.status;
  if (body.voicemailEnabled !== undefined) data.voicemailEnabled = Boolean(body.voicemailEnabled);
  if (body.callRecordingEnabled !== undefined) data.callRecordingEnabled = Boolean(body.callRecordingEnabled);
  if (body.webrtcEnabled !== undefined) data.webrtcEnabled = Boolean(body.webrtcEnabled);
  if (body.sipEnabled !== undefined) data.sipEnabled = Boolean(body.sipEnabled);
  if (body.multiDeviceEnabled !== undefined) data.multiDeviceEnabled = Boolean(body.multiDeviceEnabled);
  if (body.doNotDisturb !== undefined) data.doNotDisturb = Boolean(body.doNotDisturb);
  if (body.callScreeningEnabled !== undefined) data.callScreeningEnabled = Boolean(body.callScreeningEnabled);
  if (body.intercomEnabled !== undefined) data.intercomEnabled = Boolean(body.intercomEnabled);

  if (data.displayName === '') {
    throw Object.assign(new Error('Display name cannot be empty'), { status: 400 });
  }

  if (body.userId) {
    await releaseEmployeeFromOtherExtensions(prisma, tenantId, body.userId, extensionId);
  }

  await prisma.extension.update({ where: { id: extensionId }, data });

  if (body.userId !== undefined) {
    const updatedExt = await prisma.extension.findUnique({ where: { id: extensionId } });
    await syncPhoneNumbersForExtension(prisma, tenantId, updatedExt, { userId: updatedExt.userId });
  }

  if (body.voicemailSettings) {
    await prisma.extensionVoicemailSettings.upsert({
      where: { extensionId },
      create: {
        extensionId,
        enabled: body.voicemailSettings.enabled !== false,
        greetingUrl: body.voicemailSettings.greetingUrl || null,
        emailNotifications: Boolean(body.voicemailSettings.emailNotifications),
        notificationEmail: body.voicemailSettings.notificationEmail || null,
      },
      update: {
        enabled: body.voicemailSettings.enabled !== false,
        greetingUrl: body.voicemailSettings.greetingUrl || null,
        emailNotifications: Boolean(body.voicemailSettings.emailNotifications),
        notificationEmail: body.voicemailSettings.notificationEmail || null,
      },
    });
  }

  if (body.dnd) await updateExtensionDnd(prisma, tenantId, extensionId, body.dnd);
  if (body.forwarding) await updateExtensionForwarding(prisma, tenantId, extensionId, body.forwarding);

  return getExtensionDetail(prisma, tenantId, extensionId);
}

async function disableExtension(prisma, tenantId, extensionId) {
  const existing = await prisma.extension.findFirst({ where: { id: extensionId, tenantId } });
  if (!existing) throw Object.assign(new Error('Extension not found'), { status: 404 });

  await prisma.extension.update({
    where: { id: extensionId },
    data: { status: 'INACTIVE' },
  });

  return getExtensionDetail(prisma, tenantId, extensionId);
}

async function deleteExtension(prisma, tenantId, extensionId) {
  const existing = await prisma.extension.findFirst({ where: { id: extensionId, tenantId } });
  if (!existing) throw Object.assign(new Error('Extension not found'), { status: 404 });

  await prisma.extension.delete({ where: { id: extensionId } });
  return { deleted: true };
}

async function getExtensionDidNumbers(extension, phoneNumber) {
  const did = phoneNumber?.number
    || extension.primaryPhoneNumber?.number
    || extension.user?.assignedNumbers?.[0]?.number;
  return did ? [did] : [];
}

async function computeExtensionAnalytics(prisma, tenantId, extension, phoneNumber) {
  const numbers = await getExtensionDidNumbers(extension, phoneNumber);

  const [calls, voicemails] = await Promise.all([
    numbers.length
      ? prisma.callLog.findMany({
        where: {
          tenantId,
          OR: [
            { to: { in: numbers } },
            { from: { in: numbers } },
          ],
        },
        select: {
          direction: true,
          status: true,
          durationSeconds: true,
        },
      })
      : Promise.resolve([]),
    prisma.voicemail.count({
      where: extensionVoicemailWhereClause(tenantId, extension.id, numbers),
    }),
  ]);

  const inboundCalls = calls.filter((c) => c.direction === 'inbound').length;
  const outboundCalls = calls.filter((c) => c.direction === 'outbound').length;
  const missedCalls = calls.filter((c) => {
    const callType = String(c.callType || '').toLowerCase();
    if (callType === 'missed') return true;
    if (callType && callType !== 'inbound') return false;
    return c.direction === 'inbound'
      && ['no-answer', 'missed'].includes(String(c.status || '').toLowerCase());
  }).length;

  const durations = calls
    .map((c) => c.durationSeconds)
    .filter((d) => typeof d === 'number' && d > 0);
  const averageDurationSeconds = durations.length
    ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
    : 0;

  return {
    inboundCalls,
    outboundCalls,
    missedCalls,
    voicemails,
    averageDurationSeconds,
  };
}

async function getExtensionAnalytics(prisma, tenantId, extensionId) {
  const { extension, phoneNumber } = await loadExtension(prisma, tenantId, extensionId, { syncDevices: false });
  const analytics = await computeExtensionAnalytics(prisma, tenantId, extension, phoneNumber);
  return analytics;
}

async function listExtensionVoicemails(prisma, tenantId, extensionId, limit = 50) {
  const { extension, phoneNumber } = await loadExtension(prisma, tenantId, extensionId, { syncDevices: false });
  const numbers = await getExtensionDidNumbers(extension, phoneNumber);

  const rows = await prisma.voicemail.findMany({
    where: extensionVoicemailWhereClause(tenantId, extension.id, numbers),
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });

  return rows.map(mapVoicemailRecord);
}

async function listAllTenantDevices(prisma, tenantId) {
  const extensions = await prisma.extension.findMany({
    where: { tenantId },
    include: EXTENSION_INCLUDE,
    orderBy: { extensionNumber: 'asc' },
  });

  const allDevices = [];
  for (const extension of extensions) {
    const devices = await syncExtensionDevices(prisma, extension);
    for (const device of devices) {
      allDevices.push({
        ...serializeDevice(device),
        extensionId: extension.id,
        extensionNumber: extension.extensionNumber,
        displayName: extension.displayName,
      });
    }
  }

  const totalDevices = allDevices.length;
  const registeredDevices = allDevices.filter((d) => d.status === 'ONLINE').length;

  return {
    totalDevices,
    registeredDevices,
    devices: allDevices,
    byType: {
      webrtc: allDevices.filter((d) => d.deviceType === 'WEBRTC').length,
      mobile: allDevices.filter((d) => d.deviceType === 'MOBILE').length,
      sip: allDevices.filter((d) => d.deviceType === 'SIP').length,
    },
  };
}

async function getExtensionDashboardStats(prisma, tenantId) {
  const extensions = await prisma.extension.findMany({
    where: { tenantId },
    include: EXTENSION_INCLUDE,
  });

  let onlineExtensions = 0;
  let offlineExtensions = 0;
  let voicemailCount = 0;

  for (const extension of extensions) {
    const devices = deriveDeviceRows(extension);
    const isOnline = devices.some((d) => d.status === 'ONLINE');
    if (isOnline) onlineExtensions += 1;
    else offlineExtensions += 1;

    const phoneNumber = await loadExtensionPhoneNumber(prisma, extension.id);
    const numbers = phoneNumber ? [phoneNumber.number] : [];
    voicemailCount += await prisma.voicemail.count({
      where: extensionVoicemailWhereClause(tenantId, extension.id, numbers),
    });
  }

  return {
    totalExtensions: extensions.length,
    onlineExtensions,
    offlineExtensions,
    voicemailCount,
    activeExtensions: extensions.filter((e) => e.status === 'ACTIVE').length,
  };
}

async function listRegistrationMonitoring(prisma, tenantId) {
  const extensions = await prisma.extension.findMany({
    where: { tenantId },
    include: EXTENSION_INCLUDE,
    orderBy: { extensionNumber: 'asc' },
  });

  const rows = [];
  for (const extension of extensions) {
    const devices = await syncExtensionDevices(prisma, extension);
    rows.push(registrationMonitoringRow(extension, devices));
  }

  return {
    total: rows.length,
    online: rows.filter((r) => r.status === 'ONLINE').length,
    offline: rows.filter((r) => r.status === 'OFFLINE').length,
    extensions: rows,
  };
}

module.exports = {
  listExtensions,
  getExtensionDetail,
  createExtension,
  updateExtension,
  disableExtension,
  deleteExtension,
  getExtensionAnalytics,
  listExtensionVoicemails,
  listAllTenantDevices,
  getExtensionDashboardStats,
  listRegistrationMonitoring,
  suggestNextExtensionNumber,
  serializeExtension,
  updateExtensionBusinessFeatures,
  initiateIntercom,
};
