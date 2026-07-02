import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const testLabService = require('../../lib/v3/testLabService.js');

describe('V3 testLabService', () => {
  beforeEach(() => {
    process.env.V3_TEST_LAB_ENABLED = 'true';
    process.env.NODE_ENV = 'test';
    vi.restoreAllMocks();
  });

  it('reports disabled when env flag off', async () => {
    process.env.V3_TEST_LAB_ENABLED = 'false';
    const status = await testLabService.getTestLabStatus();
    expect(status.enabled).toBe(false);
  });

  it('blocks when test lab disabled', () => {
    process.env.V3_TEST_LAB_ENABLED = 'false';
    expect(() => testLabService.assertTestLabAllowed()).toThrow(/disabled/i);
  });

  it('identifies test lab tenant names', () => {
    expect(testLabService.isTestLabTenantName('VSP V3 Test')).toBe(true);
    expect(testLabService.isTestLabTenantName('test-lab-123')).toBe(true);
    expect(testLabService.isTestLabTenantName('Acme Corp')).toBe(false);
  });

  it('refuses teardown for non-test tenants', async () => {
    const prisma = {
      tenant: { findUnique: vi.fn(async () => ({ id: 't1', name: 'Acme Corp' })) },
      v3TestLabRun: { findFirst: vi.fn(async () => null) },
    };
    await expect(testLabService.teardownTestTenant(prisma, 't1')).rejects.toMatchObject({ status: 403 });
  });
});
