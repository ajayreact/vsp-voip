import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const softphoneProfileService = require('../../lib/v3/softphoneProfileService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function fakePrisma(store: { profiles: any[]; users: any[] }) {
  return {
    user: {
      findFirst: vi.fn(async ({ where }: any) => store.users.find((u) => u.id === where.id && u.tenantId === where.tenantId) || null),
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
      update: vi.fn(async ({ where, data }: any) => {
        const key = where.tenantId_userId;
        const row = store.profiles.find((p) => p.tenantId === key.tenantId && p.userId === key.userId);
        Object.assign(row, data);
        return row;
      }),
    },
  };
}

describe('V3 softphoneProfileService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates default profile on first get', async () => {
    const store = { profiles: [], users: [{ id: 'u1', tenantId: 't1' }] };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const profile = await softphoneProfileService.getOrCreateProfile(prisma, 't1', 'u1');
    expect(profile.userId).toBe('u1');
    expect(profile.theme).toBe('system');
    expect(store.profiles).toHaveLength(1);
  });

  it('updates profile and audits', async () => {
    const store = {
      profiles: [{
        id: 'p1', tenantId: 't1', userId: 'u1', theme: 'system', language: 'en',
        callRecordingPreference: 'inherit', autoAnswer: false, dnd: false, busy: false, away: false,
        presenceVisibility: 'everyone', favoriteContactIds: [], speedDial: [], recentContacts: [],
      }],
      users: [{ id: 'u1', tenantId: 't1' }],
    };
    const prisma = fakePrisma(store);
    const logSpy = vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const updated = await softphoneProfileService.updateProfile(prisma, 't1', 'u1', {
      preferredCallerId: '+15551234567',
      preferredDevice: 'desktop',
      timezone: 'America/New_York',
      theme: 'dark',
    }, { req: {} });

    expect(updated.preferredCallerId).toBe('+15551234567');
    expect(updated.theme).toBe('dark');
    expect(logSpy).toHaveBeenCalledWith(expect.anything(), {}, expect.objectContaining({ action: 'v3.profile.updated' }));
    expect(softphoneProfileService.isProfileComplete(updated)).toBe(true);
  });

  it('manages favorites and speed dial', async () => {
    const store = {
      profiles: [{
        id: 'p1', tenantId: 't1', userId: 'u1', theme: 'system', language: 'en',
        callRecordingPreference: 'inherit', autoAnswer: false, dnd: false, busy: false, away: false,
        presenceVisibility: 'everyone', favoriteContactIds: [], speedDial: [], recentContacts: [],
      }],
      users: [{ id: 'u1', tenantId: 't1' }],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    await softphoneProfileService.addFavorite(prisma, 't1', 'u1', 'c1', { req: {} });
    expect(store.profiles[0].favoriteContactIds).toContain('c1');

    await softphoneProfileService.setSpeedDial(prisma, 't1', 'u1', [
      { slot: 1, contactId: 'c1', label: 'Sales', number: null },
    ], { req: {} });
    expect(store.profiles[0].speedDial).toHaveLength(1);

    await softphoneProfileService.recordRecentContact(prisma, 't1', 'u1', 'c2', { req: {} });
    expect(store.profiles[0].recentContacts[0]).toBe('c2');
  });
});
