import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceService = require('../../lib/v3/deviceService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function fakePrisma(store: { devices: any[]; extensions: any[]; users: any[]; tenants: any[]; runtimeLinks?: any[] }) {
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
      delete: vi.fn(async ({ where }: any) => {
        const idx = store.devices.findIndex((d) => d.id === where.id);
        if (idx === -1) throw new Error('not found');
        const [removed] = store.devices.splice(idx, 1);
        return removed;
      }),
      count: vi.fn(async () => store.devices.filter((d) => d.status !== 'REMOVED').length),
    },
    v3RuntimeLink: {
      deleteMany: vi.fn(async ({ where }: any) => {
        store.runtimeLinks = (store.runtimeLinks || []).filter((link: any) => {
          if (where.tenantId && link.tenantId !== where.tenantId) return true;
          if (where.v3EntityType && link.v3EntityType !== where.v3EntityType) return true;
          if (where.v3EntityId && link.v3EntityId !== where.v3EntityId) return true;
          return false;
        });
        return { count: 1 };
      }),
    },
    $transaction: vi.fn(async (fn: any) => fn({
      v3RuntimeLink: {
        deleteMany: vi.fn(async ({ where }: any) => {
          store.runtimeLinks = (store.runtimeLinks || []).filter((link: any) => {
            if (where.tenantId && link.tenantId !== where.tenantId) return true;
            if (where.v3EntityType && link.v3EntityType !== where.v3EntityType) return true;
            if (where.v3EntityId && link.v3EntityId !== where.v3EntityId) return true;
            return false;
          });
          return { count: 1 };
        }),
      },
      v3DeskDevice: {
        delete: vi.fn(async ({ where }: any) => {
          const idx = store.devices.findIndex((d) => d.id === where.id);
          if (idx === -1) throw new Error('not found');
          const [removed] = store.devices.splice(idx, 1);
          return removed;
        }),
      },
    })),
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

  it('hard-deletes device, clears runtime link, and frees MAC', async () => {
    const store = {
      devices: [{
        id: 'd1',
        tenantId: 't1',
        vendor: 'grandstream',
        status: 'PROVISIONED',
        macAddress: 'AABBCCDDEEFF',
        employeeId: 'u1',
        extensionId: 'e1',
        provisionUrl: 'https://example.com/cfg.xml',
        configVersion: 2,
        provisionVersion: 2,
      }],
      runtimeLinks: [{ tenantId: 't1', v3EntityType: 'device', v3EntityId: 'd1' }],
      tenants: [{ id: 't1', name: 'Acme' }],
      extensions: [],
      users: [],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const removed = await deviceService.removeDevice(prisma, 't1', 'd1', { req: {} });

    expect(removed.removed).toBe(true);
    expect(removed.macAddress).toBe('AABBCCDDEEFF');
    expect(store.devices).toHaveLength(0);
    expect(store.runtimeLinks).toHaveLength(0);
    expect(auditService.log).toHaveBeenCalledWith(expect.anything(), {}, expect.objectContaining({ action: 'v3.device.removed' }));
  });

  it('removes device by MAC address', async () => {
    const store = {
      devices: [{ id: 'd1', tenantId: 't1', vendor: 'yealink', status: 'ASSIGNED', macAddress: 'AABBCC' }],
      runtimeLinks: [],
      tenants: [{ id: 't1', name: 'Acme' }],
      extensions: [],
      users: [],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const removed = await deviceService.removeDeviceByMac(prisma, 't1', 'aa:bb:cc', { req: {} });

    expect(removed.macAddress).toBe('AABBCC');
    expect(store.devices).toHaveLength(0);
  });
});
