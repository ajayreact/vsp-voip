/**
 * V3 Dashboard Service — tenant operations dashboard aggregates (read-only).
 */

const healthCheckService = require('./healthCheckService');
const inventoryHealthService = require('./inventoryHealthService');
const deviceHealthService = require('./deviceHealthService');
const pbxHealthService = require('./pbxHealthService');
const softphoneHealthService = require('./softphoneHealthService');
const repairService = require('./repairService');
const deviceRepairService = require('./deviceRepairService');
const analyticsService = require('./analyticsService');

async function countCards(prisma, tenantId) {
  const [
    employees,
    extensions,
    userDevices,
    registeredUsers,
    deskPhones,
    ringGroups,
    queues,
    businessHours,
    holidays,
    voicemailBoxes,
    callFlows,
    softphoneProfiles,
    tenantNumbers,
  ] = await Promise.all([
    prisma.user.count({ where: { tenantId, role: 'TENANT_USER' } }),
    prisma.extension.count({ where: { tenantId, status: 'ACTIVE' } }),
    prisma.userDevice.count({ where: { user: { tenantId } } }),
    prisma.user.count({ where: { tenantId, sipRegistered: true } }),
    prisma.v3DeskDevice.count({ where: { tenantId, removedAt: null } }),
    prisma.v3RingGroup.count({ where: { tenantId, removedAt: null } }),
    prisma.v3Queue.count({ where: { tenantId, removedAt: null } }),
    prisma.v3BusinessHoursSchedule.count({ where: { tenantId, removedAt: null } }),
    prisma.v3Holiday.count({ where: { tenantId, removedAt: null } }),
    prisma.v3VoicemailBox.count({ where: { tenantId, removedAt: null } }),
    prisma.v3CallFlow.count({ where: { tenantId, removedAt: null } }),
    prisma.v3SoftphoneProfile.count({ where: { tenantId } }),
    prisma.phoneNumber.findMany({ where: { tenantId, isActive: { not: false } }, select: { id: true, extensionId: true, assignedUserId: true } }),
  ]);

  const assignedNumbers = tenantNumbers.filter((n) => n.extensionId || n.assignedUserId).length;
  const availableNumbers = tenantNumbers.length - assignedNumbers;

  const registeredDesk = await prisma.v3DeskDevice.count({
    where: { tenantId, removedAt: null, status: 'REGISTERED' },
  });

  return {
    employees,
    extensions,
    activeDevices: deskPhones,
    softphoneDevices: userDevices,
    registeredDevices: registeredUsers + registeredDesk,
    totalNumbers: tenantNumbers.length,
    availableNumbers,
    assignedNumbers,
    deskPhones,
    ringGroups,
    queues,
    businessHours,
    holidays,
    voicemailBoxes,
    callFlows,
    softphoneProfiles,
  };
}

async function getHealthIssues(prisma, tenantId) {
  const [employeeSummary, deviceHealth, pbx, softphone, numberHealth] = await Promise.all([
    healthCheckService.tenantHealthSummary(prisma, tenantId),
    deviceHealthService.listDevicesHealth(prisma, { tenantId }),
    pbxHealthService.pbxObjectsHealth(prisma, tenantId),
    softphoneHealthService.softphoneUxHealth(prisma, tenantId),
    inventoryHealthService.listNumbersHealth(prisma, { tenantId, limit: 500 }),
  ]);

  return {
    employees: employeeSummary.errors + employeeSummary.warnings,
    devices: deviceHealth.summary.warnings + deviceHealth.summary.errors,
    numbers: numberHealth.summary.warnings + numberHealth.summary.errors,
    pbx: pbx.summary.warnings + pbx.summary.errors,
    softphone: softphone.summary.warnings + softphone.summary.errors,
    total:
      employeeSummary.errors + employeeSummary.warnings
      + deviceHealth.summary.warnings + deviceHealth.summary.errors
      + numberHealth.summary.warnings + numberHealth.summary.errors
      + pbx.summary.warnings + pbx.summary.errors
      + softphone.summary.warnings + softphone.summary.errors,
  };
}

async function getRepairRecommendations(prisma, tenantId) {
  const [pbxRepair, deviceRepair] = await Promise.all([
    repairService.inspect(prisma, tenantId),
    deviceRepairService.inspectDevices(prisma, tenantId),
  ]);
  return {
    pbx: pbxRepair.changes.length,
    devices: deviceRepair.changes?.length || 0,
    total: pbxRepair.changes.length + (deviceRepair.changes?.length || 0),
    items: [
      ...pbxRepair.changes.slice(0, 10).map((c) => ({ source: 'pbx', ...c })),
      ...(deviceRepair.changes || []).slice(0, 10).map((c) => ({ source: 'device', ...c })),
    ],
  };
}

async function getDashboardSummary(prisma, tenantId) {
  const [cards, healthIssues, repairRecommendations] = await Promise.all([
    countCards(prisma, tenantId),
    getHealthIssues(prisma, tenantId),
    getRepairRecommendations(prisma, tenantId),
  ]);
  return { cards, healthIssues, repairRecommendations, generatedAt: new Date().toISOString() };
}

async function getDashboardCharts(prisma, tenantId) {
  return analyticsService.getCharts(prisma, tenantId);
}

async function getDashboard(prisma, tenantId) {
  const [summary, charts] = await Promise.all([
    getDashboardSummary(prisma, tenantId),
    getDashboardCharts(prisma, tenantId),
  ]);
  return { ...summary, charts };
}

module.exports = {
  countCards,
  getHealthIssues,
  getRepairRecommendations,
  getDashboardSummary,
  getDashboardCharts,
  getDashboard,
};
