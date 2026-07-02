import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const contactDirectoryService = require('../../lib/v3/contactDirectoryService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const softphoneProfileService = require('../../lib/v3/softphoneProfileService.js');

function fakePrisma(store: {
  users: any[];
  extensions: any[];
  deskDevices: any[];
  profiles: any[];
}) {
  return {
    user: {
      findMany: vi.fn(async ({ where }: any) => store.users.filter((u) => u.tenantId === where.tenantId)),
      count: vi.fn(async ({ where }: any) => store.users.filter((u) => u.tenantId === where.tenantId).length),
      findFirst: vi.fn(async ({ where }: any) => store.users.find((u) => u.id === where.id && u.tenantId === where.tenantId) || null),
    },
    extension: {
      findMany: vi.fn(async ({ where }: any) => store.extensions.filter((e) => e.tenantId === where.tenantId && e.status === where.status)),
      count: vi.fn(async ({ where }: any) => {
        let rows = store.extensions.filter((e) => e.tenantId === where.tenantId);
        if (where.status) rows = rows.filter((e) => e.status === where.status);
        if (where.userId?.not === null) rows = rows.filter((e) => e.userId);
        return rows.length;
      }),
    },
    v3DeskDevice: {
      findMany: vi.fn(async ({ where }: any) => store.deskDevices.filter((d) => d.tenantId === where.tenantId && !d.removedAt)),
    },
    v3SoftphoneProfile: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where.tenantId_userId;
        return store.profiles.find((p) => p.tenantId === key.tenantId && p.userId === key.userId) || null;
      }),
      create: vi.fn(async ({ data }: any) => {
        store.profiles.push(data);
        return data;
      }),
    },
  };
}

describe('V3 contactDirectoryService', () => {
  beforeEach(() => vi.restoreAllMocks());

  const baseStore = () => ({
    users: [
      { id: 'u1', tenantId: 't1', name: 'Alice', email: 'alice@example.com', role: 'TENANT_ADMIN' },
      { id: 'u2', tenantId: 't1', name: 'Bob', email: 'bob@example.com', role: 'TENANT_USER' },
    ],
    extensions: [
      {
        id: 'e1', tenantId: 't1', userId: 'u1', extensionNumber: '101', displayName: 'Alice Sales',
        department: 'Sales', status: 'ACTIVE', email: 'alice@example.com', primaryPhoneNumber: { number: '+1555100101' },
      },
      {
        id: 'e2', tenantId: 't1', userId: 'u2', extensionNumber: '102', displayName: 'Bob Support',
        department: 'Support', status: 'ACTIVE', email: 'bob@example.com', primaryPhoneNumber: null,
      },
    ],
    deskDevices: [
      { id: 'dd1', tenantId: 't1', employeeId: 'u1', extensionId: 'e1', vendor: 'Yealink', model: 'T46', macAddress: 'AA:BB', removedAt: null },
    ],
    profiles: [{
      id: 'p1', tenantId: 't1', userId: 'u1', theme: 'system', language: 'en',
      callRecordingPreference: 'inherit', autoAnswer: false, dnd: false, busy: false, away: false,
      presenceVisibility: 'everyone', favoriteContactIds: ['u2'], speedDial: [{ slot: 1, contactId: 'u2', label: 'Bob', number: null }],
      recentContacts: ['u2'],
    }],
  });

  it('searches directory by name and department', async () => {
    const store = baseStore();
    const prisma = fakePrisma(store);
    vi.spyOn(softphoneProfileService, 'getOrCreateProfile').mockImplementation(async () => ({
      favoriteContactIds: [], speedDial: [], recentContacts: [],
    }));

    const byName = await contactDirectoryService.searchDirectory(prisma, 't1', { search: 'alice' });
    expect(byName.items).toHaveLength(1);
    expect(byName.items[0].extensionNumber).toBe('101');

    const byDept = await contactDirectoryService.searchDirectory(prisma, 't1', { department: 'support' });
    expect(byDept.items).toHaveLength(1);
    expect(byDept.items[0].name).toContain('Bob');
  });

  it('returns favorites and speed dial for user', async () => {
    const store = baseStore();
    const prisma = fakePrisma(store);
    vi.spyOn(softphoneProfileService, 'getOrCreateProfile').mockResolvedValue({
      favoriteContactIds: ['u2'],
      speedDial: [{ slot: 1, contactId: 'u2', label: 'Bob', number: null }],
      recentContacts: ['u2'],
    });

    const favorites = await contactDirectoryService.searchDirectory(prisma, 't1', { userId: 'u1', favoritesOnly: true });
    expect(favorites.items).toHaveLength(1);
    expect(favorites.items[0].isFavorite).toBe(true);
    expect(favorites.speedDial).toHaveLength(1);
  });

  it('reports directory sync health', async () => {
    const store = baseStore();
    const prisma = fakePrisma(store);
    const health = await contactDirectoryService.directorySyncHealth(prisma, 't1');
    expect(health.userCount).toBe(2);
    expect(health.linkedCount).toBe(2);
    expect(health.synced).toBe(true);
  });
});
