/**
 * Ring target endpoint classification — separates routing model (target.type) from
 * physical endpoint (endpointType: desk | mobile | webrtc | mixed).
 *
 * target.type (app | sip | phone) = Call Control routing / credential model (unchanged).
 * endpointType = registered device surface that will receive the dial INVITE.
 *
 * @see docs/vsp/pbx/09-extension-routing.md
 */

const ENDPOINT_TYPES = Object.freeze({
  DESK: 'desk',
  MOBILE: 'mobile',
  WEBRTC: 'webrtc',
  MIXED: 'mixed',
});

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const MOBILE_STALE_MS = 24 * 60 * 60 * 1000;

const V3_DESK_ACTIVE_STATUSES = new Set(['ASSIGNED', 'PROVISIONED', 'REGISTERED']);

function mobileDeviceActive(lastSeenAt, now = Date.now()) {
  if (!lastSeenAt) return false;
  return now - new Date(lastSeenAt).getTime() <= MOBILE_STALE_MS;
}

function isUserWebRtcOnline(user, now = Date.now()) {
  if (!user?.softphoneOnlineAt || !user?.telnyxSipUsername) return false;
  const onlineAt = new Date(user.softphoneOnlineAt).getTime();
  return Boolean(user.sipRegistered) && now - onlineAt <= ONLINE_WINDOW_MS;
}

