import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const notificationCenterService = require('../../lib/v3/notificationCenterService.js');
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

describe('V3 notificationCenterService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns health and repair notifications', async () => {
    const prisma = {
      tenant: {
        findUnique: vi.fn(async () => ({ maxUsers: 5, maxPhoneNumbers: 10, name: 'Acme' })),
      },
    };

    vi.spyOn(healthCheckService, 'tenantHealthSummary').mockResolvedValue({
      totalEmployees: 2, ready: 1, warnings: 1, errors: 1, registeredSip: 1, unregisteredSip: 1,
    });
    vi.spyOn(healthCheckService, 'employeeHealth').mockResolvedValue({
      employees: [
        { employeeId: 'u1', name: 'Alice', checks: { credential: 'red', registration: 'yellow' } },
      ],
    });
    vi.spyOn(deviceHealthService, 'listDevicesHealth').mockResolvedValue({ summary: { warnings: 0, errors: 0 }, devices: [] });
    vi.spyOn(inventoryHealthService, 'listNumbersHealth').mockResolvedValue({ summary: { total: 1, warnings: 0, errors: 0 }, numbers: [] });
    vi.spyOn(pbxHealthService, 'pbxObjectsHealth').mockResolvedValue({ summary: { warnings: 0, errors: 0 } });
    vi.spyOn(softphoneHealthService, 'softphoneUxHealth').mockResolvedValue({ summary: { warnings: 0, errors: 0 } });
    vi.spyOn(repairService, 'inspect').mockResolvedValue({
      changes: [{ type: 'MISSING_EXTENSION', entity: 'User', ref: 'bob', detail: 'no ext' }],
      scanned: {}, observations: [],
    });
    vi.spyOn(deviceRepairService, 'inspectDevices').mockResolvedValue({ changes: [], scanned: {}, observations: [] });

    const center = await notificationCenterService.getNotifications(prisma, 't1');
    expect(center.notifications.length).toBeGreaterThan(0);
    expect(center.summary.errors).toBeGreaterThan(0);
    expect(center.notifications.some((n) => n.category === 'repair_suggestion')).toBe(true);
  });
});
