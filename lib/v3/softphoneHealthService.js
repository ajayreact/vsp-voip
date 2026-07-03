/**
 * V3 Softphone UX Health — profile, device, presence, directory readiness.
 */

const softphoneProfileService = require('./softphoneProfileService');
const devicePreferenceService = require('./devicePreferenceService');
const presenceService = require('./presenceService');
const contactDirectoryService = require('./contactDirectoryService');

const ORDER = { green: 0, yellow: 1, red: 2 };

function worst(...levels) {
  return levels.reduce((acc, l) => (ORDER[l] > ORDER[acc] ? l : acc), 'green');
}

async function userUxHealth(prisma, tenantId, userId, directoryHealth) {
  const [profile, devices, presence] = await Promise.all([
    softphoneProfileService.getProfileReadOnly(prisma, tenantId, userId),
    devicePreferenceService.listDevicePreferences(prisma, tenantId, userId),
    presenceService.getPresence(prisma, tenantId, userId),
  ]);
  const directory = directoryHealth || await contactDirectoryService.directorySyncHealth(prisma, tenantId);

  const preferredDeviceRow = devices.items.find((d) => d.preferred);
  const checks = {
    profileComplete: softphoneProfileService.isProfileComplete(profile) ? 'green' : 'yellow',
    preferredDevice: profile.preferredDevice ? 'green' : 'yellow',
    callerId: profile.preferredCallerId ? 'green' : 'yellow',
    deviceAssignment: preferredDeviceRow || devices.items.length > 0 ? 'green' : 'yellow',
    presenceConfig: presence.status ? 'green' : 'yellow',
    directorySync: directory.synced ? 'green' : 'yellow',
  };

  return {
    userId,
    profile,
    presence,
    deviceCount: devices.items.length,
    preferredDevice: preferredDeviceRow || null,
    overall: worst(...Object.values(checks)),
    checks,
    directory,
  };
}

async function softphoneUxHealth(prisma, tenantId) {
  const users = await prisma.user.findMany({
    where: { tenantId, role: 'TENANT_USER' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });

  const directory = await contactDirectoryService.directorySyncHealth(prisma, tenantId);
  const userHealth = await Promise.all(users.map((u) => userUxHealth(prisma, tenantId, u.id, directory)));

  const all = userHealth.map((h) => h.overall);
  return {
    users: userHealth.map((h) => ({
      userId: h.userId,
      overall: h.overall,
      checks: h.checks,
      preferredDevice: h.profile.preferredDevice,
      callerId: h.profile.preferredCallerId,
      presenceStatus: h.presence.status,
    })),
    directory,
    summary: {
      total: users.length,
      ready: all.filter((l) => l === 'green').length,
      warnings: all.filter((l) => l === 'yellow').length,
      errors: all.filter((l) => l === 'red').length,
    },
  };
}

module.exports = {
  userUxHealth,
  softphoneUxHealth,
};
