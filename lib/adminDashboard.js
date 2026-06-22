const { getTelnyxStatus } = require('./telnyxStatus');
const { getVoiceTelemetrySummary } = require('./voiceTelemetry');
const { loadPlatformSettings } = require('./platformSettings');
const { loadPaymentGatewaySettings, getBankPaymentStats } = require('./paymentGateways');
const { serializeOrder } = require('./billing');
const { getVoiceQualityReport } = require('./adminModules');

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

async function loadDashboardBase(prisma) {
  const platform = await loadPlatformSettings(prisma);
  const gateway = await loadPaymentGatewaySettings(prisma);
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last5min = new Date(now.getTime() - 5 * 60 * 1000);

  const [
    tenantCount,
    activeTenantCount,
    phoneNumberCount,
    pendingBankOrders,
    bankPaymentStats,
    revenueAgg,
    recentOrders,
    billingAlerts,
    telnyxStatus,
    totalUsers,
    tenantsThisMonth,
    tenantsLastMonth,
    activeConcurrentCalls,
    callsLast24h,
    callsToday,
    callsThisMonth,
    smsToday,
    phoneNumbers,
    activeStripeSubscriptions,
    pendingPortRequests,
    recentTenants,
    callStatsToday,
    callStatsMonth,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.phoneNumber.count(),
    prisma.numberOrder.count({
      where: {
        paymentMethod: 'MANUAL_BANK',
        OR: [
          { status: 'PENDING_PAYMENT' },
          { status: 'PENDING' },
          { paymentReviewStatus: 'PENDING' },
        ],
        NOT: { status: { in: ['FULFILLED', 'CANCELLED', 'FAILED'] } },
      },
    }),
    getBankPaymentStats(prisma),
    prisma.numberOrder.aggregate({
      where: { status: { in: ['FULFILLED', 'PAID', 'PARTIAL'] } },
      _sum: { totalCharged: true },
    }),
    prisma.numberOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { tenant: { select: { name: true } } },
    }),
    prisma.adminAuditLog.findMany({
      where: {
        action: { in: ['billing.payment_failed', 'billing.subscription_cancelled'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    getTelnyxStatus(prisma),
    prisma.user.count({ where: { tenantId: { not: null } } }),
    prisma.tenant.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.tenant.count({
      where: { createdAt: { gte: lastMonthStart, lt: monthStart } },
    }),
    prisma.callLog.count({
      where: {
        createdAt: { gte: last5min },
        status: { in: ['ringing', 'in-progress', 'answered', 'active', 'bridged'] },
      },
    }),
    prisma.callLog.count({ where: { createdAt: { gte: last24h } } }),
    prisma.callLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.callLog.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.smsMessage.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.phoneNumber.findMany({
      select: { tenantMonthlyTotal: true, platformMonthly: true, isActive: true },
    }),
    prisma.tenant.count({
      where: { stripeSubscriptionId: { not: null }, isActive: true },
    }),
    prisma.portRequest.count({
      where: { status: { in: ['SUBMITTED', 'IN_PROGRESS'] } },
    }),
    prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, createdAt: true, isActive: true },
    }),
    prisma.callLog.groupBy({
      by: ['status'],
      where: { createdAt: { gte: todayStart } },
      _count: { _all: true },
    }),
    prisma.callLog.aggregate({
      where: { createdAt: { gte: monthStart } },
      _avg: { durationSeconds: true },
      _count: { _all: true },
    }),
  ]);

  const mrrEstimate = phoneNumbers.reduce(
    (sum, row) => sum + Number(row.tenantMonthlyTotal ?? row.platformMonthly ?? 8),
    0,
  );

  let tenantGrowthPercent = 0;
  if (tenantsLastMonth > 0) {
    tenantGrowthPercent = Math.round(
      ((tenantsThisMonth - tenantsLastMonth) / tenantsLastMonth) * 100,
    );
  } else if (tenantsThisMonth > 0) {
    tenantGrowthPercent = 100;
  }

  const failedStatuses = new Set(['failed', 'busy', 'no-answer', 'cancelled', 'canceled']);
  let callsSuccessToday = 0;
  let callsFailedToday = 0;
  for (const row of callStatsToday) {
    if (failedStatuses.has(String(row.status).toLowerCase())) {
      callsFailedToday += row._count._all;
    } else {
      callsSuccessToday += row._count._all;
    }
  }
  const callsTodayTotal = callsSuccessToday + callsFailedToday;
  const callSuccessRate = callsTodayTotal
    ? Math.round((callsSuccessToday / callsTodayTotal) * 1000) / 10
    : null;
  const callFailureRate = callsTodayTotal
    ? Math.round((callsFailedToday / callsTodayTotal) * 1000) / 10
    : null;

  const assignedNumbers = phoneNumbers.filter((n) => n.isActive !== false).length;
  const releasedNumbers = phoneNumbers.filter((n) => n.isActive === false).length;

  const maxConcurrentCapacity = Number(process.env.PLATFORM_MAX_CONCURRENT_CALLS || 1500);
  const telemetry = await getVoiceTelemetrySummary(prisma, platform, { refreshSip: false });

  const platformHealth = {
    score: 100,
    status: 'healthy',
    checks: {
      telnyx: telnyxStatus.connected,
      stripe: gateway.stripeEnabled && platform.stripeEnabled,
      smtp: Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim()),
      api: true,
    },
  };
  if (!telnyxStatus.connected) {
    platformHealth.score -= 40;
    platformHealth.status = 'degraded';
  }
  if (billingAlerts.length > 0) {
    platformHealth.score -= 15;
    platformHealth.status = platformHealth.status === 'healthy' ? 'warning' : platformHealth.status;
  }

  return {
    platform,
    now,
    stats: {
      tenantCount,
      activeTenantCount,
      suspendedTenantCount: tenantCount - activeTenantCount,
      phoneNumberCount,
      assignedNumbers,
      releasedNumbers,
      pendingBankOrders,
      bankPaymentsPending: bankPaymentStats.pending,
      bankPaymentsApproved: bankPaymentStats.approved,
      bankPaymentsRejected: bankPaymentStats.rejected,
      revenueTotal: Number(revenueAgg._sum.totalCharged || 0),
      stripeEnabled: gateway.stripeEnabled && Boolean(platform.stripeSecretKey),
      manualPaymentEnabled: gateway.bankTransferEnabled && gateway.bankConfigured,
      razorpayEnabled: gateway.razorpayEnabled,
      smtpConfigured: platformHealth.checks.smtp,
      telnyxConnected: telnyxStatus.connected,
      telnyxApiKeyConfigured: telnyxStatus.apiKeyConfigured,
      kpis: {
        tenantGrowthPercent,
        mrrEstimate,
        arrEstimate: Math.round(mrrEstimate * 12 * 100) / 100,
        totalUsers,
        totalExtensions: telemetry.sip.totalExtensions ?? totalUsers,
        activeConcurrentCalls,
        maxConcurrentCapacity,
        callsLast24h,
        callsToday,
        callsThisMonth,
        smsToday,
        callSuccessRate,
        callFailureRate,
        avgCallDurationSeconds: callStatsMonth._avg.durationSeconds
          ? Math.round(callStatsMonth._avg.durationSeconds)
          : null,
        averageMos: telemetry.mos.sampleCount > 0 ? telemetry.mos.averageMos : null,
        averageMosSource: telemetry.mos.source,
        averageMosSamples: telemetry.mos.sampleCount,
        sipRegistrationRate: telemetry.sip.sipRegistrationRate,
        sipRegistrationSource: telemetry.sip.sources,
        sipRegisteredExtensions: telemetry.sip.registeredExtensions,
        activeStripeSubscriptions,
        pendingLnpRequests: pendingPortRequests,
        availableDidPool: 0,
        inventoryPurchased: phoneNumberCount,
        carrierBalanceNote: telnyxStatus.connected ? 'Telnyx prepaid — check carrier portal' : null,
      },
      platformHealth,
    },
    telnyxStatus,
    telemetry,
    billingAlerts,
    recentOrders: recentOrders.map((o) => serializeOrder(o, o.tenant)),
    recentTenants,
  };
}

