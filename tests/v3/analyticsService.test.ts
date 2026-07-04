import { describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const analyticsService = require('../../lib/v3/analyticsService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const healthCheckService = require('../../lib/v3/healthCheckService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceHealthService = require('../../lib/v3/deviceHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pbxHealthService = require('../../lib/v3/pbxHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const softphoneHealthService = require('../../lib/v3/softphoneHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const inventoryHealthService = require('../../lib/v3/inventoryHealthService.js');

describe('V3 analyticsService', () => {
  it('returns chart bundle', async () => {
    const prisma = {
      user: { findMany: vi.fn(async () => [{ id: 'u1', createdAt: new Date(), telnyxCredentialId: 'c1' }]) },
      extension: { findMany: vi.fn(async () => [{ id: 'e1', createdAt: new Date(), department: 'Sales' }]) },
      v3DeskDevice: { findMany: vi.fn(async () => [{ vendor: 'Yealink', model: 'T46' }]) },
      v3DevicePreference: { findMany: vi.fn(async () => [{ deviceType: 'desktop' }]) },
      phoneNumber: { findMany: vi.fn(async () => [{ id: 'n1', extensionId: 'e1', assignedUserId: null }]) },
      v3PresenceConfig: { findMany: vi.fn(async () => [{ status: 'available' }]) },
    };

    vi.spyOn(healthCheckService, 'tenantHealthSummary').mockResolvedValue({ totalEmployees: 1, ready: 1, warnings: 0, errors: 0 });
    vi.spyOn(deviceHealthService, 'listDevicesHealth').mockResolvedValue({ summary: { total: 1, ready: 1, warnings: 0, errors: 0 }, devices: [] });
    vi.spyOn(pbxHealthService, 'pbxObjectsHealth').mockResolvedValue({ summary: { total: 1, ready: 1, warnings: 0, errors: 0 } });
    vi.spyOn(softphoneHealthService, 'softphoneUxHealth').mockResolvedValue({ summary: { total: 1, ready: 1, warnings: 0, errors: 0 } });
    vi.spyOn(inventoryHealthService, 'listNumbersHealth').mockResolvedValue({ summary: { total: 1, ready: 1, warnings: 0, errors: 0 }, numbers: [] });

    const charts = await analyticsService.getCharts(prisma, 't1');
    expect(charts.employeeGrowth).toHaveLength(6);
    expect(charts.vendorDistribution[0].label).toBe('Yealink');
    expect(charts.healthScore.overall).toBeGreaterThan(0);
  });
});
