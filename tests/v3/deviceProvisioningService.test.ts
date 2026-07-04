import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deviceProvisioningService = require('../../lib/v3/deviceProvisioningService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const provisioningService = require('../../lib/v3/provisioningService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const extensionProvisioning = require('../../lib/extensionProvisioning.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function fakePrisma(store: { devices: any[]; extensions: any[]; users: any[]; tenants: any[] }) {
  return {
    v3DeskDevice: {
      findFirst: vi.fn(async ({ where }: any) => store.devices.find((d) => d.id === where.id) || null),
      update: vi.fn(async ({ where, data }: any) => {
        const device = store.devices.find((d) => d.id === where.id);
        Object.assign(device, data);
        return device;
      }),
    },
    extension: {
      findFirst: vi.fn(async () => ({
        id: 'e1',
        tenantId: 't1',
        extensionNumber: '101',
        displayName: 'Jane',
        userId: 'u1',
        user: { tenant: store.tenants[0] },
      })),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => ({
        id: 'e1',
        tenantId: 't1',
        extensionNumber: '101',
        displayName: 'Jane',
        userId: 'u1',
        sipEnabled: true,
      })),
    },
    tenant: { findUnique: vi.fn(async () => store.tenants[0]) },
    user: { findUnique: vi.fn(async () => store.users[0]) },
    phoneNumber: { findFirst: vi.fn(async () => ({ number: '+15551230001' })) },
  };
}

describe('V3 deviceProvisioningService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('generates vendor config for assigned device', async () => {
    const store = {
      devices: [{ id: 'd1', tenantId: 't1', vendor: 'yealink', extensionId: 'e1', employeeId: 'u1', status: 'ASSIGNED', configVersion: 1, provisionVersion: 1 }],
      extensions: [],
      users: [{ id: 'u1', name: 'Jane', telnyxSipUsername: 'sip-jane', telnyxSipPassword: 'pass' }],
      tenants: [{ id: 't1', name: 'Acme', timezone: 'America/New_York' }],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(provisioningService, 'ensureExtensionProvisioned').mockResolvedValue({ ok: true, provisioned: true });
    vi.spyOn(extensionProvisioning, 'getExtensionSipCredentials').mockResolvedValue({
      provisioningProfile: { sip: { username: 'sip-jane', password: 'pass' } },
      configExport: { format: 'vsp-extension-config' },
    });

    const generated = await deviceProvisioningService.generateDeviceConfig(prisma, 't1', 'd1');
    expect(generated.config.vendor).toBe('yealink');
    expect(generated.config.body).toContain('account.1.user_name');
    expect(generated.provisionUrl).toContain('d1');
  });

  it('provisions device and updates status with audit', async () => {
    const store = {
      devices: [{ id: 'd1', tenantId: 't1', vendor: 'grandstream', extensionId: 'e1', employeeId: 'u1', status: 'ASSIGNED', configVersion: 1, provisionVersion: 1 }],
      extensions: [],
      users: [{ id: 'u1', name: 'Jane', telnyxSipUsername: 'sip-jane', telnyxSipPassword: 'pass' }],
      tenants: [{ id: 't1', name: 'Acme', timezone: 'America/New_York' }],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(provisioningService, 'ensureExtensionProvisioned').mockResolvedValue({ ok: true, provisioned: true });
    vi.spyOn(extensionProvisioning, 'getExtensionSipCredentials').mockResolvedValue({
      provisioningProfile: { sip: { username: 'sip-jane', password: 'pass' } },
      configExport: {},
    });
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);
    prisma.extensionDevice = { findFirst: vi.fn(async () => null) };

    const result = await deviceProvisioningService.provisionDevice(prisma, 't1', 'd1', {}, { req: {}, actor: { sub: 'admin' } });
    expect(store.devices[0].status).toBe('PROVISIONED');
    expect(result.config.format).toBe('grandstream-compatible');
    expect(auditService.log).toHaveBeenCalledWith(expect.anything(), {}, expect.objectContaining({ action: 'v3.device.provisioned' }));
  });
});
