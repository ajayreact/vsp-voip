import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const systemHealthService = require('../../lib/v3/systemHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const healthCheckService = require('../../lib/v3/healthCheckService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceHealthService = require('../../lib/v3/deviceHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const inventoryHealthService = require('../../lib/v3/inventoryHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pbxHealthService = require('../../lib/v3/pbxHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const softphoneHealthService = require('../../lib/v3/softphoneHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const repairService = require('../../lib/v3/repairService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceRepairService = require('../../lib/v3/deviceRepairService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const analyticsService = require('../../lib/v3/analyticsService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lifecycleHealthService = require('../../lib/v3/lifecycleHealthService.js');

describe('V3 systemHealthService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('computes overall system health', async () => {
    const prisma = {
      extension: {
        findMany: vi.fn(async () => [{ userId: 'u1', department: 'Sales' }]),
      },
    };

    vi.spyOn(healthCheckService, 'tenantHealthSummary').mockResolvedValue({
      totalEmployees: 2, ready: 2, warnings: 0, errors: 0,
    });
    vi.spyOn(healthCheckService, 'employeeHealth').mockResolvedValue({
      employees: [{ employeeId: 'u1', name: 'Alice', overall: 'green', checks: {} }],
      readiness: { webhookReady: true },
    });
    vi.spyOn(deviceHealthService, 'listDevicesHealth').mockResolvedValue({ summary: { total: 1, ready: 1, warnings: 0, errors: 0 }, devices: [] });
    vi.spyOn(inventoryHealthService, 'listNumbersHealth').mockResolvedValue({ summary: { total: 1, ready: 1, warnings: 0, errors: 0 }, numbers: [] });
    vi.spyOn(pbxHealthService, 'pbxObjectsHealth').mockResolvedValue({ summary: { total: 1, ready: 1, warnings: 0, errors: 0 } });
    vi.spyOn(softphoneHealthService, 'softphoneUxHealth').mockResolvedValue({ summary: { total: 1, ready: 1, warnings: 0, errors: 0 } });
    vi.spyOn(repairService, 'inspect').mockResolvedValue({ changes: [], scanned: {}, observations: [] });
    vi.spyOn(deviceRepairService, 'inspectDevices').mockResolvedValue({ changes: [], scanned: {}, observations: [] });
    vi.spyOn(analyticsService, 'getCharts').mockResolvedValue({ employeeGrowth: [{ label: '2026-01', cumulative: 1 }] });
    vi.spyOn(lifecycleHealthService, 'getLifecycleHealth').mockResolvedValue({
      license: { level: 'green', warnings: 0, utilization: { seats: 50 } },
      storage: { level: 'green', totalEstimatedMb: 10 },
      backup: { level: 'yellow', count: 0, latest: null },
      subscription: { level: 'green', renewalDate: null },
      billing: { level: 'green', status: 'ACTIVE' },
      overall: 'green',
    });

    const health = await systemHealthService.getSystemHealth(prisma, 't1');
    expect(health.overallScore).toBeGreaterThan(0);
    expect(health.domains.employees.level).toBe('green');
    expect(health.departmentHealth).toHaveLength(1);
  });
});