async function loadRingEndpointContext(prisma, { extension, user } = {}) {
  if (!extension?.id) {
    return { extensionDevices: [], v3DeskDevices: [], userDevices: [] };
  }

  const userId = user?.id || extension.userId || null;
  const [extensionDevices, v3DeskDevices, userDevices] = await Promise.all([
    prisma.extensionDevice.findMany({
      where: { extensionId: extension.id },
      orderBy: [{ status: 'asc' }, { lastRegistrationAt: 'desc' }],
    }),
    prisma.v3DeskDevice.findMany({
      where: {
        extensionId: extension.id,
        removedAt: null,
        status: { not: 'REMOVED' },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    userId
      ? prisma.userDevice.findMany({
        where: { userId },
        orderBy: { lastSeenAt: 'desc' },
      })
      : [],
  ]);

  return { extensionDevices, v3DeskDevices, userDevices };
}

function endpointKey(endpoint) {
  return `${endpoint.endpointType}:${endpoint.source}:${endpoint.deviceId || endpoint.platform || ''}`;
}

function dedupeEndpoints(endpoints) {
  const seen = new Set();
  const out = [];
  for (const endpoint of endpoints) {
    const key = endpointKey(endpoint);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(endpoint);
  }
  return out;
}

/**
 * Discover reachable endpoint surfaces for an extension + optional employee.
 */
function discoverEndpoints({
  extension,
  user,
  extensionDevices = [],
  v3DeskDevices = [],
  userDevices = [],
  now = Date.now(),
} = {}) {
  const endpoints = [];

  for (const device of v3DeskDevices) {
    if (!V3_DESK_ACTIVE_STATUSES.has(device.status)) continue;
    endpoints.push({
      endpointType: ENDPOINT_TYPES.DESK,
      source: 'v3_desk_device',
      deviceId: device.id,
      vendor: device.vendor || null,
      registered: device.status === 'REGISTERED' || Boolean(device.lastRegistrationAt),
    });
  }

  for (const device of extensionDevices) {
    if (device.deviceType === 'SIP') {
      endpoints.push({
        endpointType: ENDPOINT_TYPES.DESK,
        source: 'extension_device',
        deviceId: device.id,
        platform: device.platform || 'sip',
        registered: device.status === 'ONLINE',
      });
    } else if (device.deviceType === 'MOBILE') {
      endpoints.push({
        endpointType: ENDPOINT_TYPES.MOBILE,
        source: 'extension_device',
        deviceId: device.id,
        platform: device.platform || null,
        registered: device.status === 'ONLINE',
      });
    } else if (device.deviceType === 'WEBRTC') {
      endpoints.push({
        endpointType: ENDPOINT_TYPES.WEBRTC,
        source: 'extension_device',
        deviceId: device.id,
        platform: 'webrtc',
        registered: device.status === 'ONLINE',
      });
    }
  }

  for (const device of userDevices) {
    endpoints.push({
      endpointType: ENDPOINT_TYPES.MOBILE,
      source: 'user_device',
      deviceId: device.id,
      platform: device.platform || null,
      registered: mobileDeviceActive(device.lastSeenAt, now),
      pushCapable: Boolean(device.pushToken),
    });
  }

  if (user?.pushDeviceToken) {
    endpoints.push({
      endpointType: ENDPOINT_TYPES.MOBILE,
      source: 'push_token',
      registered: false,
      pushInstalled: true,
    });
  }

  if (extension?.webrtcEnabled !== false && user?.telnyxSipUsername && isUserWebRtcOnline(user, now)) {
    endpoints.push({
      endpointType: ENDPOINT_TYPES.WEBRTC,
      source: 'user_softphone_online',
      registered: true,
    });
  }

  if (
    extension?.sipEnabled !== false
    && extension?.telnyxSipUsername
    && !user?.id
    && !endpoints.some((item) => item.endpointType === ENDPOINT_TYPES.DESK)
  ) {
    endpoints.push({
      endpointType: ENDPOINT_TYPES.DESK,
      source: 'extension_credential',
      registered: Boolean(extension.sipRegistered),
    });
  }

  if (
    extension?.sipEnabled !== false
    && (extension?.sipUsername || extension?.sipPassword)
    && !endpoints.some((item) => item.endpointType === ENDPOINT_TYPES.DESK)
  ) {
    endpoints.push({
      endpointType: ENDPOINT_TYPES.DESK,
      source: 'extension_legacy_sip',
      registered: Boolean(extension.sipRegistered),
    });
  }

  return dedupeEndpoints(endpoints);
}

function resolveAggregateEndpointType(endpoints, { routingType = 'app' } = {}) {
  if (routingType === 'sip') {
    return ENDPOINT_TYPES.DESK;
  }

  const pool = endpoints.filter((item) => item.registered !== false);
  const types = new Set(pool.map((item) => item.endpointType));
  const hasDesk = types.has(ENDPOINT_TYPES.DESK);
  const hasMobile = types.has(ENDPOINT_TYPES.MOBILE);
  const hasWebRtc = types.has(ENDPOINT_TYPES.WEBRTC);

  if ((hasMobile || hasWebRtc) && hasDesk) return ENDPOINT_TYPES.MIXED;
  if (hasMobile && hasWebRtc) return ENDPOINT_TYPES.MIXED;
  if (hasDesk) return ENDPOINT_TYPES.DESK;
  if (hasMobile) return ENDPOINT_TYPES.MOBILE;
  if (hasWebRtc) return ENDPOINT_TYPES.WEBRTC;

  return routingType === 'sip' ? ENDPOINT_TYPES.DESK : ENDPOINT_TYPES.MOBILE;
}

function annotateRingTarget(target, endpointMeta) {
  return {
    ...target,
    endpointType: endpointMeta.endpointType,
    endpoints: endpointMeta.endpoints,
  };
}

async function resolveTargetEndpointMeta(prisma, { extension, user, routingType = 'app' } = {}) {
  const ctx = await loadRingEndpointContext(prisma, { extension, user });
  const endpoints = discoverEndpoints({ extension, user, ...ctx });
  const endpointType = resolveAggregateEndpointType(endpoints, { routingType });
  return { endpointType, endpoints };
}

function deskEndpointMeta() {
  return {
    endpointType: ENDPOINT_TYPES.DESK,
    endpoints: [{ endpointType: ENDPOINT_TYPES.DESK, source: 'legacy_sip_target', registered: true }],
  };
}

function hasDeskRingTargets(targets) {
  return Array.isArray(targets) && targets.some((target) => target.endpointType === ENDPOINT_TYPES.DESK);
}

function hasMobileOrWebRtcRingTargets(targets) {
  return Array.isArray(targets) && targets.some((target) => (
    target.endpointType === ENDPOINT_TYPES.MOBILE
    || target.endpointType === ENDPOINT_TYPES.WEBRTC
    || target.endpointType === ENDPOINT_TYPES.MIXED
  ));
}

function isDeskOnlyRingTargets(targets) {
  return Array.isArray(targets)
    && targets.length > 0
    && targets.every((target) => target.endpointType === ENDPOINT_TYPES.DESK);
}

module.exports = {
  ENDPOINT_TYPES,
  loadRingEndpointContext,
  discoverEndpoints,
  resolveAggregateEndpointType,
  annotateRingTarget,
  resolveTargetEndpointMeta,
  deskEndpointMeta,
  hasDeskRingTargets,
  hasMobileOrWebRtcRingTargets,
  isDeskOnlyRingTargets,
};
