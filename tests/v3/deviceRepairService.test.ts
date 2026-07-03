import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceRepairService = require('../../lib/v3/deviceRepairService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceProvisioningService = require('../../lib/v3/deviceProvisioningService.js');

function fakePrisma(store: { devices: any[]; extensions: any[]; users: any[] }) {
  return {
    v3DeskDevice: {
      findMany: vi.fn(async () => store.devices),
      update: vi.fn(async ({ where, data }: any) => {
        const device = store.devices.find((d) => d.id === where.id);
        Object.assign(device, data);
        return device;
      }),
    },
    extension: {
      findFirst: vi.fn(async ({ where }: any) => store.extensions.find((e) => e.id === where.id) || null),
    },
    user: {
      findFirst: vi.fn(async ({ where }: any) => store.users.find((u) => u.id === where.id) || null),
      findUnique: vi.fn(async ({ where }: any) => store.users.find((u) => u.id === where.id) || null),
    },
    extensionDevice: { findFirst: vi.fn(async () => null) },
  };
}

describe('V3 deviceRepairService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('aligns employee when extension owner differs and is idempotent', async () => {
    const store = {
      devices: [{ id: 'd1', tenantId: 't1', vendor: 'yealink', macAddress: 'AABB', extensionId: 'e1', employeeId: null, status: 'ASSIGNED', provisionUrl: null }],
      extensions: [{ id: 'e1', tenantId: 't1', userId: 'u1', extensionNumber: '101' }],
      users: [{ id: 'u1', tenantId: 't1', telnyxSipUsername: 'sip-u1', telnyxCredentialId: 'cred-1' }],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(deviceProvisioningService, 'provisionDevice').mockResolvedValue({});

    const first = await deviceRepairService.repairDevices(prisma, 't1', { apply: true });
    expect(first.applied.some((a: any) => a.type === 'MISSING_EMPLOYEE' && a.ok)).toBe(true);
    expect(store.devices[0].employeeId).toBe('u1');

    const second = await deviceRepairService.repairDevices(prisma, 't1', { apply: true });
    expect(second.changes.filter((c: any) => c.type === 'MISSING_EMPLOYEE')).toEqual([]);
  });

  it('fixes broken provision URL', async () => {
    const store = {
      devices: [{
        id: 'd1', tenantId: 't1', vendor: 'grandstream', macAddress: 'AABB',
        extensionId: 'e1', employeeId: 'u1', status: 'PROVISIONED', provisionUrl: null, lastProvisionedAt: new Date(),
      }],
      extensions: [{ id: 'e1', tenantId: 't1', userId: 'u1', extensionNumber: '101' }],
      users: [{ id: 'u1', tenantId: 't1', telnyxSipUsername: 'sip-u1', telnyxCredentialId: 'cred-1', sipRegistered: false }],
    };
    const prisma = fakePrisma(store);

    await deviceRepairService.repairDevices(prisma, 't1', { apply: true });
    expect(store.devices[0].provisionUrl).toMatch(/\/provision\/$/);
  });
});