async function loadTimeseries(prisma, days = 7) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const [calls, tenants, orders] = await Promise.all([
    prisma.callLog.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true },
    }),
    prisma.tenant.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true },
    }),
    prisma.numberOrder.findMany({
      where: {
        createdAt: { gte: start },
        status: { in: ['FULFILLED', 'PAID', 'PARTIAL'] },
      },
      select: { createdAt: true, totalCharged: true },
    }),
  ]);

  const buckets = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({ date: key, calls: 0, newTenants: 0, revenue: 0 });
  }
  const bucketMap = Object.fromEntries(buckets.map((b) => [b.date, b]));

  for (const call of calls) {
    const key = call.createdAt.toISOString().slice(0, 10);
    if (bucketMap[key]) bucketMap[key].calls += 1;
  }
  for (const tenant of tenants) {
    const key = tenant.createdAt.toISOString().slice(0, 10);
    if (bucketMap[key]) bucketMap[key].newTenants += 1;
  }
  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    if (bucketMap[key]) bucketMap[key].revenue += Number(order.totalCharged || 0);
  }

  return buckets;
}

async function getExecutiveDashboard(prisma) {
  const base = await loadDashboardBase(prisma);
  const timeseries = await loadTimeseries(prisma, 30);
  return {
    ...base,
    timeseries,
    systemAlerts: [
      ...base.billingAlerts.map((a) => ({
        id: a.id,
        type: 'billing',
        message: a.action.replace(/\./g, ' · ').replace(/_/g, ' '),
        createdAt: a.createdAt,
      })),
      ...(base.stats.telnyxConnected
        ? []
        : [{
          id: 'telnyx-offline',
          type: 'carrier',
          message: 'Telnyx connection offline',
          createdAt: new Date().toISOString(),
        }]),
    ],
  };
}

async function getOperationsDashboard(prisma) {
  const base = await loadDashboardBase(prisma);
  const platform = base.platform;
  const [voiceQuality, telemetryFresh] = await Promise.all([
    getVoiceQualityReport(prisma),
    getVoiceTelemetrySummary(prisma, platform, { refreshSip: true }),
  ]);

  return {
    stats: base.stats,
    telnyxStatus: base.telnyxStatus,
    telemetry: telemetryFresh,
    voiceQuality,
  };
}

module.exports = {
  getExecutiveDashboard,
  getOperationsDashboard,
  loadDashboardBase,
};
