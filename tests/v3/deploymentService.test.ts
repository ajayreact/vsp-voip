import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const deploymentService = require('../../lib/v3/deploymentService.js');

describe('V3 deploymentService', () => {
  beforeEach(() => {
    process.env.V3_PORTAL_ENABLED = 'true';
    process.env.V3_RUNTIME_SYNC_ENABLED = 'false';
  });

  it('returns deployment readiness snapshot', async () => {
    const prisma = {
      tenant: {
        findUnique: vi.fn(async () => ({
          id: 't1',
          name: 'Acme',
          isActive: true,
          timezone: 'UTC',
          updatedAt: new Date(),
        })),
      },
      v3MigrationRun: { count: vi.fn(async () => 0) },
      v3TenantBackup: {
        findFirst: vi.fn(async () => ({ id: 'b1', createdAt: new Date(), label: 'Latest' })),
      },
    };

    const status = await deploymentService.getDeploymentStatus(prisma, 't1');
    expect(status.tenant.name).toBe('Acme');
    expect(status.readiness.portalEnabled).toBe(true);
    expect(status.readiness.hasRecentBackup).toBe(true);
    expect(status.latestBackup?.id).toBe('b1');
  });

  it('throws when tenant missing', async () => {
    const prisma = { tenant: { findUnique: vi.fn(async () => null) } };
    await expect(deploymentService.getDeploymentStatus(prisma, 'missing')).rejects.toMatchObject({ status: 404 });
  });
});
