import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const userPreferenceService = require('../../lib/v3/userPreferenceService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const devicePreferenceService = require('../../lib/v3/devicePreferenceService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function fakePrisma(store: { prefs: any[]; devices: any[]; users: any[] }) {
  return {
    user: {
      findFirst: vi.fn(async ({ where }: any) => store.users.find((u) => u.id === where.id && u.tenantId === where.tenantId) || null),
    },
    v3UserPreference: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where.tenantId_userId;
        return store.prefs.find((p) => p.tenantId === key.tenantId && p.userId === key.userId) || null;
      }),
      create: vi.fn(async ({ data }: any) => {
        store.prefs.push(data);
        return data;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const key = where.tenantId_userId;
        const row = store.prefs.find((p) => p.tenantId === key.tenantId && p.userId === key.userId);
        Object.assign(row, data);
        return row;
      }),
    },
    v3DevicePreference: {
      findFirst: vi.fn(async ({ where }: any) => store.devices.find((d) =>
        d.tenantId === where.tenantId
        && d.userId === where.userId
        && d.deviceType === where.deviceType
        && (d.deviceAlias || null) === (where.deviceAlias || null),
      ) || null),
      findMany: vi.fn(async ({ where }: any) => store.devices.filter((d) => d.tenantId === where.tenantId && d.userId === where.userId)),
      create: vi.fn(async ({ data }: any) => {
        store.devices.push(data);
        return data;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = store.devices.find((d) => d.id === where.id);
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        store.devices.forEach((d) => {
          if (d.tenantId === where.tenantId && d.userId === where.userId && d.preferred === where.preferred) {
            Object.assign(d, data);
          }
        });
      }),
    },
  };
}

describe('V3 userPreferenceService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('merges preferences on update', async () => {
    const store = {
      prefs: [{ id: 'pref1', tenantId: 't1', userId: 'u1', preferences: { compactSidebar: true } }],
      devices: [],
      users: [{ id: 'u1', tenantId: 't1' }],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const res = await userPreferenceService.updatePreferences(prisma, 't1', 'u1', {
      preferences: { showAvatars: false },
    }, { req: {} });

    expect(res.preferences.compactSidebar).toBe(true);
    expect(res.preferences.showAvatars).toBe(false);
  });
});

describe('V3 devicePreferenceService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('upserts device preference', async () => {
    const store = { prefs: [], devices: [], users: [{ id: 'u1', tenantId: 't1' }] };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const device = await devicePreferenceService.upsertDevicePreference(prisma, 't1', 'u1', {
      deviceType: 'mobile',
      deviceAlias: 'iPhone',
      preferred: true,
      notificationPreference: 'calls_only',
    }, { req: {} });

    expect(device.deviceType).toBe('mobile');
    expect(device.preferred).toBe(true);
    expect(store.devices).toHaveLength(1);
  });

  it('lists device preferences', async () => {
    const store = {
      prefs: [],
      devices: [{ id: 'd1', tenantId: 't1', userId: 'u1', deviceType: 'desktop', deviceAlias: '', preferred: true, notificationPreference: 'all', ringPreference: 'default', metadata: {} }],
      users: [{ id: 'u1', tenantId: 't1' }],
    };
    const prisma = fakePrisma(store);
    const list = await devicePreferenceService.listDevicePreferences(prisma, 't1', 'u1');
    expect(list.items).toHaveLength(1);
  });
});
