import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const queueService = require('../../lib/v3/queueService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function fakePrisma(store: { queues: any[]; extensions: any[] }) {
  return {
    v3Queue: {
      findFirst: vi.fn(async ({ where }: any) => store.queues.find((q) => q.id === where.id && q.tenantId === where.tenantId && !q.removedAt) || null),
      create: vi.fn(async ({ data }: any) => { store.queues.push(data); return data; }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = store.queues.find((q) => q.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    extension: {
      findFirst: vi.fn(async ({ where }: any) => store.extensions.find((e) => e.id === where.id) || null),
    },
  };
}

describe('V3 queueService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates queue with default stats', async () => {
    const store = { queues: [], extensions: [{ id: 'e1', tenantId: 't1' }] };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const created = await queueService.createQueue(prisma, 't1', {
      name: 'Support',
      queueNumber: '800',
      agentExtensionIds: ['e1'],
    }, { req: {} });

    expect(created.stats.callsOffered).toBe(0);
    expect(created.strategy).toBe('ROUND_ROBIN');
  });
});
