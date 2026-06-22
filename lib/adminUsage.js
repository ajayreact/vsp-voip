const { loadPlatformSettings } = require('./platformSettings');
const { getQuotaReport, resolveQuotaLimit } = require('./adminModules');

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

async function getTenantUsageReport(prisma) {
  const platform = await loadPlatformSettings(prisma);
  const quotaReport = await getQuotaReport(prisma, platform);
  const todayStart = startOfDay(new Date());

  const tenantIds = quotaReport.tenants.map((t) => t.id);

  const [callsTodayRows, smsTodayRows, minutesRows, allPhoneNumbers] = await Promise.all([
    prisma.callLog.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: tenantIds }, createdAt: { gte: todayStart } },
      _count: { _all: true },
    }),
    prisma.smsMessage.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: tenantIds }, createdAt: { gte: todayStart } },
      _count: { _all: true },
    }),
    prisma.callLog.groupBy({
      by: ['tenantId'],
      where: {
        tenantId: { in: tenantIds },
        createdAt: { gte: todayStart },
        durationSeconds: { not: null },
      },
      _sum: { durationSeconds: true },
    }),
    prisma.phoneNumber.findMany({
      where: { tenantId: { in: tenantIds }, isActive: true },
      select: { tenantId: true, tenantMonthlyTotal: true, platformMonthly: true },
    }),
  ]);

  const callsMap = Object.fromEntries(
    callsTodayRows.filter((r) => r.tenantId).map((r) => [r.tenantId, r._count._all]),
  );
  const smsMap = Object.fromEntries(smsTodayRows.map((r) => [r.tenantId, r._count._all]));
  const minutesMap = Object.fromEntries(
    minutesRows.filter((r) => r.tenantId).map((r) => [r.tenantId, r._sum.durationSeconds || 0]),
  );
  const pricingMap = {};
  for (const row of allPhoneNumbers) {
    const add = Number(row.tenantMonthlyTotal ?? row.platformMonthly ?? platform.defaultFeeMonthly ?? 8);
    pricingMap[row.tenantId] = (pricingMap[row.tenantId] || 0) + add;
  }

  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: {
      id: true,
      platformFeeMonthly: true,
    },
  });
  const feeMap = Object.fromEntries(
    tenants.map((t) => [t.id, Number(t.platformFeeMonthly ?? platform.defaultFeeMonthly ?? 8)]),
  );

  return {
    defaults: quotaReport.defaults,
    tenants: quotaReport.tenants.map((tenant) => {
      const callsToday = callsMap[tenant.id] || 0;
      const smsToday = smsMap[tenant.id] || 0;
      const minutesUsedToday = Math.round((minutesMap[tenant.id] || 0) / 60);
      const numberMrc = pricingMap[tenant.id] || 0;
      const platformFee = feeMap[tenant.id] || 0;
      const monthlyCostEstimate = Math.round((numberMrc + platformFee) * 100) / 100;

      return {
        ...tenant,
        callsToday,
        smsToday,
        minutesUsedToday,
        currentPlan: 'Custom',
        monthlyCostEstimate,
      };
    }),
  };
}

module.exports = {
  getTenantUsageReport,
};
