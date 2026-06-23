const axios = require('axios');
const { normalizePhoneNumber } = require('./phone');
const { getCachedTenant } = require('./tenantCache');
const { getCredentialConnectionId } = require('./telnyxConfig');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const SIP_REFRESH_MIN_INTERVAL_MS = 60 * 1000;

let lastSipRefreshAt = 0;

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickMos(stats) {
  if (!stats || typeof stats !== 'object') return null;
  return toNumber(stats.mos);
}

function extractCallQualityStats(payload) {
  const stats = payload?.call_quality_stats;
  if (!stats) return null;

  const inbound = stats.inbound || {};
  const outbound = stats.outbound || {};
  const mosInbound = pickMos(inbound);
  const mosOutbound = pickMos(outbound);

  return {
    mosInbound,
    mosOutbound,
    mosBest: mosInbound ?? mosOutbound,
    jitterMaxVariance: toNumber(inbound.jitter_max_variance ?? outbound.jitter_max_variance),
    jitterPacketCount: toNumber(inbound.jitter_packet_count ?? outbound.jitter_packet_count),
    packetCount: toNumber(inbound.packet_count ?? outbound.packet_count),
    skipPacketCount: toNumber(inbound.skip_packet_count ?? outbound.skip_packet_count),
  };
}

async function resolveTenantIdForCall(prisma, from, to) {
  const candidates = [normalizePhoneNumber(to), normalizePhoneNumber(from)].filter(Boolean);
  for (const number of candidates) {
    const cached = await getCachedTenant(number);
    if (cached?.id) return cached.id;

    const row = await prisma.phoneNumber.findUnique({
      where: { number },
      select: { tenantId: true },
    });
    if (row?.tenantId) return row.tenantId;
  }
  return null;
}

async function recordCallQualityFromTelnyxEvent(prisma, body) {
  const eventType = body?.data?.event_type || body?.event_type || 'call.hangup';
  if (eventType !== 'call.hangup') return null;

  const payload = body?.data?.payload || body?.payload;
  if (!payload) return null;

  const quality = extractCallQualityStats(payload);
  if (!quality || (quality.mosInbound == null && quality.mosOutbound == null)) {
    return null;
  }

  const tenantId = await resolveTenantIdForCall(prisma, payload.from, payload.to);
  const occurredAt = payload.end_time || payload.occurred_at || body?.data?.occurred_at;

  const row = await prisma.callQualityMetric.create({
    data: {
      callSessionId: payload.call_session_id || null,
      callControlId: payload.call_control_id || null,
      tenantId,
      direction: payload.direction || null,
      from: payload.from || null,
      to: payload.to || null,
      mosInbound: quality.mosInbound,
      mosOutbound: quality.mosOutbound,
      jitterMaxVariance: quality.jitterMaxVariance,
      jitterPacketCount: quality.jitterPacketCount,
      packetCount: quality.packetCount,
      skipPacketCount: quality.skipPacketCount,
      hangupCause: payload.hangup_cause || null,
      hangupSource: payload.hangup_source || null,
      eventType,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
    },
  });

  return row;
}

async function handleTelnyxVoiceTelemetryEvent(prisma, body) {
  const eventType = body?.data?.event_type || body?.event_type || '';
  const payload = body?.data?.payload || body?.payload || {};

  if (eventType === 'call.hangup') {
    return recordCallQualityFromTelnyxEvent(prisma, body);
  }

  if (/registration/i.test(eventType)) {
    const sipUsername = payload.sip_username
      || payload.username
      || payload.credential_username
      || payload.user_name;
    const registered = payload.registered === true
      || payload.status === 'Registered'
      || payload.sip_registration_status === 'registered'
      || /registered/i.test(String(payload.status || ''));

    if (sipUsername) {
      const userResult = await prisma.user.updateMany({
        where: { telnyxSipUsername: String(sipUsername) },
        data: {
          sipRegistered: registered,
          sipRegistrationCheckedAt: new Date(),
          sipRegistrationResponse: payload.last_registration_response
            || payload.status
            || payload.sip_registration_status
            || eventType,
          sipRegistrationSource: 'telnyx_webhook',
        },
      });

      if (userResult.count === 0) {
        await prisma.extension.updateMany({
          where: { telnyxSipUsername: String(sipUsername) },
          data: {
            sipRegistered: registered,
            sipRegistrationCheckedAt: new Date(),
            sipRegistrationSource: 'telnyx_webhook',
          },
        });
      }
    }
  }

  return null;
}

