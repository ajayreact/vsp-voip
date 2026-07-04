import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const callFlowService = require('../../lib/v3/callFlowService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function fakePrisma(store: { flows: any[] }) {
  return {
    v3CallFlow: {
      findMany: vi.fn(async ({ where }: any) => store.flows.filter((f) => f.tenantId === where.tenantId && !f.removedAt)),
      findFirst: vi.fn(async ({ where }: any) => store.flows.find((f) => f.id === where.id && f.tenantId === where.tenantId && !f.removedAt) || null),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, createdAt: new Date(), updatedAt: new Date() };
        store.flows.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const flow = store.flows.find((f) => f.id === where.id);
        Object.assign(flow, data, { updatedAt: new Date() });
        return flow;
      }),
      count: vi.fn(async () => store.flows.filter((f) => !f.removedAt).length),
    },
  };
}

describe('V3 callFlowService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates a call flow with default start/end definition', async () => {
    const store = { flows: [] as any[] };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const flow = await callFlowService.createCallFlow(prisma, 't1', { name: 'Main IVR' }, { req: {} });
    expect(flow.name).toBe('Main IVR');
    expect(flow.definition.nodes.length).toBeGreaterThanOrEqual(2);
    expect(auditService.log).toHaveBeenCalledWith(expect.anything(), {}, expect.objectContaining({ action: 'v3.callflow.created' }));
  });

  it('soft-deletes without removing row', async () => {
    const store = {
      flows: [{
        id: 'f1', tenantId: 't1', name: 'Test', status: 'DRAFT', version: 1,
        definition: { version: 1, nodes: [], edges: [] }, removedAt: null,
      }],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    await callFlowService.removeCallFlow(prisma, 't1', 'f1', { req: {} });
    expect(store.flows[0].removedAt).toBeTruthy();
    expect(store.flows[0].status).toBe('ARCHIVED');
  });
});
