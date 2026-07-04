import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const repairService = require('../../lib/v3/repairService.js');

function fakePrisma(store: { phones: any[]; extensions: any[] }) {
  return {
    phoneNumber: {
      findMany: vi.fn(async () => store.phones.map((p) => ({
        ...p,
        extension: store.extensions.find((e) => e.id === p.extensionId) || null,
        assignedUser: null,
        tenant: p.tenantId ? { id: p.tenantId, name: 'Acme' } : null,
      }))),
      update: vi.fn(async ({ where, data }: any) => {
        const phone = store.phones.find((p) => p.id === where.id);
        Object.assign(phone, data);
        return phone;
      }),
    },
    extension: {
      update: vi.fn(async ({ where, data }: any) => {
        const ext = store.extensions.find((e) => e.id === where.id);
        Object.assign(ext, data);
        return ext;
      }),
    },
  };
}

describe('V3 repairService.repairNumbers', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('detects broken employee link and repairs assignedUserId', async () => {
    const store = {
      phones: [{
        id: 'p1', tenantId: 't1', number: '+15551230001', extensionId: 'e1',
        assignedUserId: null, routingType: 'tenant_default',
      }],
      extensions: [{ id: 'e1', tenantId: 't1', extensionNumber: '101', userId: 'u1', primaryPhoneNumberId: null }],
    };
    const prisma = fakePrisma(store);

    const inspect = await repairService.inspectNumbers(prisma, 't1');
    expect(inspect.changes.some((c: any) => c.type === 'BROKEN_EMPLOYEE_LINK')).toBe(true);

    const applied = await repairService.repairNumbers(prisma, 't1', { apply: true });
    expect(applied.applied.every((a: any) => a.ok)).toBe(true);
    expect(store.phones[0].assignedUserId).toBe('u1');

    const second = await repairService.repairNumbers(prisma, 't1', { apply: true });
    expect(second.changes).toEqual([]);
  });

  it('never calls delete operations', async () => {
    const store = {
      phones: [{ id: 'p1', tenantId: 't1', number: '+15551230001', extensionId: null, assignedUserId: null, routingType: 'tenant_default' }],
      extensions: [],
    };
    const prisma = fakePrisma(store);
    prisma.phoneNumber.delete = vi.fn();
    prisma.phoneNumber.deleteMany = vi.fn();

    await repairService.repairNumbers(prisma, 't1', { apply: true });
    expect(prisma.phoneNumber.delete).not.toHaveBeenCalled();
    expect(prisma.phoneNumber.deleteMany).not.toHaveBeenCalled();
  });
});
