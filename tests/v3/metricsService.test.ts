import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const metricsService = require('../../lib/v3/metricsService.js');

describe('V3 metricsService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('aggregates sync and migration metrics', async () => {
    const started = new Date(Date.now() - 5000);
    const finished = new Date();
    const prisma = {
      v3RuntimeSyncJob: {
        findMany: vi.fn(async () => [
          { status: 'SUCCESS', startedAt: started, finishedAt: finished, entityType: 'extension', lastError: null },
          { status: 'FAILED', startedAt: started, finishedAt: finished, entityType: 'number', lastError: 'err' },
        ]),
      },
      v3MigrationRun: {
        findMany: vi.fn(async () => [
          { status: 'SUCCESS', startedAt: started, finishedAt: finished, runType: 'migrate' },
        ]),
      },
      adminAuditLog: { count: vi.fn(async () => 3) },
      extension: { count: vi.fn(async () => 10) },
      user: { count: vi.fn(async () => 8) },
    };

    const metrics = await metricsService.getMetrics(prisma, 't1', { windowHours: 24 });
    expect(metrics.sync.total).toBe(2);
    expect(metrics.sync.success).toBe(1);
    expect(metrics.sync.failed).toBe(1);
    expect(metrics.migration.total).toBe(1);
    expect(metrics.registration.rate).toBe(80);
  });
});
