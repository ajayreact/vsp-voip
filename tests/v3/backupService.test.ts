import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const backupService = require('../../lib/v3/backupService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function fakePrisma() {
  const store: any[] = [];
  return {
    tenant: { findUnique: vi.fn(async () => ({ id: 't1', name: 'Acme', greeting: null })) },
    user: { findMany: vi.fn(async () => [{ id: 'u1', role: 'TENANT_USER', email: 'a@x.com', name: 'Alice' }]) },
    extension: { findMany: vi.fn(async () => [{ id: 'e1', tenantId: 't1', extensionNumber: '101' }]) },
    phoneNumber: { findMany: vi.fn(async () => []) },
    v3DeskDevice: { findMany: vi.fn(async () => []) },
    v3RingGroup: { findMany: vi.fn(async () => [{ id: 'rg1', name: 'Sales' }]) },
    v3Queue: { findMany: vi.fn(async () => []) },
    v3BusinessHoursSchedule: { findMany: vi.fn(async () => []) },
    v3Holiday: { findMany: vi.fn(async () => []) },
    v3VoicemailBox: { findMany: vi.fn(async () => []) },
    v3CallFlow: { findMany: vi.fn(async () => []) },
    v3SoftphoneProfile: { findMany: vi.fn(async () => []) },
    v3UserPreference: { findMany: vi.fn(async () => []) },
    v3DevicePreference: { findMany: vi.fn(async () => []) },
    v3PresenceConfig: { findMany: vi.fn(async () => []) },
    v3FeatureFlag: { findUnique: vi.fn(async () => null) },
    v3TenantBackup: {
      create: vi.fn(async ({ data }: any) => { store.push(data); return data; }),
      findMany: vi.fn(async () => store),
      findFirst: vi.fn(async ({ where }: any) => store.find((b) => b.id === where.id) || null),
      count: vi.fn(async () => store.length),
    },
  };
}

describe('V3 backupService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('collects tenant configuration', async () => {
    const prisma = fakePrisma();
    const payload = await backupService.collectConfiguration(prisma, 't1');
    expect(payload.version).toBe(1);
    expect(payload.pbx.ringGroups).toHaveLength(1);
  });

  it('creates backup with audit', async () => {
    const prisma = fakePrisma();
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);
    const backup = await backupService.createBackup(prisma, 't1', { label: 'Test' }, { req: {} });
    expect(backup.label).toBe('Test');
    expect(auditService.log).toHaveBeenCalledWith(expect.anything(), {}, expect.objectContaining({ action: 'v3.backup.created' }));
  });
});
