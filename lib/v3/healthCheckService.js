/**
 * V3 HealthCheckService.
 *
 * Computes per-employee telephony readiness as green / yellow / red across the
 * fields that determine whether an employee can place and receive calls, plus a
 * tenant-level summary for the Health Center header. Read-only: it only reads the
 * DB and tenant-global Telnyx readiness (via TelnyxService) and never mutates.
 *
 * Status legend:
 *   green  = ready
 *   yellow = usable but not fully live (e.g. device not registered yet)
 *   red    = blocking (missing extension / credential / SIP identity, or tenant
 *            Telnyx not configured)
 */

const telnyxService = require('./telnyxService');

const ORDER = { green: 0, yellow: 1, red: 2 };

function worst(...levels) {
  return levels.reduce((acc, level) => (ORDER[level] > ORDER[acc] ? level : acc), 'green');
}

function level(bool, falseLevel = 'red') {
  return bool ? 'green' : falseLevel;
}

function buildEmployeeStatus(user, readiness, deskPhoneByEmployee = new Map()) {
  const ext = user.extensions?.[0] || null;
  const hasExtension = Boolean(ext);
  const hasCredential = Boolean(user.telnyxCredentialId);
  const hasSipUsername = Boolean(user.telnyxSipUsername);
  const registered = user.sipRegistered === true;
  const hasDeskPhone = deskPhoneByEmployee.has(user.id)
    || (ext?.id && deskPhoneByEmployee.has(`ext:${ext.id}`));
  const hasSoftphoneDevice = (user.devices?.length || 0) > 0;
  const hasDevice = hasDeskPhone || hasSoftphoneDevice || registered;
  const hasDid = Boolean(ext?.primaryPhoneNumberId) || (user.assignedNumbers?.length || 0) > 0;
  const webrtcEnabled = ext ? ext.webrtcEnabled !== false : false;

  const checks = {
    employee: 'green',
    extension: level(hasExtension),
    credential: level(hasCredential),
    sipUsername: level(hasSipUsername),
    device: hasDevice ? 'green' : 'yellow',
    registration: registered ? 'green' : 'yellow',
    did: hasDid ? 'green' : 'yellow',
    webhookReady: level(readiness.webhookReady),
    callControlReady: level(readiness.callControlReady),
    softphoneReady: (webrtcEnabled && hasCredential) ? 'green' : 'yellow',
  };

  return {
    employeeId: user.id,
    name: user.name,
    email: user.email,
    extensionId: ext?.id || null,
    extensionNumber: ext?.extensionNumber || null,
    sipUsername: user.telnyxSipUsername || null,
    did: ext?.primaryPhoneNumber?.number || user.assignedNumbers?.[0]?.number || null,
    overall: worst(...Object.values(checks)),
    checks,
  };
}

async function employeeHealth(prisma, tenantId, employeeId = null) {
  const readiness = await telnyxService.getTenantTelephonyReadiness(prisma);

  const [users, deskPhones] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenantId,
        role: 'TENANT_USER',
        ...(employeeId ? { id: employeeId } : {}),
      },
      include: {
        extensions: { include: { primaryPhoneNumber: true } },
        devices: true,
        assignedNumbers: { select: { id: true, number: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.v3DeskDevice.findMany({
      where: {
        tenantId,
        status: { not: 'REMOVED' },
        ...(employeeId ? { employeeId } : {}),
      },
      select: { employeeId: true, extensionId: true },
    }),
  ]);

  const deskPhoneByEmployee = new Map();
  for (const phone of deskPhones) {
    if (phone.employeeId) deskPhoneByEmployee.set(phone.employeeId, true);
    if (phone.extensionId) deskPhoneByEmployee.set(`ext:${phone.extensionId}`, true);
  }

  const employees = users.map((user) => buildEmployeeStatus(user, readiness, deskPhoneByEmployee));
  return { employees, readiness };
}

async function tenantHealthSummary(prisma, tenantId) {
  const { employees, readiness } = await employeeHealth(prisma, tenantId);
  return {
    totalEmployees: employees.length,
    ready: employees.filter((e) => e.overall === 'green').length,
    warnings: employees.filter((e) => e.overall === 'yellow').length,
    errors: employees.filter((e) => e.overall === 'red').length,
    registeredSip: employees.filter((e) => e.checks.registration === 'green').length,
    unregisteredSip: employees.filter((e) => e.checks.registration !== 'green').length,
    readiness,
  };
}

module.exports = { employeeHealth, tenantHealthSummary, buildEmployeeStatus };
