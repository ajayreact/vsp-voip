import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const { evaluateMobilePolicy } = require('../../lib/telephony-v3/Routing/mobilePolicy');
const { POLICY_ACTION } = require('../../lib/telephony-v3/Routing/mobileRouteResult');
const prisma = require('../../lib/telephony-v3/internal/prisma');

describe('V3 mobilePolicy', () => {
  beforeEach(() => {
    prisma.__setGetPrismaForTests(async () => ({
      extension: { findMany: async () => [] },
    }));
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
  });

  it('allows in observe mode even when policy action is DENY', async () => {
    const decision = await evaluateMobilePolicy({
      tenant: { id: 'tenant-1', timezone: 'America/New_York' },
      callerExtension: {
        security: {
          internationalEnabled: false,
          callingPermissions: { international: false },
        },
      },
      targetExtension: null,
      destination: { pstnNumber: '+442071234567' },
      routingFlow: 'MOBILE_TO_PSTN',
      from: 'ext:101',
      observeOnly: true,
    });

    expect(decision.action).toBe(POLICY_ACTION.DENY);
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
    expect(decision.enforced).toBe(false);
  });

  it('enforces deny for international PSTN when observeOnly=false', async () => {
    const decision = await evaluateMobilePolicy({
      tenant: { id: 'tenant-1', timezone: 'America/New_York' },
      callerExtension: {
        security: {
          internationalEnabled: false,
          callingPermissions: { international: false },
        },
      },
      targetExtension: null,
      destination: { pstnNumber: '+442071234567' },
      routingFlow: 'MOBILE_TO_PSTN',
      from: 'ext:101',
      observeOnly: false,
    });

    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
    expect(decision.enforced).toBe(true);
  });
});
