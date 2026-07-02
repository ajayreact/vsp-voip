/**
 * V3 Contact Directory Service — searchable company directory (read-only on employees).
 */

const softphoneProfileService = require('./softphoneProfileService');

function normalizeSearch(term) {
  return String(term || '').trim().toLowerCase();
}

function matchesContact(entry, term) {
  if (!term) return true;
  const haystack = [
    entry.name,
    entry.email,
    entry.extensionNumber,
    entry.department,
    entry.did,
    entry.deviceLabel,
    entry.userId,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(term);
}

async function buildDirectoryEntries(prisma, tenantId) {
  const [users, extensions, deskDevices] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.extension.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: {
        id: true,
        userId: true,
        extensionNumber: true,
        displayName: true,
        department: true,
        email: true,
        primaryPhoneNumber: { select: { number: true } },
      },
    }),
    prisma.v3DeskDevice.findMany({
      where: { tenantId, removedAt: null },
      select: {
        id: true,
        employeeId: true,
        extensionId: true,
        vendor: true,
        model: true,
        macAddress: true,
      },
    }),
  ]);

  const extByUser = new Map();
  for (const ext of extensions) {
    if (ext.userId) extByUser.set(ext.userId, ext);
  }

  const deskByUser = new Map();
  for (const device of deskDevices) {
    if (device.employeeId) {
      deskByUser.set(device.employeeId, device);
    } else if (device.extensionId) {
      const ext = extensions.find((e) => e.id === device.extensionId);
      if (ext?.userId) deskByUser.set(ext.userId, device);
    }
  }

  return users.map((user) => {
    const ext = extByUser.get(user.id);
    const desk = deskByUser.get(user.id);
    const deviceLabel = desk
      ? [desk.vendor, desk.model, desk.macAddress].filter(Boolean).join(' ')
      : null;
    return {
      contactId: user.id,
      userId: user.id,
      name: ext?.displayName || user.name,
      email: ext?.email || user.email,
      role: user.role,
      extensionId: ext?.id || null,
      extensionNumber: ext?.extensionNumber || null,
      department: ext?.department || null,
      did: ext?.primaryPhoneNumber?.number || null,
      deviceLabel,
      deskDeviceId: desk?.id || null,
    };
  });
}

async function searchDirectory(prisma, tenantId, {
  search,
  department,
  limit = 50,
  offset = 0,
  favoritesOnly = false,
  recentOnly = false,
  userId = null,
} = {}) {
  const term = normalizeSearch(search);
  let entries = await buildDirectoryEntries(prisma, tenantId);

  if (department) {
    const dept = normalizeSearch(department);
    entries = entries.filter((e) => normalizeSearch(e.department).includes(dept));
  }

  if (term) {
    entries = entries.filter((e) => matchesContact(e, term));
  }

  let favorites = [];
  let recent = [];
  let speedDial = [];

  if (userId) {
    const profile = await softphoneProfileService.getOrCreateProfile(prisma, tenantId, userId);
    favorites = profile.favoriteContactIds;
    recent = profile.recentContacts;
    speedDial = profile.speedDial;

    if (favoritesOnly) {
      const favSet = new Set(favorites);
      entries = entries.filter((e) => favSet.has(e.contactId));
    }
    if (recentOnly) {
      const order = new Map(recent.map((id, idx) => [id, idx]));
      entries = entries.filter((e) => order.has(e.contactId));
      entries.sort((a, b) => (order.get(a.contactId) ?? 999) - (order.get(b.contactId) ?? 999));
    }
  }

  const total = entries.length;
  const items = entries.slice(offset, offset + limit);

  const favoriteSet = new Set(favorites);
  const enriched = items.map((entry) => ({
    ...entry,
    isFavorite: favoriteSet.has(entry.contactId),
  }));

  return {
    items: enriched,
    total,
    favorites: favorites.length,
    recent: recent.length,
    speedDial,
  };
}

async function getDirectoryContact(prisma, tenantId, contactId) {
  const entries = await buildDirectoryEntries(prisma, tenantId);
  return entries.find((e) => e.contactId === contactId) || null;
}

async function directorySyncHealth(prisma, tenantId) {
  const users = await prisma.user.count({ where: { tenantId } });
  const extensions = await prisma.extension.count({ where: { tenantId, status: 'ACTIVE' } });
  const withExtension = await prisma.extension.count({ where: { tenantId, status: 'ACTIVE', userId: { not: null } } });
  return {
    userCount: users,
    extensionCount: extensions,
    linkedCount: withExtension,
    synced: users > 0 && withExtension >= Math.min(users, extensions),
  };
}

module.exports = {
  buildDirectoryEntries,
  searchDirectory,
  getDirectoryContact,
  directorySyncHealth,
};
