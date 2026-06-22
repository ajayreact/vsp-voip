const FAILED_STATUSES = new Set([
  'failed',
  'busy',
  'no-answer',
  'canceled',
  'cancelled',
  'no_answer',
  'rejected',
]);
const { getMosAggregates } = require('./voiceTelemetry');

function resolveQuotaLimit(tenantValue, platformDefault) {
  return tenantValue != null ? tenantValue : platformDefault;
}

function quotaUsagePercent(used, limit) {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

async function getVoiceQualityReport(prisma) {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last5min = new Date(now.getTime() - 5 * 60 * 1000);

  const [calls24h, calls7d, activeConcurrent, tenantRows, mosTelemetry] = await Promise.all([
    prisma.callLog.findMany({
      where: { createdAt: { gte: last24h } },
      select: {
        id: true,
        callSid: true,
        from: true,
        to: true,
        status: true,
        durationSeconds: true,
        createdAt: true,
        tenantId: true,
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.callLog.findMany({
      where: { createdAt: { gte: last7d } },
      select: { status: true, durationSeconds: true, createdAt: true },
    }),
    prisma.callLog.count({
      where: {
        createdAt: { gte: last5min },
        status: { in: ['ringing', 'in-progress', 'answered', 'active', 'bridged'] },
      },
    }),
    prisma.tenant.findMany({
      select: { id: true, name: true },
    }),
    getMosAggregates(prisma, { hours: 24 }),
  ]);

  const tenantNameById = Object.fromEntries(tenantRows.map((t) => [t.id, t.name]));

  const failed24h = calls24h.filter((c) => FAILED_STATUSES.has(String(c.status).toLowerCase()));
  const answered24h = calls24h.filter((c) => !FAILED_STATUSES.has(String(c.status).toLowerCase()));
  const durations = answered24h
    .map((c) => c.durationSeconds)
    .filter((d) => d != null && d > 0);
  const avgDurationSeconds = durations.length
    ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
    : 0;
  const failedRate = calls24h.length
    ? Math.round((failed24h.length / calls24h.length) * 100)
    : 0;

  let averageMos = mosTelemetry.sampleCount > 0 ? mosTelemetry.averageMos : null;
  if (averageMos == null && calls24h.length) {
    averageMos = Math.max(1, Math.min(5, 4.3 - failedRate * 0.015));
    averageMos = Math.round(averageMos * 10) / 10;
  }

  const hourlyVolume = Array.from({ length: 24 }, (_, hour) => {
    const label = `${String(hour).padStart(2, '0')}:00`;
    const count = calls24h.filter((c) => new Date(c.createdAt).getHours() === hour).length;
    return { hour: label, count };
  });

  const dailyVolume = Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - (6 - index));
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const count = calls7d.filter((c) => {
      const at = new Date(c.createdAt);
      return at >= dayStart && at < dayEnd;
    }).length;
    return {
      day: dayStart.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      count,
    };
  });

  const tenantStatsMap = {};
  for (const call of calls24h) {
    const key = call.tenantId || 'unassigned';
    if (!tenantStatsMap[key]) {
      tenantStatsMap[key] = {
        tenantId: call.tenantId,
        tenantName: call.tenant?.name || tenantNameById[call.tenantId] || 'Unassigned',
        calls: 0,
        failed: 0,
        totalDuration: 0,
        durationCount: 0,
      };
    }
    const row = tenantStatsMap[key];
    row.calls += 1;
    if (FAILED_STATUSES.has(String(call.status).toLowerCase())) row.failed += 1;
    if (call.durationSeconds > 0) {
      row.totalDuration += call.durationSeconds;
      row.durationCount += 1;
    }
  }

  const tenantBreakdown = Object.values(tenantStatsMap)
    .map((row) => ({
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      calls: row.calls,
      failed: row.failed,
      avgDurationSeconds: row.durationCount
        ? Math.round(row.totalDuration / row.durationCount)
        : 0,
      failedRate: row.calls ? Math.round((row.failed / row.calls) * 100) : 0,
    }))
    .sort((a, b) => b.calls - a.calls);

  const recentIssues = failed24h.slice(0, 20).map((call) => ({
    callSid: call.callSid,
    from: call.from,
    to: call.to,
    status: call.status,
    tenantName: call.tenant?.name || tenantNameById[call.tenantId] || 'Unassigned',
    createdAt: call.createdAt,
  }));

  const telemetrySamples = await prisma.callQualityMetric.findMany({
    where: { occurredAt: { gte: last24h } },
    orderBy: { occurredAt: 'desc' },
    take: 25,
    include: { tenant: { select: { name: true } } },
  });

  return {
    summary: {
      averageMos: calls24h.length || mosTelemetry.sampleCount ? averageMos : null,
      averageMosSource: mosTelemetry.sampleCount > 0 ? mosTelemetry.source : (calls24h.length ? 'call_log_estimate' : 'none'),
      averageMosSamples: mosTelemetry.sampleCount,
      averageJitter: mosTelemetry.averageJitter,
      packetLossRate: mosTelemetry.packetLossRate,
      callsLast24h: calls24h.length,
      failedRate,
      avgDurationSeconds,
      activeConcurrent,
      answeredRate: calls24h.length ? 100 - failedRate : null,
    },
    hourlyVolume,
    dailyVolume,
    tenantBreakdown,
    recentIssues,
    telemetrySamples: telemetrySamples.map((row) => ({
      id: row.id,
      tenantName: row.tenant?.name || 'Unassigned',
      from: row.from,
      to: row.to,
      mosInbound: row.mosInbound != null ? Number(row.mosInbound) : null,
      mosOutbound: row.mosOutbound != null ? Number(row.mosOutbound) : null,
      jitterMaxVariance: row.jitterMaxVariance != null ? Number(row.jitterMaxVariance) : null,
      packetLoss: row.packetCount
        ? Math.round((Number(row.skipPacketCount || 0) / Number(row.packetCount)) * 1000) / 10
        : null,
      occurredAt: row.occurredAt,
    })),
  };
}

async function getQuotaReport(prisma, platform) {
  const defaults = {
    maxUsers: platform.defaultMaxUsers ?? 25,
    maxPhoneNumbers: platform.defaultMaxPhoneNumbers ?? 20,
    maxConcurrentCalls: platform.defaultMaxConcurrentCalls ?? 5,
  };

  const last5min = new Date(Date.now() - 5 * 60 * 1000);
  const tenants = await prisma.tenant.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { users: true, phoneNumbers: true } },
    },
  });

  const activeCallsByTenant = await prisma.callLog.groupBy({
    by: ['tenantId'],
    where: {
      tenantId: { not: null },
      createdAt: { gte: last5min },
      status: { in: ['ringing', 'in-progress', 'answered', 'active', 'bridged'] },
    },
    _count: { _all: true },
  });
  const activeCallMap = Object.fromEntries(
    activeCallsByTenant.map((row) => [row.tenantId, row._count._all]),
  );

  return {
    defaults,
    tenants: tenants.map((tenant) => {
      const maxUsers = resolveQuotaLimit(tenant.maxUsers, defaults.maxUsers);
      const maxPhoneNumbers = resolveQuotaLimit(tenant.maxPhoneNumbers, defaults.maxPhoneNumbers);
      const maxConcurrentCalls = resolveQuotaLimit(tenant.maxConcurrentCalls, defaults.maxConcurrentCalls);
      const userCount = tenant._count.users;
      const numberCount = tenant._count.phoneNumbers;
      const concurrentCalls = activeCallMap[tenant.id] || 0;

      return {
        id: tenant.id,
        name: tenant.name,
        isActive: tenant.isActive,
        userCount,
        numberCount,
        concurrentCalls,
        maxUsers,
        maxPhoneNumbers,
        maxConcurrentCalls,
        customMaxUsers: tenant.maxUsers,
        customMaxPhoneNumbers: tenant.maxPhoneNumbers,
        customMaxConcurrentCalls: tenant.maxConcurrentCalls,
        userUsagePercent: quotaUsagePercent(userCount, maxUsers),
        numberUsagePercent: quotaUsagePercent(numberCount, maxPhoneNumbers),
        concurrentUsagePercent: quotaUsagePercent(concurrentCalls, maxConcurrentCalls),
        overLimit: userCount > maxUsers
          || numberCount > maxPhoneNumbers
          || concurrentCalls > maxConcurrentCalls,
      };
    }),
  };
}

