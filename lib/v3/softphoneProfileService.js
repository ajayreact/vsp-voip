/**
 * V3 Softphone Profile Service — UX configuration only (no runtime telephony).
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');

const THEMES = ['system', 'light', 'dark'];
const RECORDING_PREFS = ['inherit', 'always', 'never', 'on_demand'];
const PRESENCE_VISIBILITY = ['everyone', 'team', 'admins', 'nobody'];
const PREFERRED_DEVICES = ['desktop', 'laptop', 'desk_phone', 'mobile', 'tablet'];

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
}

function asSpeedDial(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      slot: Number(entry?.slot) || 0,
      contactId: entry?.contactId ? String(entry.contactId) : null,
      label: entry?.label ? String(entry.label) : null,
      number: entry?.number ? String(entry.number) : null,
    }))
    .filter((e) => e.contactId || e.number);
}

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    preferredCallerId: row.preferredCallerId,
    preferredDevice: row.preferredDevice,
    defaultAudioDevice: row.defaultAudioDevice,
    ringDevice: row.ringDevice,
    theme: row.theme,
    language: row.language,
    timezone: row.timezone,
    callRecordingPreference: row.callRecordingPreference,
    autoAnswer: row.autoAnswer,
    dnd: row.dnd,
    busy: row.busy,
    away: row.away,
    presenceVisibility: row.presenceVisibility,
    favoriteContactIds: asStringArray(row.favoriteContactIds),
    speedDial: asSpeedDial(row.speedDial),
    recentContacts: asStringArray(row.recentContacts),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function defaultProfileData(tenantId, userId) {
  return {
    id: randomUUID(),
    tenantId,
    userId,
    theme: 'system',
    language: 'en',
    callRecordingPreference: 'inherit',
    autoAnswer: false,
    dnd: false,
    busy: false,
    away: false,
    presenceVisibility: 'everyone',
    favoriteContactIds: [],
    speedDial: [],
    recentContacts: [],
  };
}

function validateProfileData(data) {
  const issues = [];
  if (data.theme && !THEMES.includes(data.theme)) {
    issues.push({ severity: 'error', code: 'INVALID_THEME', message: `Invalid theme: ${data.theme}` });
  }
  if (data.callRecordingPreference && !RECORDING_PREFS.includes(data.callRecordingPreference)) {
    issues.push({ severity: 'error', code: 'INVALID_RECORDING', message: 'Invalid call recording preference' });
  }
  if (data.presenceVisibility && !PRESENCE_VISIBILITY.includes(data.presenceVisibility)) {
    issues.push({ severity: 'error', code: 'INVALID_VISIBILITY', message: 'Invalid presence visibility' });
  }
  if (data.preferredDevice && !PREFERRED_DEVICES.includes(data.preferredDevice)) {
    issues.push({ severity: 'error', code: 'INVALID_DEVICE', message: `Invalid preferred device: ${data.preferredDevice}` });
  }
  const errors = issues.filter((i) => i.severity === 'error');
  return { valid: errors.length === 0, issues, errors, warnings: issues.filter((i) => i.severity === 'warning') };
}

async function ensureUserInTenant(prisma, tenantId, userId) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true } });
  if (!user) {
    throw Object.assign(new Error('User not found in tenant'), { status: 404, code: 'USER_NOT_FOUND' });
  }
}

async function getProfileReadOnly(prisma, tenantId, userId) {
  const row = await prisma.v3SoftphoneProfile.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  if (row) return serialize(row);
  return {
    tenantId,
    userId,
    preferredCallerId: null,
    preferredDevice: null,
    defaultAudioDevice: null,
    ringDevice: null,
    theme: 'system',
    language: 'en',
    timezone: null,
    callRecordingPreference: 'inherit',
    autoAnswer: false,
    dnd: false,
    busy: false,
    away: false,
    presenceVisibility: 'everyone',
    favoriteContactIds: [],
    speedDial: [],
    recentContacts: [],
  };
}

async function getOrCreateProfile(prisma, tenantId, userId) {
  await ensureUserInTenant(prisma, tenantId, userId);
  let row = await prisma.v3SoftphoneProfile.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  if (!row) {
    try {
      row = await prisma.v3SoftphoneProfile.create({ data: defaultProfileData(tenantId, userId) });
    } catch (error) {
      if (error.code === 'P2002') {
        row = await prisma.v3SoftphoneProfile.findUnique({
          where: { tenantId_userId: { tenantId, userId } },
        });
      } else {
        throw error;
      }
    }
  }
  return serialize(row);
}

async function updateProfile(prisma, tenantId, userId, data, { req } = {}) {
  await ensureUserInTenant(prisma, tenantId, userId);
  const validation = validateProfileData(data);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Validation failed'), { status: 400, details: validation });
  }

  const existing = await prisma.v3SoftphoneProfile.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });

  const patch = {};
  const fields = [
    'preferredCallerId', 'preferredDevice', 'defaultAudioDevice', 'ringDevice',
    'theme', 'language', 'timezone', 'callRecordingPreference',
    'autoAnswer', 'dnd', 'busy', 'away', 'presenceVisibility',
  ];
  for (const key of fields) {
    if (data[key] !== undefined) patch[key] = data[key];
  }
  if (data.favoriteContactIds !== undefined) patch.favoriteContactIds = asStringArray(data.favoriteContactIds);
  if (data.speedDial !== undefined) patch.speedDial = asSpeedDial(data.speedDial);
  if (data.recentContacts !== undefined) patch.recentContacts = asStringArray(data.recentContacts);

  let row;
  if (existing) {
    row = await prisma.v3SoftphoneProfile.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: patch,
    });
  } else {
    row = await prisma.v3SoftphoneProfile.create({
      data: { ...defaultProfileData(tenantId, userId), ...patch },
    });
  }

  await auditService.log(prisma, req, {
    action: 'v3.profile.updated',
    entityType: 'V3SoftphoneProfile',
    entityId: row.id,
    oldValue: existing ? serialize(existing) : null,
    newValue: serialize(row),
  });

  return serialize(row);
}

async function addFavorite(prisma, tenantId, userId, contactId, { req } = {}) {
  const profile = await getOrCreateProfile(prisma, tenantId, userId);
  const favorites = new Set(profile.favoriteContactIds);
  favorites.add(String(contactId));
  return updateProfile(prisma, tenantId, userId, { favoriteContactIds: [...favorites] }, { req });
}

async function removeFavorite(prisma, tenantId, userId, contactId, { req } = {}) {
  const profile = await getOrCreateProfile(prisma, tenantId, userId);
  const favorites = profile.favoriteContactIds.filter((id) => id !== String(contactId));
  return updateProfile(prisma, tenantId, userId, { favoriteContactIds: favorites }, { req });
}

async function setSpeedDial(prisma, tenantId, userId, speedDial, { req } = {}) {
  return updateProfile(prisma, tenantId, userId, { speedDial }, { req });
}

async function recordRecentContact(prisma, tenantId, userId, contactId, { req, maxRecent = 20 } = {}) {
  const profile = await getOrCreateProfile(prisma, tenantId, userId);
  const id = String(contactId);
  const recent = [id, ...profile.recentContacts.filter((c) => c !== id)].slice(0, maxRecent);
  return updateProfile(prisma, tenantId, userId, { recentContacts: recent }, { req });
}

function isProfileComplete(profile) {
  return Boolean(
    profile?.preferredCallerId
    && profile?.preferredDevice
    && profile?.timezone
    && profile?.language,
  );
}

module.exports = {
  THEMES,
  RECORDING_PREFS,
  PRESENCE_VISIBILITY,
  PREFERRED_DEVICES,
  serialize,
  validateProfileData,
  getProfileReadOnly,
  getOrCreateProfile,
  updateProfile,
  addFavorite,
  removeFavorite,
  setSpeedDial,
  recordRecentContact,
  isProfileComplete,
};
