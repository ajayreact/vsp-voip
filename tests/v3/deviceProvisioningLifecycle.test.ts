import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * End-to-end regression coverage for the Grandstream device provisioning
 * lifecycle bug: devices could not be re-added after "deletion" because the
 * old implementation only soft-flagged status=REMOVED, leaving the row in
 * place and tripping the (tenantId, macAddress) DB unique constraint.
 *
 * Mirrors the real flow: Device Provision UI -> deviceService (CRUD) ->
 * deviceProvisioningService (regenerate) -> deviceTemplateService /
 * grandstreamPvalueConfig (config + XML builders).
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceService = require('../../lib/v3/deviceService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceProvisioningService = require('../../lib/v3/deviceProvisioningService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const provisioningService = require('../../lib/v3/provisioningService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

const MAC = 'EC:74:D7:51:E3:E7';
const NORMALIZED_MAC = 'EC74D751E3E7';

function makeStore() {
  return {
    devices: [] as any[],
    extensions: [{
      id: 'e1', tenantId: 't1', extensionNumber: '100', displayName: 'Ajay',
      userId: 'u1', sipEnabled: true, user: null as any,
    }],
    users: [{ id: 'u1', tenantId: 't1', name: 'Ajay', email: 'ajay@test.com', telnyxSipUsername: 'gencred-ajay-v1', telnyxSipPassword: 'secret-v1' }],
    tenants: [{ id: 't1', name: 'VSP Internal', timezone: 'America/New_York' }],
  };
}

function fakePrisma(store: ReturnType<typeof makeStore>) {
  store.extensions[0].user = { ...store.users[0], tenant: store.tenants[0] };

  return {
    v3DeskDevice: {
      findFirst: vi.fn(async ({ where }: any) => store.devices.find((d) => {
        if (where.id && d.id !== where.id) return false;
        if (where.tenantId && d.tenantId !== where.tenantId) return false;
        if (where.macAddress && d.macAddress !== where.macAddress) return false;
        if (where.status === 'REMOVED' && d.status !== 'REMOVED') return false;
        if (where.status?.not === 'REMOVED' && d.status === 'REMOVED') return false;
        return true;
      }) || null),
      findMany: vi.fn(async ({ where }: any) => store.devices.filter((d) => (!where?.tenantId || d.tenantId === where.tenantId))),
      create: vi.fn(async ({ data }: any) => {
        if (data.macAddress) {
          const clash = store.devices.find((d) => d.tenantId === data.tenantId && d.macAddress === data.macAddress);
          if (clash) {
            const err: any = new Error('Unique constraint failed on (tenantId, macAddress)');
            err.code = 'P2002';
            throw err;
          }
        }
        const row = { configVersion: 1, provisionVersion: 1, metadata: {}, createdAt: new Date(), updatedAt: new Date(), tenant: store.tenants[0], ...data };
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
        if (idx === -1) throw Object.assign(new Error('Record to delete does not exist.'), { code: 'P2025' });
        const [removed] = store.devices.splice(idx, 1);
        return removed;
      }),
    },
    v3RuntimeLink: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    extension: {
      findFirst: vi.fn(async ({ where }: any) => store.extensions.find((e) => e.id === where.id && e.tenantId === where.tenantId) || null),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async ({ where }: any) => store.extensions.find((e) => e.id === where.id) || null),
    },
    tenant: { findUnique: vi.fn(async () => store.tenants[0]) },
    user: {
      findUnique: vi.fn(async ({ where }: any) => store.users.find((u) => u.id === where.id) || null),
      findFirst: vi.fn(async ({ where }: any) => store.users.find((u) => u.id === where.id && u.tenantId === where.tenantId) || null),
    },
    phoneNumber: { findFirst: vi.fn(async () => ({ number: '+13139215654' })) },
    extensionDevice: { findFirst: vi.fn(async () => null) },
  };
}

describe('Device provisioning lifecycle (add → provision → delete → re-add)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('covers the full regression checklist for the Grandstream re-provisioning bug', async () => {
    const store = makeStore();
    const prisma = fakePrisma(store);
    vi.spyOn(provisioningService, 'ensureExtensionProvisioned').mockResolvedValue({ ok: true, provisioned: true });
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    // ✓ Add device
    const created = await deviceService.createDevice(prisma, 't1', {
      vendor: 'grandstream', model: 'GRP2601', macAddress: MAC,
    }, { req: {}, actor: { sub: 'admin' } });
    expect(created.macAddress).toBe(NORMALIZED_MAC);
    expect(created.status).toBe('CREATED');

    await deviceService.assignDevice(prisma, 't1', created.id, { extensionId: 'e1' }, { req: {} });
    expect(store.devices[0].extensionId).toBe('e1');
    expect(store.devices[0].employeeId).toBe('u1');

    // ✓ Regenerate XML / ✓ XML contains latest values
    const firstProvision = await deviceProvisioningService.provisionDevice(prisma, 't1', created.id, {}, { req: {}, actor: { sub: 'admin' } });
    expect(firstProvision.device.status).toBe('PROVISIONED');
    const firstConfig = JSON.parse(firstProvision.config.body);
    expect(firstConfig['SIP Server']).toBe('sip.telnyx.com');
    expect(firstConfig['Outbound Proxy']).toBe('sip.telnyx.com:5060');
    expect(firstConfig['SIP User ID']).toBe('gencred-ajay-v1');
    expect(firstConfig['Authentication ID']).toBe('gencred-ajay-v1');
    expect(firstConfig['Authentication Password']).toBe('secret-v1');
    expect(firstConfig['SIP Port']).toBe(5060);
    expect(firstConfig['Transport']).toBe('UDP');
    expect(firstConfig['DTMF Mode']).toBe('RFC2833');
    expect(firstConfig['Registration Expiration']).toBe(3600);
    expect(firstConfig['SRTP']).toBe('Optional');
    expect(firstConfig['STUN']).toBe('stun.telnyx.com:3478');
    expect(firstConfig['Symmetric RTP']).toBe(true);
    expect(firstConfig['RTP Port Range']).toBe('10000-20000');
    expect(firstConfig['Preferred Vocoder Order']).toEqual(expect.arrayContaining(['G722', 'G711u (PCMU)', 'G711a (PCMA)']));
    const firstProvisionKey = store.devices[0].metadata.provisionKey;
    expect(firstProvisionKey).toBeTruthy();

    // ✓ Delete device
    const deleteResult = await deviceService.removeDevice(prisma, 't1', created.id, { req: {}, actor: { sub: 'admin' } });
    expect(deleteResult.deleted).toBe(true);
    expect(store.devices).toHaveLength(0);
    expect(prisma.v3RuntimeLink.deleteMany).toHaveBeenCalledWith({ where: { tenantId: 't1', v3EntityType: 'device', v3EntityId: created.id } });

    // Employee and Extension are untouched by the delete.
    expect(store.extensions[0].id).toBe('e1');
    expect(store.extensions[0].userId).toBe('u1');
    expect(store.users[0].id).toBe('u1');

    // ✓ Re-add same MAC — must succeed (this previously failed with a unique
    // constraint violation because the old row was only soft-deleted).
    const recreated = await deviceService.createDevice(prisma, 't1', {
      vendor: 'grandstream', model: 'GRP2601', macAddress: MAC,
    }, { req: {}, actor: { sub: 'admin' } });
    expect(recreated.id).not.toBe(created.id);
    expect(recreated.macAddress).toBe(NORMALIZED_MAC);
    expect(recreated.status).toBe('CREATED');
    expect(recreated.configVersion).toBe(1);
    expect(recreated.provisionVersion).toBe(1);
    expect(store.devices[0].metadata).toEqual({}); // ✓ provisioning cache cleared — no leftover key

    // ✓ Extension still linked / ✓ Employee unchanged — re-assign the newly
    // created device row (assignment is per-device, not auto-inherited).
    await deviceService.assignDevice(prisma, 't1', recreated.id, { extensionId: 'e1' }, { req: {} });
    expect(store.devices[0].extensionId).toBe('e1');
    expect(store.devices[0].employeeId).toBe('u1');

    // Simulate SIP credential rotation in the DB between provisions — the
    // regenerated config must reflect this, not the value cached above.
    store.users[0].telnyxSipUsername = 'gencred-ajay-v2';
    store.users[0].telnyxSipPassword = 'secret-v2';

    const secondProvision = await deviceProvisioningService.provisionDevice(prisma, 't1', recreated.id, { regenerate: true }, { req: {}, actor: { sub: 'admin' } });
    const secondConfig = JSON.parse(secondProvision.config.body);

    // ✓ XML/config contains latest values (no stale cache reused)
    expect(secondConfig['SIP User ID']).toBe('gencred-ajay-v2');
    expect(secondConfig['Authentication Password']).toBe('secret-v2');
    expect(secondConfig['SIP User ID']).not.toBe('gencred-ajay-v1');

    // ✓ Provisioning cache cleared — new device got its own fresh key, not
    // the deleted device's key.
    const secondProvisionKey = store.devices[0].metadata.provisionKey;
    expect(secondProvisionKey).toBeTruthy();
    expect(secondProvisionKey).not.toBe(firstProvisionKey);
  });
});
