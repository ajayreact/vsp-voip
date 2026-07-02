import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dashboardService = require('../../lib/v3/dashboardService.js');
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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const repairService = require('../../lib/v3/repairService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceRepairService = require('../../lib/v3/deviceRepairService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const analyticsService = require('../../lib/v3/analyticsService.js');

function fakePrisma() {
  return {
    user: {
      count: vi.fn(async ({ where }: any) => (where.role === 'TENANT_USER' ? 2 : (where.sipRegistered ? 1 : 3))),
      findMany: vi.fn(async () => [{ id: 'u1', createdAt: new Date(), telnyxCredentialId: 'c1' }]),
    },
    extension: { count: vi.fn(async () => 2), findMany: vi.fn(async () => [{ id: 'e1', createdAt: new Date(), department: 'Sales' }]) },
    userDevice: { count: vi.fn(async () => 1) },
    v3DeskDevice: {
      count: vi.fn(async ({ where }: any) => (where.status === 'REGISTERED' ? 1 : 2)),
      findMany: vi.fn(async () => [{ vendor: 'Yealink', model: 'T46' }]),
    },
    v3RingGroup: { count: vi.fn(async () => 1) },
    v3Queue: { count: vi.fn(async () => 1) },
    v3BusinessHoursSchedule: { count: vi.fn(async () => 1) },
    v3Holiday: { count: vi.fn(async () => 0) },
    v3VoicemailBox: { count: vi.fn(async () => 1) },
    v3CallFlow: { count: vi.fn(async () => 1) },
    v3SoftphoneProfile: { count: vi.fn(async () => 1) },
    v3DevicePreference: { findMany: vi.fn(async () => [{ deviceType: 'desktop' }]) },
    v3PresenceConfig: { findMany: vi.fn(async () => [{ status: 'available' }]) },
    phoneNumber: {
      findMany: vi.fn(async () => [{ id: 'n1', extensionId: 'e1', assignedUserId: null }]),
    },
  };
}

describe('V3 dashboardService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('aggregates dashboard cards', async () => {
    const prisma = fakePrisma();
    vi.spyOn(healthCheckService, 'tenantHealthSummary').mockResolvedValue({ totalEmployees: 2, ready: 1, warnings: 1, errors: 0 });
    vi.spyOn(deviceHealthService, 'listDevicesHealth').mockResolvedValue({ summary: { warnings: 0, errors: 0 }, devices: [] });
    vi.spyOn(pbxHealthService, 'pbxObjectsHealth').mockResolvedValue({ summary: { warnings: 0, errors: 0 } });
    vi.spyOn(softphoneHealthService, 'softphoneUxHealth').mockResolvedValue({ summary: { warnings: 0, errors: 0 } });
    vi.spyOn(inventoryHealthService, 'listNumbersHealth').mockResolvedValue({ summary: { warnings: 0, errors: 0 }, numbers: [] });
    vi.spyOn(repairService, 'inspect').mockResolvedValue({ changes: [], scanned: {}, observations: [] });
    vi.spyOn(deviceRepairService, 'inspectDevices').mockResolvedValue({ changes: [], scanned: {}, observations: [] });
    vi.spyOn(analyticsService, 'getCharts').mockResolvedValue({ healthScore: { overall: 80 } });

    const summary = await dashboardService.getDashboardSummary(prisma, 't1');
    expect(summary.cards.employees).toBe(2);
    expect(summary.cards.ringGroups).toBe(1);
    expect(summary.repairRecommendations.total).toBe(0);
  });
});

describe('V3 analyticsService helpers', () => {
  it('builds monthly growth series', () => {
    const rows = [{ createdAt: new Date() }];
    const series = analyticsService.buildMonthlySeries(rows, 3);
    expect(series).toHaveLength(3);
    expect(series[series.length - 1].count).toBe(1);
  });

  it('groups counts by key', () => {
    const grouped = analyticsService.groupCount([{ d: 'Sales' }, { d: 'Sales' }, { d: 'Support' }], (r) => r.d);
    expect(grouped.find((g) => g.label === 'Sales')?.value).toBe(2);
  });
});
