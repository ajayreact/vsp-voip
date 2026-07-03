import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/v3/auditService.js', () => ({
  log: vi.fn(async () => undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtimeSyncService = require('../../lib/v3/runtime/runtimeSyncService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ringGroupAdapter = require('../../lib/v3/runtime/ringGroupRuntimeAdapter.js');

describe('V3 runtimeSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.V3_RUNTIME_SYNC_ENABLED = 'true';
    delete process.env.V3_RUNTIME_SYNC_TENANT_ALLOWLIST;
  });

  it('enqueues idempotent sync jobs', async () => {
    const jobs = new Map<string, Record<string, unknown>>();
    const prisma = {
      v3RuntimeSyncJob: {
        findUnique: vi.fn(async ({ where }: { where: { idempotencyKey: string } }) => jobs.get(where.idempotencyKey) || null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> & { idempotencyKey: string } }) => {
          const job = { ...data, attempts: 0, maxAttempts: 5, status: 'PENDING' };
          jobs.set(data.idempotencyKey, job);
          return job;
        }),
      },
    };

    const first = await runtimeSyncService.enqueue(prisma, 't1', {
      entityType: 'ring_group',
      entityId: 'rg1',
      action: 'sync',
    });
    const second = await runtimeSyncService.enqueue(prisma, 't1', {
      entityType: 'ring_group',
      entityId: 'rg1',
      action: 'sync',
    });

    expect(first.id).toBe(second.id);
    expect(prisma.v3RuntimeSyncJob.create).toHaveBeenCalledTimes(1);
  });

  it('processes ring group sync job successfully', async () => {
    vi.spyOn(ringGroupAdapter, 'sync').mockResolvedValue({ ok: true, runtimeEntityId: 'legacy-rg' });

    const job = {
      id: 'job1',
      tenantId: 't1',
      entityType: 'ring_group',
      entityId: 'rg1',
      action: 'sync',
      attempts: 0,
      maxAttempts: 5,
      payload: null,
    };

    const prisma = {
      v3RuntimeSyncJob: {
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...job, ...data })),
      },
    };

    const result = await runtimeSyncService.processJob(prisma, job, { req: {} });
    expect(result.status).toBe('SUCCESS');
    expect(ringGroupAdapter.sync).toHaveBeenCalledWith(prisma, 't1', 'rg1', { action: 'sync', payload: null });
  });

  it('retries failed jobs until dead letter', async () => {
    vi.spyOn(ringGroupAdapter, 'sync').mockRejectedValue(new Error('telnyx down'));

    const job = {
      id: 'job2',
      tenantId: 't1',
      entityType: 'ring_group',
      entityId: 'rg1',
      action: 'sync',
      attempts: 4,
      maxAttempts: 5,
      payload: null,
      scheduledAt: new Date(),
    };

    const prisma = {
      v3RuntimeSyncJob: {
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...job, ...data })),
      },
    };

    const result = await runtimeSyncService.processJob(prisma, job, { req: {} });
    expect(result.status).toBe('DEAD_LETTER');
    expect(result.lastError).toContain('telnyx down');
  });
});
