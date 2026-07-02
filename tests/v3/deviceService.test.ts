import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceService = require('../../lib/v3/deviceService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function fakePrisma(store: { devices: any[]; extensions: any[]; users: any[]; tenants: any[] }) {
  return {
    v3DeskDevice: {
      findMany: vi.fn(async ({ where }: any) => store.devices.filter((d) => {
        if (where.tenantId && d.tenantId !== where.tenantId) return false;
        if (where.status?.not === 'REMOVED' && d.status === 'REMOVED') return false;
        return true;
      })),
      findFirst: vi.fn(async ({ where }: any) => store.devices.find((d) => {
        if (where.id && d.id !== where.id) return false;
        if (where.tenantId && d.tenantId !== where.tenantId) return false;
        if (where.macAddress && d.macAddress !== where.macAddress) return false;
        if (where.status?.not === 'REMOVED' && d.status === 'REMOVED') return false;
        return true;
      }) || null),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, createdAt: new Date(), updatedAt: new Date(), tenant: store.tenants[0] };
        store.devices.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const device = store.devices.find((d) => d.id === where.id);
        Object.assign(device, data);
        return { ...device, tenant: store.tenants[0] };
      }),
      count: vi.fn(async () => store.devices.filter((d) => d.status !== 'REMOVED').length),
    },
    tenant: {
      findUnique: vi.fn(async () => store.tenants[0]),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => store.users.find((u) => u.id === where.id) || null),
      findFirst: vi.fn(async ({ where }: any) => store.users.find((u) => u.id === where.id && u.tenantId === where.tenantId) || null),
    },
    extension: {
      findUnique: vi.fn(async ({ where }: any) => store.extensions.find((e) => e.id === where.id) || null),
      findFirst: vi.fn(async ({ where }: any) => store.extensions.find((e) => e.id === where.id && e.tenantId === where.tenantId) || null),
    },
    phoneNumber: { findFirst: vi.fn(async () => null) },
    extensionDevice: { findFirst: vi.fn(async () => null) },
  };
}

describe('V3 deviceService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates a device and audits', async () => {
    const store = {
      devices: [],
      tenants: [{ id: 't1', name: 'Acme', timezone: 'America/New_York' }],
      extensions: [],
      users: [],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const device = await deviceService.createDevice(prisma, 't1', {
      vendor: 'yealink',
      model: 'T46U',
      macAddress: 'aa:bb:cc:dd:ee:ff',
    }, { req: {}, actor: { sub: 'admin' } });

    expect(device.vendor).toBe('yealink');
    expect(device.macAddress).toBe('AABBCCDDEEFF');
    expect(auditService.log).toHaveBeenCalledWith(expect.anything(), {}, expect.objectContaining({ action: 'v3.device.added' }));
  });

  it('assigns device to extension and employee', async () => {
    const store = {
      devices: [{ id: 'd1', tenantId: 't1', vendor: 'yealink', status: 'CREATED', employeeId: null, extensionId: null, macAddress: 'AABBCC' }],
      tenants: [{ id: 't1', name: 'Acme' }],
      extensions: [{ id: 'e1', tenantId: 't1', extensionNumber: '101', userId: 'u1' }],
      users: [{ id: 'u1', tenantId: 't1', name: 'Jane', telnyxSipUsername: 'sip-jane' }],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const device = await deviceService.assignDevice(prisma, 't1', 'd1', { extensionId: 'e1' }, { req: {} });

    expect(device.extensionId).toBe('e1');
    expect(device.employeeId).toBe('u1');
    expect(device.status).toBe('ASSIGNED');
  });

  it('soft-removes device without deleting row', async () => {
    const store = {
      devices: [{ id: 'd1', tenantId: 't1', vendor: 'yealink', status: 'CREATED', macAddress: 'AABBCC' }],
      tenants: [{ id: 't1', name: 'Acme' }],
      extensions: [],
      users: [],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    await deviceService.removeDevice(prisma, 't1', 'd1', { req: {} });
    expect(store.devices[0].status).toBe('REMOVED');
    expect(store.devices[0].removedAt).toBeTruthy();
  });
});
