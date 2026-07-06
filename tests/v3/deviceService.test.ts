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
        if (where.status === 'REMOVED' && d.status !== 'REMOVED') return false;
        if (where.status?.not === 'REMOVED' && d.status === 'REMOVED') return false;
        return true;
      }) || null),
      create: vi.fn(async ({ data }: any) => {
        // Simulate the real (tenantId, macAddress) unique DB constraint so
        // tests catch regressions where a stale row isn't purged first.
        if (data.macAddress) {
          const clash = store.devices.find((d) => d.tenantId === data.tenantId && d.macAddress === data.macAddress);
          if (clash) {
            const err: any = new Error('Unique constraint failed on the fields: (`tenantId`,`macAddress`)');
            err.code = 'P2002';
            throw err;
          }
        }
        // Prisma schema defaults not modeled by the raw `data` payload.
        const row = { configVersion: 1, provisionVersion: 1, ...data, createdAt: new Date(), updatedAt: new Date(), tenant: store.tenants[0] };
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
        if (idx === -1) {
          const err: any = new Error('Record to delete does not exist.');
          err.code = 'P2025';
          throw err;
        }
        const [removed] = store.devices.splice(idx, 1);
        return removed;
      }),
      count: vi.fn(async () => store.devices.filter((d) => d.status !== 'REMOVED').length),
    },
    v3RuntimeLink: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
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

  it('hard-deletes the device row on removal (not a soft REMOVED flag)', async () => {
    const store = {
      devices: [{ id: 'd1', tenantId: 't1', vendor: 'yealink', status: 'PROVISIONED', macAddress: 'AABBCC', employeeId: 'u1', extensionId: 'e1', metadata: { provisionKey: 'k1' } }],
      tenants: [{ id: 't1', name: 'Acme' }],
      extensions: [],
      users: [],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const result = await deviceService.removeDevice(prisma, 't1', 'd1', { req: {}, actor: { sub: 'admin' } });

    // Row must be gone entirely, not just flagged REMOVED — a lingering row
    // with the same (tenantId, macAddress) would trip the DB unique
    // constraint and block re-adding the same physical phone.
    expect(store.devices).toHaveLength(0);
    expect(result.deleted).toBe(true);
    expect(result.macAddress).toBe('AABBCC');
    expect(prisma.v3RuntimeLink.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', v3EntityType: 'device', v3EntityId: 'd1' },
    });
    expect(auditService.log).toHaveBeenCalledWith(expect.anything(), {}, expect.objectContaining({
      action: 'v3.device.removed',
      entityId: 'd1',
      oldValue: expect.objectContaining({ macAddress: 'AABBCC', employeeId: 'u1', extensionId: 'e1' }),
      newValue: { deleted: true },
    }));
  });

  it('deleting a device does not touch employee or extension records', async () => {
    const store = {
      devices: [{ id: 'd1', tenantId: 't1', vendor: 'grandstream', status: 'PROVISIONED', macAddress: 'AABBCC', employeeId: 'u1', extensionId: 'e1' }],
      tenants: [{ id: 't1', name: 'Acme' }],
      extensions: [{ id: 'e1', tenantId: 't1', extensionNumber: '101', userId: 'u1' }],
      users: [{ id: 'u1', tenantId: 't1', name: 'Jane' }],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    await deviceService.removeDevice(prisma, 't1', 'd1', { req: {} });

    expect(store.extensions).toHaveLength(1);
    expect(store.users).toHaveLength(1);
    expect(store.extensions[0]).toEqual({ id: 'e1', tenantId: 't1', extensionNumber: '101', userId: 'u1' });
    expect(store.users[0]).toEqual({ id: 'u1', tenantId: 't1', name: 'Jane' });
  });

  it('throws 404 when deleting a device that does not exist', async () => {
    const store = { devices: [], tenants: [{ id: 't1', name: 'Acme' }], extensions: [], users: [] };
    const prisma = fakePrisma(store);
    await expect(deviceService.removeDevice(prisma, 't1', 'missing', { req: {} })).rejects.toMatchObject({ status: 404 });
  });

  it('allows re-adding a device with the same MAC after it was deleted', async () => {
    const store = {
      devices: [],
      tenants: [{ id: 't1', name: 'Acme' }],
      extensions: [],
      users: [],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const first = await deviceService.createDevice(prisma, 't1', {
      vendor: 'grandstream',
      model: 'GRP2601',
      macAddress: 'EC:74:D7:51:E3:E7',
    }, { req: {} });
    expect(store.devices).toHaveLength(1);

    await deviceService.removeDevice(prisma, 't1', first.id, { req: {} });
    expect(store.devices).toHaveLength(0);

    const second = await deviceService.createDevice(prisma, 't1', {
      vendor: 'grandstream',
      model: 'GRP2601',
      macAddress: 'EC:74:D7:51:E3:E7',
    }, { req: {} });

    expect(second.id).not.toBe(first.id);
    expect(second.macAddress).toBe('EC74D751E3E7');
    expect(second.status).toBe('CREATED');
    expect(second.configVersion).toBe(1);
    expect(second.provisionVersion).toBe(1);
  });

  it('self-heals a legacy soft-deleted (REMOVED) row blocking the same MAC', async () => {
    // Simulates data left over from before the hard-delete fix: a REMOVED
    // row still occupying the (tenantId, macAddress) unique slot.
    const store = {
      devices: [{
        id: 'legacy-1', tenantId: 't1', vendor: 'grandstream', status: 'REMOVED',
        macAddress: 'EC74D751E3E7', removedAt: new Date(), metadata: {},
      }],
      tenants: [{ id: 't1', name: 'Acme' }],
      extensions: [],
      users: [],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const created = await deviceService.createDevice(prisma, 't1', {
      vendor: 'grandstream',
      macAddress: 'EC:74:D7:51:E3:E7',
    }, { req: {} });

    expect(store.devices).toHaveLength(1);
    expect(store.devices[0].id).toBe(created.id);
    expect(store.devices[0].status).toBe('CREATED');
  });
});
