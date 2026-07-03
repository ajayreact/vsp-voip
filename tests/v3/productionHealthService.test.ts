import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const productionHealthService = require('../../lib/v3/productionHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const deploymentService = require('../../lib/v3/deploymentService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const monitoringService = require('../../lib/v3/monitoringService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const diagnosticsService = require('../../lib/v3/diagnosticsService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtimeValidationService = require('../../lib/v3/runtimeValidationService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lifecycleHealthService = require('../../lib/v3/lifecycleHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const metricsService = require('../../lib/v3/metricsService.js');

describe('V3 productionHealthService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('aggregates production health scorecard', async () => {
    vi.spyOn(deploymentService, 'getDeploymentStatus').mockResolvedValue({
      readiness: { portalEnabled: true, tenantActive: true },
    });
    vi.spyOn(monitoringService, 'getMonitoringOverview').mockResolvedValue({
      runtimeSyncQueue: { pending: 0, running: 0, items: [] },
      failedSyncs: { total: 0, recent: [] },
      runtimeHealth: { enabled: true, overall: 'green' },
    });
    vi.spyOn(diagnosticsService, 'getDiagnostics').mockResolvedValue({ issues: [] });
    vi.spyOn(runtimeValidationService, 'getValidationReport').mockResolvedValue({ overall: 'green', domains: [] });
    vi.spyOn(lifecycleHealthService, 'getLifecycleHealth').mockResolvedValue({
      license: { level: 'green' },
      storage: { level: 'green' },
      backup: { level: 'green' },
      billing: { level: 'green' },
      subscription: { level: 'green' },
    });
    vi.spyOn(metricsService, 'getMetrics').mockResolvedValue({
      sync: { total: 10, success: 9, failed: 1 },
      provisioning: { successRate: 90 },
    });

    const prisma = {
      v3MigrationRun: {
        findFirst: vi.fn(async () => ({ id: 'm1', status: 'SUCCESS', runType: 'migrate' })),
      },
    };

    const health = await productionHealthService.getProductionHealth(prisma, 't1');
    expect(health.overall).toBe('green');
    expect(health.healthyDomains.runtime).toBe('green');
    expect(health.metrics.syncSuccessRate).toBe(90);
  });
});