async function getSecurityReport(prisma) {
  const [users, tenants] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        tenant: { select: { id: true, name: true } },
      },
    }),
    prisma.tenant.findMany({
      orderBy: { name: 'asc' },
      include: {
        greeting: {
          select: {
            callRecordingEnabled: true,
            playCallRecordingNotice: true,
            voicemailEnabled: true,
            businessHoursEnabled: true,
            forwardEnabled: true,
            ivrEnabled: true,
          },
        },
        _count: { select: { users: true, phoneNumbers: true } },
      },
    }),
  ]);

  const roleCounts = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});

  const tenantCompliance = tenants.map((tenant) => {
    const greeting = tenant.greeting;
    const checks = {
      callRecordingNotice: Boolean(greeting?.playCallRecordingNotice),
      callRecordingEnabled: Boolean(greeting?.callRecordingEnabled),
      voicemailEnabled: Boolean(greeting?.voicemailEnabled),
      businessHoursConfigured: Boolean(greeting?.businessHoursEnabled),
      hasRouting: Boolean(greeting?.forwardEnabled || greeting?.ivrEnabled),
    };
    const passed = Object.values(checks).filter(Boolean).length;
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      isActive: tenant.isActive,
      userCount: tenant._count.users,
      numberCount: tenant._count.phoneNumbers,
      checks,
      complianceScore: Math.round((passed / Object.keys(checks).length) * 100),
    };
  });

  return {
    roleCounts,
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenant?.id || null,
      tenantName: user.tenant?.name || (user.role === 'SUPER_ADMIN' ? 'Platform' : '—'),
      createdAt: user.createdAt,
    })),
    tenantCompliance: tenantCompliance.sort((a, b) => a.complianceScore - b.complianceScore),
    summary: {
      totalUsers: users.length,
      superAdmins: roleCounts.SUPER_ADMIN || 0,
      tenantAdmins: roleCounts.TENANT_ADMIN || 0,
      tenantUsers: roleCounts.TENANT_USER || 0,
      tenantsBelowCompliance: tenantCompliance.filter((t) => t.complianceScore < 60).length,
    },
  };
}

