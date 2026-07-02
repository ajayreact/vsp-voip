import { describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const licenseService = require('../../lib/v3/licenseService.js');

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

describe('V3 licenseService', () => {
  it('returns license warnings near limits', async () => {
    const prisma = {
      tenant: {
        findUnique: vi.fn(async () => ({
          id: 't1',
          billingStatus: 'GRACE',
          billingGraceUntil: new Date(Date.now() + 86400000),
          maxUsers: 10,
          maxPhoneNumbers: 10,
          maxConcurrentCalls: 3,
          stripeSubscriptionId: null,
          stripeCustomerId: null,
        })),
      },
      v3FeatureFlag: { findUnique: vi.fn(async () => ({ engineEnabled: true })) },
      user: { count: vi.fn(async () => 10) },
      extension: { count: vi.fn(async () => 9) },
      phoneNumber: {
        count: vi.fn(async () => 9),
        findMany: vi.fn(async () => []),
      },
      ...platformSettingsMock(),
    };
    const license = await licenseService.getLicense(prisma, 't1');
    expect(license.warnings.length).toBeGreaterThan(0);
    expect(license.health.seats).toBe('red');
    expect(license.warnings.some((w: { code: string }) => w.code === 'BILLING_GRACE')).toBe(true);
  });
});
