import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const monitoringService = require('../../lib/v3/monitoringService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtimeSyncService = require('../../lib/v3/runtime/runtimeSyncService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtimeHealthService = require('../../lib/v3/runtime/runtimeHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const healthCheckService = require('../../lib/v3/healthCheckService.js');

describe('V3 monitoringService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns monitoring overview', async () => {
    vi.spyOn(runtimeSyncService, 'getStatus').mockResolvedValue({
      jobs: { pending: 2, running: 1, failed: 0, deadLetter: 0 },
      links: { total: 10 },
    });
    vi.spyOn(runtimeHealthService, 'getRuntimeHealth').mockResolvedValue({
      enabled: false,
      overall: 'yellow',
      domains: { runtimeReady: 'yellow' },
    });
    vi.spyOn(healthCheckService, 'tenantHealthSummary').mockResolvedValue({ errors: 1, warnings: 0 });

    const prisma = {
      v3RuntimeSyncJob: {
        findMany: vi.fn(async () => []),
        count: vi.fn(async () => 0),
      },
      v3MigrationRun: { findMany: vi.fn(async () => []) },
      v3RuntimeLink: { count: vi.fn(async () => 5) },
      user: { count: vi.fn(async () => 2) },
    };

    const overview = await monitoringService.getMonitoringOverview(prisma, 't1');
    expect(overview.runtimeSyncQueue.pending).toBe(2);
    expect(overview.provisioningFailures).toBe(1);
    expect(overview.registrationIssues).toBe(2);
  });
});
