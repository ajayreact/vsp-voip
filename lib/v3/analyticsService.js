/**
 * V3 Analytics Service — read-only chart data from existing DB records.
 */

const healthCheckService = require('./healthCheckService');
const deviceHealthService = require('./deviceHealthService');
const pbxHealthService = require('./pbxHealthService');
const softphoneHealthService = require('./softphoneHealthService');
const inventoryHealthService = require('./inventoryHealthService');

function monthKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function buildMonthlySeries(rows, months = 6) {
  const now = new Date();
  const keys = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  const counts = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const row of rows) {
    const k = monthKey(row.createdAt);
    if (counts[k] !== undefined) counts[k] += 1;
  }
  let cumulative = 0;
  return keys.map((label) => {
    cumulative += counts[label];
    return { label, count: counts[label], cumulative };
  });
}

function groupCount(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item) || 'Unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function scoreFromSummary(summary) {
  const total = summary.total || summary.totalEmployees || 0;
  if (!total) return 100;
  const ready = summary.ready || 0;
  return Math.round((ready / total) * 100);
}

async function getCharts(prisma, tenantId) {
  const [
    employees,
    extensions,
    deskDevices,
    devicePrefs,
    numbers,
    presenceRows,
    employeeHealth,
    deviceHealth,
    pbxHealth,
    softphoneHealth,
    numberHealth,
  ] = await Promise.all([
    prisma.user.findMany({ where: { tenantId, role: 'TENANT_USER' }, select: { id: true, createdAt: true, telnyxCredentialId: true } }),
    prisma.extension.findMany({ where: { tenantId, status: 'ACTIVE' }, select: { id: true, createdAt: true, department: true } }),
    prisma.v3DeskDevice.findMany({ where: { tenantId, removedAt: null }, select: { vendor: true, model: true } }),
    prisma.v3DevicePreference.findMany({ where: { tenantId }, select: { deviceType: true } }),
    prisma.phoneNumber.findMany({ where: { tenantId }, select: { id: true, extensionId: true, assignedUserId: true } }),
    prisma.v3PresenceConfig.findMany({ where: { tenantId }, select: { status: true } }),
    healthCheckService.tenantHealthSummary(prisma, tenantId),
    deviceHealthService.listDevicesHealth(prisma, { tenantId }),
    pbxHealthService.pbxObjectsHealth(prisma, tenantId),
    softphoneHealthService.softphoneUxHealth(prisma, tenantId),
    inventoryHealthService.listNumbersHealth(prisma, { tenantId, limit: 500 }),
  ]);

  const provisioned = employees.filter((e) => e.telnyxCredentialId).length;
  const assignedDids = numbers.filter((n) => n.extensionId || n.assignedUserId).length;

  const deviceTypeMap = groupCount(devicePrefs, (d) => d.deviceType);
  for (const desk of deskDevices) {
    const type = 'desk_phone';
    const existing = deviceTypeMap.find((d) => d.label === type);
    if (existing) existing.value += 1;
    else deviceTypeMap.push({ label: type, value: 1 });
  }

  return {
    employeeGrowth: buildMonthlySeries(employees),
    extensionGrowth: buildMonthlySeries(extensions),
    deviceTypes: deviceTypeMap,
    vendorDistribution: groupCount(deskDevices, (d) => d.vendor),
    phoneModelDistribution: groupCount(deskDevices, (d) => d.model || 'Unknown'),
    didUsage: [
      { label: 'Assigned', value: assignedDids },
      { label: 'Unassigned', value: numbers.length - assignedDids },
    ],
    provisioningSuccess: [
      { label: 'Provisioned', value: provisioned },
      { label: 'Pending', value: employees.length - provisioned },
    ],
    healthScore: {
      overall: Math.round((
        scoreFromSummary(employeeHealth)
        + scoreFromSummary(deviceHealth.summary)
        + scoreFromSummary(pbxHealth.summary)
        + scoreFromSummary(softphoneHealth.summary)
        + scoreFromSummary(numberHealth.summary)
      ) / 5),
      employees: scoreFromSummary(employeeHealth),
      devices: scoreFromSummary(deviceHealth.summary),
      pbx: scoreFromSummary(pbxHealth.summary),
      softphone: scoreFromSummary(softphoneHealth.summary),
      numbers: scoreFromSummary(numberHealth.summary),
    },
    presenceDistribution: groupCount(presenceRows, (p) => p.status),
    departmentDistribution: groupCount(extensions, (e) => e.department),
  };
}

async function getAnalytics(prisma, tenantId) {
  const charts = await getCharts(prisma, tenantId);
  return { charts, generatedAt: new Date().toISOString() };
}

module.exports = {
  monthKey,
  buildMonthlySeries,
  groupCount,
  getCharts,
  getAnalytics,
};
