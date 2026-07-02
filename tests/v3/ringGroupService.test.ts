import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ringGroupService = require('../../lib/v3/ringGroupService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function fakePrisma(store: { ringGroups: any[]; extensions: any[] }) {
  return {
    v3RingGroup: {
      findMany: vi.fn(async ({ where }: any) => store.ringGroups.filter((r) => r.tenantId === where.tenantId && !r.removedAt)),
      findFirst: vi.fn(async ({ where }: any) => store.ringGroups.find((r) => {
        if (where.id && r.id !== where.id) return false;
        if (where.tenantId && r.tenantId !== where.tenantId) return false;
        if (where.name && r.name !== where.name) return false;
        if (where.removedAt === null && r.removedAt) return false;
        return true;
      }) || null),
      create: vi.fn(async ({ data }: any) => {
        store.ringGroups.push(data);
        return data;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = store.ringGroups.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      }),
      count: vi.fn(async () => store.ringGroups.filter((r) => !r.removedAt).length),
    },
    extension: {
      findFirst: vi.fn(async ({ where }: any) => store.extensions.find((e) => e.id === where.id && e.tenantId === where.tenantId) || null),
    },
  };
}

describe('V3 ringGroupService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates ring group with members and validates', async () => {
    const store = {
      ringGroups: [],
      extensions: [{ id: 'e1', tenantId: 't1' }, { id: 'e2', tenantId: 't1' }],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const created = await ringGroupService.createRingGroup(prisma, 't1', {
      name: 'Sales',
      strategy: 'SIMULTANEOUS',
      memberExtensionIds: ['e1', 'e2'],
    }, { req: {} });

    expect(created.name).toBe('Sales');
    expect(created.memberExtensionIds).toEqual(['e1', 'e2']);

    const validation = await ringGroupService.validateRingGroup(prisma, 't1', created);
    expect(validation.valid).toBe(true);
  });

  it('soft-deletes ring group', async () => {
    const store = {
      ringGroups: [{ id: 'rg1', tenantId: 't1', name: 'Sales', strategy: 'SIMULTANEOUS', memberExtensionIds: ['e1'], removedAt: null }],
      extensions: [{ id: 'e1', tenantId: 't1' }],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    await ringGroupService.removeRingGroup(prisma, 't1', 'rg1', { req: {} });
    expect(store.ringGroups[0].removedAt).toBeTruthy();
  });
});
