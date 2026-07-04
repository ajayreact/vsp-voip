import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const assignmentService = require('../../lib/v3/assignmentService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const provisioningService = require('../../lib/v3/provisioningService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const inventoryHealthService = require('../../lib/v3/inventoryHealthService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function fakePrisma(store: Record<string, unknown>) {
  const tx = {
    phoneNumber: {
      findFirst: vi.fn(async ({ where }: any) => store.phones.find((p: any) => p.id === where.id && p.tenantId === where.tenantId) || null),
      update: vi.fn(async ({ where, data }: any) => {
        const phone = store.phones.find((p: any) => p.id === where.id);
        Object.assign(phone, data);
        return phone;
      }),
    },
    extension: {
      findFirst: vi.fn(async ({ where }: any) => store.extensions.find((e: any) => e.id === where.id && e.tenantId === where.tenantId) || null),
      update: vi.fn(async ({ where, data }: any) => {
        const ext = store.extensions.find((e: any) => e.id === where.id);
        Object.assign(ext, data);
        return ext;
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    user: {
      findFirst: vi.fn(async ({ where }: any) => store.users.find((u: any) => u.id === where.id) || null),
    },
    didAssignmentHistory: { create: vi.fn(async () => ({})) },
  };
  return {
    ...tx,
    extension: {
      ...tx.extension,
      findUnique: vi.fn(async ({ where }: any) => store.extensions.find((e: any) => e.id === where.id) || null),
    },
    $transaction: vi.fn(async (fn: (c: typeof tx) => Promise<unknown>) => fn(tx)),
  };
}

describe('V3 assignmentService.assignNumberToExtension', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('links phone to extension in a transaction and provisions after commit', async () => {
    const store = {
      phones: [{ id: 'p1', tenantId: 't1', number: '+15551230001', extensionId: null, assignedUserId: null, routingType: 'tenant_default' }],
      extensions: [{ id: 'e1', tenantId: 't1', extensionNumber: '101', displayName: 'Jane', userId: 'u1', primaryPhoneNumberId: null }],
      users: [{ id: 'u1', tenantId: 't1', name: 'Jane' }],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(provisioningService, 'ensureExtensionProvisioned').mockResolvedValue({ ok: true, provisioned: true });
    vi.spyOn(inventoryHealthService, 'getNumberHealth').mockResolvedValue({ overall: 'green' });
    vi.spyOn(auditService, 'logTransactional').mockResolvedValue(undefined);

    const result = await assignmentService.assignNumberToExtension(
      prisma, 't1', { phoneNumberId: 'p1', extensionId: 'e1' }, { req: {}, actor: { sub: 'admin' } },
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(store.phones[0].extensionId).toBe('e1');
    expect(store.extensions[0].primaryPhoneNumberId).toBe('p1');
    expect(result.provision.provisioned).toBe(true);
  });

  it('rolls back when extension is missing', async () => {
    const store = {
      phones: [{ id: 'p1', tenantId: 't1', number: '+15551230001', extensionId: null, assignedUserId: null, routingType: 'tenant_default' }],
      extensions: [],
      users: [],
    };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'logTransactional');

    await expect(
      assignmentService.assignNumberToExtension(
        prisma, 't1', { phoneNumberId: 'p1', extensionId: 'missing' }, { actor: {} },
      ),
    ).rejects.toThrow(/Extension not found/);

    expect(store.phones[0].extensionId).toBeNull();
    expect(auditService.logTransactional).not.toHaveBeenCalled();
  });
});
