import { describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const subscriptionService = require('../../lib/v3/subscriptionService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

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

function basePrisma(overrides: Record<string, unknown> = {}) {
  return {
    tenant: {
      findUnique: vi.fn(async () => ({
        id: 't1',
        billingStatus: 'ACTIVE',
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        maxUsers: 10,
        maxPhoneNumbers: 10,
        maxConcurrentCalls: 3,
      })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 't1',
        billingStatus: 'ACTIVE',
        stripeSubscriptionId: null,
        ...data,
      })),
    },
    v3FeatureFlag: { findUnique: vi.fn(async () => ({ engineEnabled: true })) },
    user: { count: vi.fn(async () => 2) },
    extension: { count: vi.fn(async () => 2) },
    phoneNumber: {
      count: vi.fn(async () => 1),
      findMany: vi.fn(async () => []),
    },
    ...platformSettingsMock(),
    ...overrides,
  };
}

describe('V3 subscriptionService', () => {
  it('returns subscription with tiers', async () => {
    const prisma = basePrisma();
    const sub = await subscriptionService.getSubscription(prisma, 't1');
    expect(sub.currentPlan.tier).toBe('starter');
    expect(sub.availableTiers.length).toBe(3);
    expect(sub.featureMatrix.engine).toBe(true);
  });

  it('changes plan with audit', async () => {
    const prisma = basePrisma({
      v3FeatureFlag: { findUnique: vi.fn(async () => null) },
    });
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);
    await subscriptionService.changePlan(prisma, 't1', { tier: 'business' }, { req: {} });
    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          maxUsers: 25,
          maxPhoneNumbers: 20,
          maxConcurrentCalls: 5,
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.anything(),
      {},
      expect.objectContaining({ action: 'v3.subscription.changed' }),
    );
  });
});