async function telnyxPost(path, data) {
  if (!TELNYX_API_KEY) return null;
  const response = await axios({
    method: 'post',
    url: `https://api.telnyx.com/v2${path}`,
    data,
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: 15000,
    validateStatus: (status) => status < 500,
  });
  if (response.status >= 400) return null;
  return response.data?.data ?? response.data ?? null;
}

async function checkTelephonyCredentialRegistration(connectionId, sipUsername) {
  if (!connectionId || !sipUsername) return null;

  const data = await telnyxPost(
    `/credential_connections/${encodeURIComponent(connectionId)}/actions/check_registration_status`,
    { sip_username: sipUsername },
  );

  if (!data) {
    const fallback = await telnyxPost(
      `/credential_connections/${encodeURIComponent(connectionId)}/actions/check_registration_status`,
      {},
    );
    if (!fallback || fallback.sip_username !== sipUsername) return null;
    return fallback;
  }

  return data;
}

function isPortalOnline(user) {
  if (!user?.softphoneOnlineAt) return false;
  return new Date(user.softphoneOnlineAt).getTime() >= Date.now() - ONLINE_WINDOW_MS;
}

function isTelnyxRegisteredStatus(status) {
  return String(status || '').toLowerCase() === 'registered';
}

async function refreshSipRegistrationMetrics(prisma, platform, { force = false } = {}) {
  if (!force && Date.now() - lastSipRefreshAt < SIP_REFRESH_MIN_INTERVAL_MS) {
    return getSipRegistrationSummary(prisma, platform);
  }

  const connectionId = getCredentialConnectionId(platform);
  const users = await prisma.user.findMany({
    where: {
      tenantId: { not: null },
      OR: [
        { telnyxSipUsername: { not: null } },
        { telnyxCredentialId: { not: null } },
      ],
    },
    select: {
      id: true,
      telnyxSipUsername: true,
      softphoneOnlineAt: true,
    },
  });

  for (const user of users) {
    let registered = isPortalOnline(user);
    let source = registered ? 'portal_presence' : null;
    let response = registered ? 'softphone heartbeat' : null;

    if (connectionId && user.telnyxSipUsername) {
      try {
        const telnyx = await checkTelephonyCredentialRegistration(connectionId, user.telnyxSipUsername);
        if (telnyx?.status) {
          const telnyxRegistered = isTelnyxRegisteredStatus(telnyx.status);
          registered = telnyxRegistered || registered;
          source = telnyxRegistered ? 'telnyx_api' : (source || 'telnyx_api');
          response = telnyx.status;
        }
      } catch (error) {
        response = error.message;
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        sipRegistered: registered,
        sipRegistrationCheckedAt: new Date(),
        sipRegistrationResponse: response,
        sipRegistrationSource: source,
      },
    });
  }

  lastSipRefreshAt = Date.now();

  const extensions = await prisma.extension.findMany({
    where: {
      telnyxSipUsername: { not: null },
      sipEnabled: true,
    },
    select: {
      id: true,
      telnyxSipUsername: true,
    },
  });

  for (const extension of extensions) {
    let registered = false;
    let source = null;
    let response = null;

    if (connectionId && extension.telnyxSipUsername) {
      try {
        const telnyx = await checkTelephonyCredentialRegistration(connectionId, extension.telnyxSipUsername);
        if (telnyx?.status) {
          registered = isTelnyxRegisteredStatus(telnyx.status);
          source = 'telnyx_api';
          response = telnyx.status;
        }
      } catch (error) {
        response = error.message;
      }
    }

    await prisma.extension.update({
      where: { id: extension.id },
      data: {
        sipRegistered: registered,
        sipRegistrationCheckedAt: new Date(),
        sipRegistrationSource: source,
      },
    });
  }

  return getSipRegistrationSummary(prisma, platform);
}