function serializePortRequest(row) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    tenantName: row.tenant?.name || '—',
    phoneNumbers: Array.isArray(row.phoneNumbers) ? row.phoneNumbers : [],
    currentCarrier: row.currentCarrier,
    billingTelephoneNumber: row.billingTelephoneNumber,
    status: row.status,
    adminNotes: row.adminNotes,
    requestedByEmail: row.requestedByEmail,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listPortRequests(prisma, status) {
  const rows = await prisma.portRequest.findMany({
    where: status ? { status } : undefined,
    include: { tenant: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map(serializePortRequest);
}

async function createPortRequest(prisma, data) {
  const tenant = await prisma.tenant.findUnique({ where: { id: data.tenantId } });
  if (!tenant) {
    const error = new Error('Tenant not found');
    error.status = 404;
    throw error;
  }

  const phoneNumbers = (Array.isArray(data.phoneNumbers) ? data.phoneNumbers : [])
    .map((n) => String(n).trim())
    .filter(Boolean);
  if (!phoneNumbers.length) {
    const error = new Error('At least one phone number is required');
    error.status = 400;
    throw error;
  }

  const row = await prisma.portRequest.create({
    data: {
      tenantId: data.tenantId,
      phoneNumbers,
      currentCarrier: data.currentCarrier?.trim() || null,
      billingTelephoneNumber: data.billingTelephoneNumber?.trim() || null,
      adminNotes: data.adminNotes?.trim() || null,
      requestedByEmail: data.requestedByEmail?.trim() || null,
      status: data.status || 'SUBMITTED',
    },
    include: { tenant: { select: { name: true } } },
  });

  return serializePortRequest(row);
}

async function updatePortRequest(prisma, id, data) {
  const existing = await prisma.portRequest.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error('Port request not found');
    error.status = 404;
    throw error;
  }

  const row = await prisma.portRequest.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.adminNotes !== undefined ? { adminNotes: data.adminNotes || null } : {}),
      ...(data.currentCarrier !== undefined ? { currentCarrier: data.currentCarrier || null } : {}),
    },
    include: { tenant: { select: { name: true } } },
  });

  return serializePortRequest(row);
}

function getLcrConfig(platform) {
  return {
    primaryConnectionId: platform.lcrPrimaryConnectionId
      || platform.telnyxCallControlApplicationId
      || platform.telnyxConnectionId
      || '',
    fallbackConnectionId: platform.lcrFallbackConnectionId
      || platform.telnyxCredentialConnectionId
      || '',
    notes: platform.lcrNotes || '',
    availableConnections: [
      {
        id: platform.telnyxCallControlApplicationId || '',
        label: 'Call Control (inbound)',
        type: 'call_control',
      },
      {
        id: platform.telnyxConnectionId || '',
        label: platform.telnyxConnectionName || 'TeXML voice app',
        type: 'texml',
      },
      {
        id: platform.telnyxCredentialConnectionId || '',
        label: 'Credential connection (WebRTC)',
        type: 'credential',
      },
    ].filter((c) => c.id),
  };
}

module.exports = {
  getVoiceQualityReport,
  getQuotaReport,
  getSecurityReport,
  listPortRequests,
  createPortRequest,
  updatePortRequest,
  getLcrConfig,
  resolveQuotaLimit,
};
