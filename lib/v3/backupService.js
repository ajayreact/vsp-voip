/**
 * V3 Backup Service — configuration-only tenant snapshots (no media/recordings).
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');

const BACKUP_VERSION = 1;

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    telnyxSipUsername: user.telnyxSipUsername,
    createdAt: user.createdAt,
  };
}

function sanitizeExtension(ext) {
  const { sipPassword, telnyxSipPassword, ...safe } = ext;
  return safe;
}

async function collectConfiguration(prisma, tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { greeting: true },
  });
  if (!tenant) {
    throw Object.assign(new Error('Organization not found'), { status: 404 });
  }

  const [
    users,
    extensions,
    phoneNumbers,
    deskDevices,
    ringGroups,
    queues,
    businessHours,
    holidays,
    voicemailBoxes,
    callFlows,
    softphoneProfiles,
    userPreferences,
    devicePreferences,
    presenceConfigs,
    featureFlag,
  ] = await Promise.all([
    prisma.user.findMany({ where: { tenantId } }),
    prisma.extension.findMany({ where: { tenantId } }),
    prisma.phoneNumber.findMany({ where: { tenantId } }),
    prisma.v3DeskDevice.findMany({ where: { tenantId, removedAt: null } }),
    prisma.v3RingGroup.findMany({ where: { tenantId, removedAt: null } }),
    prisma.v3Queue.findMany({ where: { tenantId, removedAt: null } }),
    prisma.v3BusinessHoursSchedule.findMany({ where: { tenantId, removedAt: null } }),
    prisma.v3Holiday.findMany({ where: { tenantId, removedAt: null } }),
    prisma.v3VoicemailBox.findMany({ where: { tenantId, removedAt: null } }),
    prisma.v3CallFlow.findMany({ where: { tenantId, removedAt: null } }),
    prisma.v3SoftphoneProfile.findMany({ where: { tenantId } }),
    prisma.v3UserPreference.findMany({ where: { tenantId } }),
    prisma.v3DevicePreference.findMany({ where: { tenantId } }),
    prisma.v3PresenceConfig.findMany({ where: { tenantId } }),
    prisma.v3FeatureFlag.findUnique({ where: { tenantId } }),
  ]);

  const { passwordHash, ...tenantSafe } = tenant;

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tenantId,
    settings: {
      tenant: {
        name: tenantSafe.name,
        contactEmail: tenantSafe.contactEmail,
        timezone: tenantSafe.timezone,
        isActive: tenantSafe.isActive,
      },
      greeting: tenant.greeting || null,
      featureFlag: featureFlag || null,
    },
    employees: users.filter((u) => u.role === 'TENANT_USER').map(sanitizeUser),
    extensions: extensions.map(sanitizeExtension),
    phoneNumbers,
    deskPhones: deskDevices,
    pbx: {
      ringGroups,
      queues,
      businessHours,
      holidays,
      voicemailBoxes,
    },
    callFlows,
    softphone: {
      profiles: softphoneProfiles,
      userPreferences,
      devicePreferences,
      presenceConfigs,
    },
  };
}

function countItems(payload) {
  return {
    employees: payload.employees?.length || 0,
    extensions: payload.extensions?.length || 0,
    phoneNumbers: payload.phoneNumbers?.length || 0,
    deskPhones: payload.deskPhones?.length || 0,
    ringGroups: payload.pbx?.ringGroups?.length || 0,
    queues: payload.pbx?.queues?.length || 0,
    businessHours: payload.pbx?.businessHours?.length || 0,
    holidays: payload.pbx?.holidays?.length || 0,
    voicemailBoxes: payload.pbx?.voicemailBoxes?.length || 0,
    callFlows: payload.callFlows?.length || 0,
    softphoneProfiles: payload.softphone?.profiles?.length || 0,
  };
}

async function listBackups(prisma, tenantId, { limit = 20, offset = 0 } = {}) {
  const where = { tenantId, removedAt: null };
  const [rows, total] = await Promise.all([
    prisma.v3TenantBackup.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        label: true,
        backupType: true,
        status: true,
        itemCounts: true,
        sizeBytes: true,
        createdByUserId: true,
        createdAt: true,
      },
    }),
    prisma.v3TenantBackup.count({ where }),
  ]);
  return { items: rows, total };
}

async function getBackup(prisma, tenantId, backupId) {
  const row = await prisma.v3TenantBackup.findFirst({
    where: { id: backupId, tenantId, removedAt: null },
  });
  if (!row) return null;
  return row;
}

async function createBackup(prisma, tenantId, { label, backupType = 'full' } = {}, { req, actor } = {}) {
  const payload = await collectConfiguration(prisma, tenantId);
  const itemCounts = countItems(payload);
  const json = JSON.stringify(payload);
  const sizeBytes = Buffer.byteLength(json, 'utf8');

  const row = await prisma.v3TenantBackup.create({
    data: {
      id: randomUUID(),
      tenantId,
      label: label || `Backup ${new Date().toISOString()}`,
      backupType,
      status: 'completed',
      payload,
      itemCounts,
      sizeBytes,
      createdByUserId: actor?.sub || req?.user?.sub || null,
    },
  });

  await auditService.log(prisma, req, {
    action: 'v3.backup.created',
    entityType: 'V3TenantBackup',
    entityId: row.id,
    newValue: { itemCounts, sizeBytes, label: row.label },
  });

  return {
    id: row.id,
    label: row.label,
    backupType: row.backupType,
    status: row.status,
    itemCounts: row.itemCounts,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
  };
}

module.exports = {
  BACKUP_VERSION,
  collectConfiguration,
  countItems,
  listBackups,
  getBackup,
  createBackup,
};
