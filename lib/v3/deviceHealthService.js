/**
 * V3 Device Health Service — per-device green/yellow/red readiness matrix.
 */

const deviceService = require('./deviceService');
const telnyxService = require('./telnyxService');
const deviceTemplateService = require('./deviceTemplateService');

const ORDER = { green: 0, yellow: 1, red: 2 };

function worst(...levels) {
  return levels.reduce((acc, l) => (ORDER[l] > ORDER[acc] ? l : acc), 'green');
}

function level(bool, falseLevel = 'red') {
  return bool ? 'green' : falseLevel;
}

function buildDeviceHealth(item, readiness) {
  const reasons = [];
  const hasExtension = Boolean(item.extensionId);
  const hasEmployee = Boolean(item.employeeId);
  const hasCredential = Boolean(item.sipUsername);
  const provisioned = item.status === 'PROVISIONED' || item.status === 'REGISTERED' || Boolean(item.lastProvisionedAt);
  const vendorOk = deviceTemplateService.SUPPORTED_VENDORS.includes(String(item.vendor || '').toLowerCase());
  const provisionUrlOk = Boolean(item.provisionUrl);

  let registrationLevel = 'red';
  if (item.registrationStatus === 'registered') {
    registrationLevel = 'green';
  } else if (item.registrationStatus === 'offline') {
    registrationLevel = 'yellow';
    reasons.push('Provisioned but not currently registered');
  } else {
    reasons.push('Device has never registered with SIP');
  }

  if (!hasExtension) reasons.push('Missing extension assignment');
  if (!hasEmployee) reasons.push('Missing employee assignment');
  if (!hasCredential) reasons.push('Missing SIP credential');
  if (!vendorOk) reasons.push('Unsupported or wrong vendor template');
  if (provisioned && !provisionUrlOk) reasons.push('Provision URL missing');

  const checks = {
    inventoryStatus: item.status === 'REMOVED' ? 'red' : (item.status === 'CREATED' ? 'yellow' : 'green'),
    extensionLinked: hasExtension ? 'green' : 'red',
    employeeLinked: hasEmployee ? 'green' : (hasExtension ? 'yellow' : 'red'),
    credentialReady: hasCredential ? 'green' : 'red',
    provisionReady: provisioned ? 'green' : 'yellow',
    vendorTemplate: vendorOk ? 'green' : 'red',
    provisionUrl: provisionUrlOk || !provisioned ? (provisionUrlOk ? 'green' : 'yellow') : 'red',
    registration: registrationLevel,
    callControlReady: level(readiness.callControlReady),
    webhookReady: level(readiness.webhookReady),
  };

  const overall = worst(...Object.values(checks));

  return {
    deviceId: item.id,
    macAddress: item.macAddress,
    vendor: item.vendor,
    model: item.model,
    extensionNumber: item.extensionNumber,
    employeeName: item.employeeName,
    status: item.status,
    registrationStatus: item.registrationStatus,
    overall,
    checks,
    reasons,
    firmwareVersion: item.firmwareVersion,
    lastRegistrationAt: item.lastRegistrationAt,
    lastSeenAt: item.lastSeenAt,
    lastProvisionedAt: item.lastProvisionedAt,
    provisionVersion: item.provisionVersion,
    configVersion: item.configVersion,
  };
}

async function getDeviceHealth(prisma, tenantId, deviceId) {
  const readiness = await telnyxService.getTenantTelephonyReadiness(prisma);
  const item = await deviceService.getDevice(prisma, tenantId, deviceId);
  if (!item) return null;
  return buildDeviceHealth(item, readiness);
}

async function listDevicesHealth(prisma, { tenantId, limit = 100 } = {}) {
  const readiness = await telnyxService.getTenantTelephonyReadiness(prisma);
  const { items } = await deviceService.listDevices(prisma, tenantId, { limit });
  const devices = items.map((item) => buildDeviceHealth(item, readiness));

  const summary = {
    total: devices.length,
    registered: devices.filter((d) => d.registrationStatus === 'registered').length,
    offline: devices.filter((d) => d.registrationStatus === 'offline').length,
    neverRegistered: devices.filter((d) => d.registrationStatus === 'never').length,
    ready: devices.filter((d) => d.overall === 'green').length,
    warnings: devices.filter((d) => d.overall === 'yellow').length,
    errors: devices.filter((d) => d.overall === 'red').length,
  };

  return { devices, summary, readiness };
}

module.exports = {
  buildDeviceHealth,
  getDeviceHealth,
  listDevicesHealth,
};
