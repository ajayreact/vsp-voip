import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const employeeService = require('../../lib/v3/employeeService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const extensionService = require('../../lib/v3/extensionService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const provisioningService = require('../../lib/v3/provisioningService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const healthCheckService = require('../../lib/v3/healthCheckService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function fakePrisma() {
  const tx = {
    tenant: { findUnique: vi.fn(async () => ({ id: 't1', name: 'Acme', isActive: true })) },
    user: {
      create: vi.fn(async ({ data }: any) => ({ id: 'u1', email: data.email, name: data.name, role: data.role })),
    },
    extension: {
      findUnique: vi.fn(async () => ({ id: 'ext-1', userId: 'u1', tenantId: 't1', extensionNumber: '101' })),
    },
  };
  return {
    ...tx,
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
}

describe('V3 employeeService.createEmployee', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.QUOTA_ENFORCE_SUPER_ADMIN = 'false';
  });

  it('creates a TENANT_USER inside a transaction with extension, provisioning, and audit', async () => {
    vi.spyOn(extensionService, 'autoCreateForEmployee').mockResolvedValue({ id: 'ext-1', extensionNumber: '101', displayName: 'Jane Doe' });
    vi.spyOn(provisioningService, 'ensureExtensionProvisioned').mockResolvedValue({ ok: true, provisioned: true, telnyxSipUsername: 'gencred-jane' });
    vi.spyOn(healthCheckService, 'employeeHealth').mockResolvedValue({ employees: [{ employeeId: 'u1', overall: 'green' }] });
    vi.spyOn(auditService, 'logTransactional').mockResolvedValue(undefined);

    const prisma = fakePrisma();
    const result = await employeeService.createEmployee(
      prisma,
      't1',
      { name: 'Jane Doe', email: 'Jane@Acme.test', password: 'secret1' },
      { req: { ip: '127.0.0.1' }, actor: { role: 'SUPER_ADMIN' } },
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.create.mock.calls[0][0].data.role).toBe('TENANT_USER');
    expect(prisma.user.create.mock.calls[0][0].data.email).toBe('jane@acme.test');
    expect(extensionService.autoCreateForEmployee).toHaveBeenCalledTimes(1);
    expect(provisioningService.ensureExtensionProvisioned).toHaveBeenCalledTimes(1);
    expect(auditService.logTransactional).toHaveBeenCalledTimes(1);

    expect(result.employee.id).toBe('u1');
    expect(result.extension.extensionNumber).toBe('101');
    expect(result.provision.provisioned).toBe(true);
    expect(result.health).toEqual({ employeeId: 'u1', overall: 'green' });
  });

  it('rolls back when extension creation fails (no orphan user)', async () => {
    vi.spyOn(extensionService, 'autoCreateForEmployee').mockRejectedValue(new Error('extension failed'));
    vi.spyOn(auditService, 'logTransactional');

    const prisma = fakePrisma();
    await expect(
      employeeService.createEmployee(
        prisma,
        't1',
        { name: 'Jane Doe', email: 'jane@acme.test', password: 'secret1' },
        { actor: { role: 'SUPER_ADMIN' } },
      ),
    ).rejects.toThrow(/extension failed/);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(auditService.logTransactional).not.toHaveBeenCalled();
  });

  it('rejects weak passwords before touching the database', async () => {
    const prisma = fakePrisma();
    await expect(
      employeeService.createEmployee(prisma, 't1', { name: 'A', email: 'a@b.c', password: '123' }, {}),
    ).rejects.toThrow(/at least 6 characters/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires name, email and password', async () => {
    const prisma = fakePrisma();
    await expect(
      employeeService.createEmployee(prisma, 't1', { name: '', email: '', password: '' }, {}),
    ).rejects.toThrow(/required/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
