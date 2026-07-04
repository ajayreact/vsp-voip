/**
 * V3 Notification Center Service — configuration-only alerts (no runtime push).
 */

const healthCheckService = require('./healthCheckService');
const deviceHealthService = require('./deviceHealthService');
const inventoryHealthService = require('./inventoryHealthService');
const pbxHealthService = require('./pbxHealthService');
const softphoneHealthService = require('./softphoneHealthService');
const repairService = require('./repairService');
const deviceRepairService = require('./deviceRepairService');

function makeNotification({ id, severity, category, title, message, source, actionable = false }) {
  return { id, severity, category, title, message, source, actionable, readOnly: true };
}

async function getNotifications(prisma, tenantId) {
  const [
    tenant,
    employeeSummary,
    employeeHealth,
    deviceHealth,
    numberHealth,
    pbxHealth,
    softphoneHealth,
    pbxRepair,
    deviceRepair,
  ] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { maxUsers: true, maxPhoneNumbers: true, name: true } }),
    healthCheckService.tenantHealthSummary(prisma, tenantId),
    healthCheckService.employeeHealth(prisma, tenantId),
    deviceHealthService.listDevicesHealth(prisma, { tenantId }),
    inventoryHealthService.listNumbersHealth(prisma, { tenantId, limit: 500 }),
    pbxHealthService.pbxObjectsHealth(prisma, tenantId),
    softphoneHealthService.softphoneUxHealth(prisma, tenantId),
    repairService.inspect(prisma, tenantId),
    deviceRepairService.inspectDevices(prisma, tenantId),
  ]);

  const notifications = [];

  if (employeeSummary.errors > 0) {
    notifications.push(makeNotification({
      id: 'health-employees-errors',
      severity: 'error',
      category: 'health_alert',
      title: 'Employee health issues',
      message: `${employeeSummary.errors} employee(s) have blocking telephony configuration issues.`,
      source: 'employee_health',
      actionable: true,
    }));
  }
  if (employeeSummary.warnings > 0) {
    notifications.push(makeNotification({
      id: 'health-employees-warnings',
      severity: 'warning',
      category: 'health_alert',
      title: 'Employee warnings',
      message: `${employeeSummary.warnings} employee(s) need attention before full readiness.`,
      source: 'employee_health',
    }));
  }

  for (const emp of employeeHealth.employees.filter((e) => !e.checks.credential || e.checks.credential === 'red')) {
    notifications.push(makeNotification({
      id: `missing-credential-${emp.employeeId}`,
      severity: 'error',
      category: 'provisioning',
      title: 'Missing credentials',
      message: `${emp.name} is missing Telnyx credentials.`,
      source: 'provisioning',
      actionable: true,
    }));
  }

  for (const emp of employeeHealth.employees.filter((e) => e.checks.registration !== 'green')) {
    notifications.push(makeNotification({
      id: `unregistered-${emp.employeeId}`,
      severity: 'warning',
      category: 'device',
      title: 'Unregistered device',
      message: `${emp.name} is not registered for SIP.`,
      source: 'registration',
    }));
  }

  if (deviceHealth.summary.errors > 0 || deviceHealth.summary.warnings > 0) {
    notifications.push(makeNotification({
      id: 'desk-device-health',
      severity: deviceHealth.summary.errors > 0 ? 'error' : 'warning',
      category: 'health_alert',
      title: 'Desk phone health',
      message: `${deviceHealth.summary.errors} error(s) and ${deviceHealth.summary.warnings} warning(s) across desk phones.`,
      source: 'device_health',
    }));
  }

  if (numberHealth.summary.errors > 0 || numberHealth.summary.warnings > 0) {
    notifications.push(makeNotification({
      id: 'number-health',
      severity: numberHealth.summary.errors > 0 ? 'error' : 'warning',
      category: 'health_alert',
      title: 'Number inventory health',
      message: `${numberHealth.summary.errors + numberHealth.summary.warnings} number(s) need review.`,
      source: 'number_health',
    }));
  }

  if (pbxHealth.summary.errors > 0) {
    notifications.push(makeNotification({
      id: 'pbx-health-errors',
      severity: 'error',
      category: 'health_alert',
      title: 'PBX configuration errors',
      message: `${pbxHealth.summary.errors} PBX object(s) have blocking validation issues.`,
      source: 'pbx_health',
    }));
  }

  if (softphoneHealth.summary.warnings > 0) {
    notifications.push(makeNotification({
      id: 'softphone-ux-warnings',
      severity: 'warning',
      category: 'health_alert',
      title: 'Softphone profile incomplete',
      message: `${softphoneHealth.summary.warnings} user profile(s) are incomplete.`,
      source: 'softphone_health',
    }));
  }

  for (const change of pbxRepair.changes.slice(0, 10)) {
    notifications.push(makeNotification({
      id: `repair-pbx-${change.type}-${change.ref}`,
      severity: 'warning',
      category: 'repair_suggestion',
      title: 'PBX repair suggestion',
      message: `${change.type}: ${change.detail} (${change.ref})`,
      source: 'pbx_repair',
      actionable: true,
    }));
  }

  for (const change of (deviceRepair.changes || []).slice(0, 10)) {
    notifications.push(makeNotification({
      id: `repair-device-${change.type}-${change.ref}`,
      severity: 'warning',
      category: 'repair_suggestion',
      title: 'Device repair suggestion',
      message: `${change.type}: ${change.detail} (${change.ref})`,
      source: 'device_repair',
      actionable: true,
    }));
  }

  if (tenant?.maxUsers && employeeSummary.totalEmployees >= tenant.maxUsers) {
    notifications.push(makeNotification({
      id: 'license-users',
      severity: 'warning',
      category: 'license',
      title: 'User license limit',
      message: `Tenant has ${employeeSummary.totalEmployees} employees (limit ${tenant.maxUsers}).`,
      source: 'license',
    }));
  }

  if (tenant?.maxPhoneNumbers) {
    const numberCount = numberHealth.summary.total;
    if (numberCount >= tenant.maxPhoneNumbers) {
      notifications.push(makeNotification({
        id: 'license-numbers',
        severity: 'warning',
        category: 'license',
        title: 'Number license limit',
        message: `Tenant has ${numberCount} numbers (limit ${tenant.maxPhoneNumbers}).`,
        source: 'license',
      }));
    }
  }

  const summary = {
    total: notifications.length,
    errors: notifications.filter((n) => n.severity === 'error').length,
    warnings: notifications.filter((n) => n.severity === 'warning').length,
    info: notifications.filter((n) => n.severity === 'info').length,
  };

  return { notifications, summary, generatedAt: new Date().toISOString() };
}

module.exports = {
  getNotifications,
  makeNotification,
};
