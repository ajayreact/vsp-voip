const VALID_PLATFORMS = new Set(['android', 'ios']);

async function registerUserDevice(prisma, {
  userId,
  deviceId,
  platform,
  pushToken,
  deviceName,
  appVersion,
}) {
  const normalizedPlatform = String(platform || '').trim().toLowerCase();
  const normalizedDeviceId = String(deviceId || '').trim();
  const normalizedToken = String(pushToken || '').trim();

  if (!userId || !normalizedDeviceId || !normalizedToken) {
    throw Object.assign(new Error('userId, deviceId, and pushToken are required'), { status: 400 });
  }
  if (!VALID_PLATFORMS.has(normalizedPlatform)) {
    throw Object.assign(new Error('platform must be android or ios'), { status: 400 });
  }

  const now = new Date();
  const device = await prisma.userDevice.upsert({
    where: {
      userId_deviceId: {
        userId,
        deviceId: normalizedDeviceId,
      },
    },
    create: {
      userId,
      deviceId: normalizedDeviceId,
      platform: normalizedPlatform,
      pushToken: normalizedToken,
      deviceName: deviceName ? String(deviceName).slice(0, 120) : null,
      appVersion: appVersion ? String(appVersion).slice(0, 32) : null,
      lastSeenAt: now,
    },
    update: {
      platform: normalizedPlatform,
      pushToken: normalizedToken,
      deviceName: deviceName ? String(deviceName).slice(0, 120) : undefined,
      appVersion: appVersion ? String(appVersion).slice(0, 32) : undefined,
      lastSeenAt: now,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      pushDeviceToken: normalizedToken,
      pushDevicePlatform: normalizedPlatform,
      pushTokenUpdatedAt: now,
    },
  });

  return device;
}

async function listUserDevices(prisma, userId) {
  return prisma.userDevice.findMany({
    where: { userId },
    orderBy: { lastSeenAt: 'desc' },
  });
}

async function removeUserDevice(prisma, userId, deviceId) {
  const normalizedDeviceId = String(deviceId || '').trim();
  if (!normalizedDeviceId) {
    throw Object.assign(new Error('deviceId is required'), { status: 400 });
  }

  const existing = await prisma.userDevice.findUnique({
    where: {
      userId_deviceId: { userId, deviceId: normalizedDeviceId },
    },
  });
  if (!existing) {
    return { removed: false };
  }

  await prisma.userDevice.delete({
    where: {
      userId_deviceId: { userId, deviceId: normalizedDeviceId },
    },
  });

  const latest = await prisma.userDevice.findFirst({
    where: { userId },
    orderBy: { lastSeenAt: 'desc' },
  });

  await prisma.user.update({
    where: { id: userId },
    data: latest
      ? {
        pushDeviceToken: latest.pushToken,
        pushDevicePlatform: latest.platform,
        pushTokenUpdatedAt: latest.lastSeenAt,
      }
      : {
        pushDeviceToken: null,
        pushDevicePlatform: null,
        pushTokenUpdatedAt: null,
      },
  });

  return { removed: true };
}

async function countUserDevices(prisma, userId) {
  return prisma.userDevice.count({ where: { userId } });
}

module.exports = {
  registerUserDevice,
  listUserDevices,
  removeUserDevice,
  countUserDevices,
};
