import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const repairService = require('../../lib/v3/repairService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const provisioningService = require('../../lib/v3/provisioningService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const extensionService = require('../../lib/v3/extensionService.js');

const TENANT = 't1';

function makeStore() {
  return {
    users: [
      { id: 'u1', tenantId: TENANT, role: 'TENANT_USER', email: 'jane@acme.test', name: 'Jane', telnyxCredentialId: 'c1', telnyxSipUsername: 's1', sipRegistered: true },
      // Employee with no extension → MISSING_EXTENSION
      { id: 'u2', tenantId: TENANT, role: 'TENANT_USER', email: 'bob@acme.test', name: 'Bob', telnyxCredentialId: null, telnyxSipUsername: null, sipRegistered: false },
    ],
    phoneNumbers: [
      { id: 'p1', tenantId: TENANT, number: '+15551230001', extensionId: 'ext1', assignedUserId: 'u1' },
    ],
    extensions: [
      // ext1: healthy but missing the security row → MISSING_SECURITY only
      {
        id: 'ext1', tenantId: TENANT, extensionNumber: '101', status: 'ACTIVE', userId: 'u1',
        security: null,
        forwarding: { extensionId: 'ext1' },
        voicemailSettings: { extensionId: 'ext1' },
        primaryPhoneNumberId: 'p1',
      },
    ],
    deletes: [] as string[],
  };
}

function fakePrisma(store: ReturnType<typeof makeStore>) {
  const noDelete = (label: string) => vi.fn(async () => { store.deletes.push(label); throw new Error(`delete not allowed: ${label}`); });
  const findExt = (id: string) => store.extensions.find((e) => e.id === id);
  const findPhone = (id: string) => store.phoneNumbers.find((p) => p.id === id);

  return {
    extension: {
      findMany: vi.fn(async ({ where }: any) => store.extensions
        .filter((e) => e.tenantId === where.tenantId)
        .map((e) => ({
          ...e,
          user: store.users.find((u) => u.id === e.userId) || null,
          primaryPhoneNumber: e.primaryPhoneNumberId ? findPhone(e.primaryPhoneNumberId) || null : null,
        }))),
      update: vi.fn(async ({ where, data }: any) => Object.assign(findExt(where.id), data)),
      delete: noDelete('extension'),
      deleteMany: noDelete('extension'),
    },
    user: {
      findMany: vi.fn(async ({ where }: any) => store.users.filter((u) => u.tenantId === where.tenantId && (!where.role || u.role === where.role))),
      delete: noDelete('user'),
      deleteMany: noDelete('user'),
    },
    phoneNumber: {
      findMany: vi.fn(async ({ where }: any) => store.phoneNumbers.filter((p) => p.tenantId === where.tenantId)),
      update: vi.fn(async ({ where, data }: any) => Object.assign(findPhone(where.id), data)),
      delete: noDelete('phoneNumber'),
      deleteMany: noDelete('phoneNumber'),
    },
    extensionSecurity: {
      create: vi.fn(async ({ data }: any) => { findExt(data.extensionId)!.security = { extensionId: data.extensionId }; }),
    },
    extensionForwarding: {
      create: vi.fn(async ({ data }: any) => { findExt(data.extensionId)!.forwarding = { extensionId: data.extensionId }; }),
    },
    extensionVoicemailSettings: {
      create: vi.fn(async ({ data }: any) => { findExt(data.extensionId)!.voicemailSettings = { ...data }; }),
    },
  };
}

function stubAutoCreate(store: ReturnType<typeof makeStore>) {
  return vi.spyOn(extensionService, 'autoCreateForEmployee').mockImplementation(async (_p: any, _t: string, user: any) => {
    user.telnyxCredentialId = 'c-new';
    user.telnyxSipUsername = 's-new';
    store.extensions.push({
      id: 'ext-new', tenantId: TENANT, extensionNumber: '102', status: 'ACTIVE', userId: user.id,
      security: { extensionId: 'ext-new' }, forwarding: { extensionId: 'ext-new' }, voicemailSettings: { extensionId: 'ext-new' },
      primaryPhoneNumberId: null,
    });
    return { id: 'ext-new', extensionNumber: '102' };
  });
}

describe('V3 repairService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('inspect detects missing extension and missing security row (read-only, no writes)', async () => {
    const store = makeStore();
    const prisma = fakePrisma(store);
    vi.spyOn(extensionService, 'autoCreateForEmployee');
    vi.spyOn(provisioningService, 'ensureExtensionProvisioned');

    const report = await repairService.inspect(prisma, TENANT);
    const types = report.changes.map((c: any) => c.type).sort();

    expect(types).toContain('MISSING_EXTENSION');
    expect(types).toContain('MISSING_SECURITY');
    // dry-run performs no writes at all
    expect(prisma.extensionSecurity.create).not.toHaveBeenCalled();
    expect(extensionService.autoCreateForEmployee).not.toHaveBeenCalled();
    expect(store.deletes).toEqual([]);
  });

  it('repair applies fixes without ever deleting data', async () => {
    const store = makeStore();
    const prisma = fakePrisma(store);
    stubAutoCreate(store);
    vi.spyOn(provisioningService, 'ensureExtensionProvisioned');

    const report = await repairService.repair(prisma, TENANT, { apply: true });

    expect(report.mode).toBe('apply');
    expect(report.applied.every((a: any) => a.ok)).toBe(true);
    expect(prisma.extensionSecurity.create).toHaveBeenCalledTimes(1);
    expect(extensionService.autoCreateForEmployee).toHaveBeenCalledTimes(1);
    // No delete/deleteMany was ever invoked.
    expect(store.deletes).toEqual([]);
    expect(prisma.extension.delete).not.toHaveBeenCalled();
    expect(prisma.phoneNumber.deleteMany).not.toHaveBeenCalled();
  });

  it('is idempotent: a second repair run finds nothing to change', async () => {
    const store = makeStore();
    const prisma = fakePrisma(store);
    stubAutoCreate(store);
    vi.spyOn(provisioningService, 'ensureExtensionProvisioned');

    await repairService.repair(prisma, TENANT, { apply: true });
    const second = await repairService.repair(prisma, TENANT, { apply: true });

    expect(second.changes).toEqual([]);
    expect(second.applied).toEqual([]);
  });
});
