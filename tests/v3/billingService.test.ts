import { describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const billingService = require('../../lib/v3/billingService.js');

function platformSettingsMock() {
  return {
    platformSettings: {
      findUnique: vi.fn(async () => ({
        id: 'default',
        defaultMaxUsers: 10,
        defaultMaxPhoneNumbers: 10,
        defaultMaxConcurrentCalls: 3,
        stripeEnabled: false,
      })),
    },
  };
}

function buildStoragePrisma() {
  return {
    callRecording: { findMany: vi.fn(async () => []) },
    voicemail: { count: vi.fn(async () => 0) },
    v3VoicemailBox: { count: vi.fn(async () => 0) },
    v3TenantBackup: {
      aggregate: vi.fn(async () => ({ _sum: { sizeBytes: 0 }, _count: 0 })),
    },
    smsMessage: { count: vi.fn(async () => 0) },
    user: {
      count: vi.fn(async () => 2),
      findMany: vi.fn(async () => [{ id: 'u1' }]),
    },
    adminAuditLog: { count: vi.fn(async () => 3) },
  };
}

describe('V3 billingService', () => {
  it('returns billing overview', async () => {
    const prisma = {
      tenant: {
        findUnique: vi.fn(async () => ({
          id: 't1',
          name: 'Acme',
          billingStatus: 'ACTIVE',
          platformFeeMonthly: 8,
          platformFeeSetup: 0,
          stripeSubscriptionId: null,
          stripeCustomerId: null,
        })),
      },
      numberOrder: { findMany: vi.fn(async () => []) },
      tenantReceivable: { findMany: vi.fn(async () => []) },
      extension: { count: vi.fn(async () => 2) },
      phoneNumber: {
        count: vi.fn(async () => 1),
        findMany: vi.fn(async () => [{ tenantMonthlyTotal: 42, platformMonthly: 8 }]),
      },
      v3DeskDevice: { count: vi.fn(async () => 0) },
      ...platformSettingsMock(),
      ...buildStoragePrisma(),
    };
    const billing = await billingService.getBillingOverview(prisma, 't1');
    expect(billing.usage.seats).toBe(2);
    expect(billing.costs.estimatedMonthlyTotal).toBe(42);
    expect(billing.plan.billingStatus).toBe('ACTIVE');
  });
});