async function getSipRegistrationSummary(prisma, platform) {
  const connectionId = getCredentialConnectionId(platform);
  const sipConfigured = Boolean(connectionId && TELNYX_API_KEY);

  const users = await prisma.user.findMany({
    where: { tenantId: { not: null } },
    select: {
      id: true,
      tenantId: true,
      telnyxSipUsername: true,
      telnyxCredentialId: true,
      softphoneOnlineAt: true,
      sipRegistered: true,
      sipRegistrationSource: true,
      sipRegistrationCheckedAt: true,
    },
  });

  const extensionUsers = users.filter((u) => u.telnyxSipUsername || u.telnyxCredentialId);
  const registeredUsers = extensionUsers.filter((u) => {
    if (u.sipRegistered === true) return true;
    return isPortalOnline(u);
  });

  const rate = extensionUsers.length
    ? Math.round((registeredUsers.length / extensionUsers.length) * 100)
    : null;

  return {
    sipConfigured,
    totalExtensions: extensionUsers.length,
    registeredExtensions: registeredUsers.length,
    sipRegistrationRate: rate,
    connectionId,
    checkedAt: lastSipRefreshAt ? new Date(lastSipRefreshAt).toISOString() : null,
    sources: {
      telnyxApi: extensionUsers.filter((u) => u.sipRegistrationSource === 'telnyx_api').length,
      portalPresence: extensionUsers.filter((u) => u.sipRegistrationSource === 'portal_presence').length,
      telnyxWebhook: extensionUsers.filter((u) => u.sipRegistrationSource === 'telnyx_webhook').length,
    },
  };
}

async function getMosAggregates(prisma, { hours = 24 } = {}) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = await prisma.callQualityMetric.findMany({
    where: { occurredAt: { gte: since } },
    select: {
      mosInbound: true,
      mosOutbound: true,
      tenantId: true,
      occurredAt: true,
      jitterMaxVariance: true,
      skipPacketCount: true,
      packetCount: true,
    },
    orderBy: { occurredAt: 'desc' },
  });

  if (!rows.length) {
    return {
      sampleCount: 0,
      averageMos: null,
      averageJitter: null,
      packetLossRate: null,
      source: 'none',
      since,
    };
  }

  const mosValues = [];
  let jitterTotal = 0;
  let jitterCount = 0;
  let skipPackets = 0;
  let totalPackets = 0;

  for (const row of rows) {
    const mos = row.mosInbound != null ? Number(row.mosInbound) : Number(row.mosOutbound);
    if (Number.isFinite(mos)) mosValues.push(mos);
    if (row.jitterMaxVariance != null) {
      jitterTotal += Number(row.jitterMaxVariance);
      jitterCount += 1;
    }
    skipPackets += Number(row.skipPacketCount || 0);
    totalPackets += Number(row.packetCount || 0);
  }

  const averageMos = mosValues.length
    ? Math.round((mosValues.reduce((sum, n) => sum + n, 0) / mosValues.length) * 10) / 10
    : null;

  return {
    sampleCount: rows.length,
    averageMos,
    averageJitter: jitterCount ? Math.round((jitterTotal / jitterCount) * 100) / 100 : null,
    packetLossRate: totalPackets
      ? Math.round((skipPackets / totalPackets) * 1000) / 10
      : null,
    source: 'telnyx_webhook',
    since,
  };
}

async function getVoiceTelemetrySummary(prisma, platform, { refreshSip = true } = {}) {
  const [mos, sip] = await Promise.all([
    getMosAggregates(prisma, { hours: 24 }),
    refreshSip
      ? refreshSipRegistrationMetrics(prisma, platform)
      : getSipRegistrationSummary(prisma, platform),
  ]);

  return { mos, sip };
}

function startVoiceTelemetryMonitor(prisma, loadPlatformSettings) {
  const intervalMs = Number(process.env.TELEMETRY_REFRESH_MS || 5 * 60 * 1000);

  async function tick() {
    try {
      const platform = await loadPlatformSettings(prisma);
      await refreshSipRegistrationMetrics(prisma, platform, { force: true });
    } catch (error) {
      console.warn('⚠️ SIP telemetry refresh failed:', error.message);
    }
  }

  setTimeout(tick, 5000);
  const timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

module.exports = {
  ONLINE_WINDOW_MS,
  extractCallQualityStats,
  recordCallQualityFromTelnyxEvent,
  handleTelnyxVoiceTelemetryEvent,
  checkTelephonyCredentialRegistration,
  refreshSipRegistrationMetrics,
  getSipRegistrationSummary,
  getMosAggregates,
  getVoiceTelemetrySummary,
  startVoiceTelemetryMonitor,
};
