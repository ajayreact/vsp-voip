import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();

vi.mock('../../lib/telephony-v3/Redis/featureFlagCache', () => ({
  getFeatureFlagCache: vi.fn(async () => null),
  setFeatureFlagCache: vi.fn(async () => {}),
  invalidateFeatureFlagCache: vi.fn(async () => {}),
}));

const prisma = require('../../lib/telephony-v3/internal/prisma');
const featureFlags = require('../../lib/telephony-v3/FeatureFlags/featureFlagService');

describe('V3 FeatureFlagService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TELEPHONY_V3_GLOBAL;
    prisma.__setGetPrismaForTests(async () => ({
      v3FeatureFlag: {
        findUnique: mockFindUnique,
        upsert: mockUpsert,
      },
    }));
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
  });

  it('returns defaults when tenant has no row', async () => {
    mockFindUnique.mockResolvedValue(null);
    const flags = await featureFlags.getTenantFlags('tenant-a');
    expect(flags.engineEnabled).toBe(false);
    expect(flags.tenantId).toBe('tenant-a');
  });

  it('isEnabled requires global and tenant engine flag', async () => {
    mockFindUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      engineEnabled: true,
      deskEnabled: true,
      mobileEnabled: false,
      pstnEnabled: false,
      transferEnabled: false,
      holdEnabled: false,
      recordingEnabled: false,
      voicemailEnabled: false,
      observeOnly: false,
    });
    process.env.TELEPHONY_V3_GLOBAL = 'true';
    expect(await featureFlags.isEnabled('tenant-a', 'deskEnabled')).toBe(true);
    expect(await featureFlags.isEnabled('tenant-a', 'mobileEnabled')).toBe(false);
  });

  it('reports global flag status', () => {
    process.env.TELEPHONY_V3_INGRESS_ENABLED = 'true';
    process.env.TELEPHONY_V3_CALLMANAGER_ENABLED = 'true';
    const status = featureFlags.getGlobalFlagStatus();
    expect(status.ingressEnabled).toBe(true);
    expect(status.callManagerEnabled).toBe(true);
    expect(featureFlags.isGlobalEngineEnabled()).toBe(false);
  });
});
