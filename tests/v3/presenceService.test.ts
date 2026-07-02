import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const presenceService = require('../../lib/v3/presenceService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function fakePrisma(store: { presence: any[]; users: any[] }) {
  return {
    user: {
      findFirst: vi.fn(async ({ where }: any) => store.users.find((u) => u.id === where.id && u.tenantId === where.tenantId) || null),
    },
    v3PresenceConfig: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where.tenantId_userId;
        return store.presence.find((p) => p.tenantId === key.tenantId && p.userId === key.userId) || null;
      }),
      create: vi.fn(async ({ data }: any) => {
        store.presence.push(data);
        return data;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const key = where.tenantId_userId;
        const row = store.presence.find((p) => p.tenantId === key.tenantId && p.userId === key.userId);
        Object.assign(row, data);
        return row;
      }),
      findMany: vi.fn(async () => store.presence),
      count: vi.fn(async () => store.presence.length),
    },
  };
}

describe('V3 presenceService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates default available presence', async () => {
    const store = { presence: [], users: [{ id: 'u1', tenantId: 't1' }] };
    const prisma = fakePrisma(store);
    const row = await presenceService.getPresence(prisma, 't1', 'u1');
    expect(row.status).toBe('available');
  });

  it('updates presence with audit', async () => {
    const store = {
      presence: [{ id: 'pr1', tenantId: 't1', userId: 'u1', status: 'available', message: null }],
      users: [{ id: 'u1', tenantId: 't1' }],
    };
    const prisma = fakePrisma(store);
    const logSpy = vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const updated = await presenceService.updatePresence(prisma, 't1', 'u1', {
      status: 'dnd',
      message: 'In a meeting',
    }, { req: {} });

    expect(updated.status).toBe('dnd');
    expect(updated.message).toBe('In a meeting');
    expect(logSpy).toHaveBeenCalledWith(expect.anything(), {}, expect.objectContaining({ action: 'v3.presence.changed' }));
  });

  it('rejects invalid status', async () => {
    const store = {
      presence: [{ id: 'pr1', tenantId: 't1', userId: 'u1', status: 'available', message: null }],
      users: [{ id: 'u1', tenantId: 't1' }],
    };
    const prisma = fakePrisma(store);
    await expect(
      presenceService.updatePresence(prisma, 't1', 'u1', { status: 'flying' }, { req: {} }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
