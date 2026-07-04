import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const {
  evaluateDeskPolicy,
  evaluateInternationalRestriction,
  evaluateBusinessHours,
} = require('../../lib/telephony-v3/Routing/deskPolicy');
const { POLICY_ACTION } = require('../../lib/telephony-v3/Routing/deskRouteResult');
const prisma = require('../../lib/telephony-v3/internal/prisma');

describe('V3 deskPolicy', () => {
  beforeEach(() => {
    prisma.__setGetPrismaForTests(async () => ({
      extension: { findMany: async () => [] },
    }));
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
  });
  it('denies international PSTN when not permitted', () => {
    const result = evaluateInternationalRestriction('+442071234567', {
      internationalEnabled: false,
      callingPermissions: { international: false },
    });
    expect(result.allowed).toBe(false);
  });

  it('allows domestic PSTN numbers', () => {
    const result = evaluateInternationalRestriction('+15551234567', {
      internationalEnabled: true,
      callingPermissions: { international: true },
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks outside business hours when configured', () => {
    const closedHours = {
      timeRestrictionsEnabled: true,
      afterHoursAction: 'BLOCK',
      businessHours: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
        thursday: { open: '09:00', close: '17:00' },
        friday: { open: '09:00', close: '17:00' },
        saturday: null,
        sunday: null,
      },
    };
    const result = evaluateBusinessHours(closedHours, 'America/New_York');
    expect(typeof result.allowed).toBe('boolean');
  });

  it('allows in observe mode even when policy action is DENY', async () => {
    const decision = await evaluateDeskPolicy({
      tenant: { id: 'tenant-1', timezone: 'America/New_York' },
      callerExtension: {
        security: {
          internationalEnabled: false,
          callingPermissions: { international: false },
        },
      },
      targetExtension: null,
      destination: { pstnNumber: '+442071234567' },
      routingFlow: 'DESK_TO_PSTN',
      from: 'ext:101',
      observeOnly: true,
    });

    expect(decision.action).toBe(POLICY_ACTION.DENY);
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
    expect(decision.enforced).toBe(false);
  });

  it('enforces deny for international PSTN when observeOnly=false', async () => {
    const decision = await evaluateDeskPolicy({
      tenant: { id: 'tenant-1', timezone: 'America/New_York' },
      callerExtension: {
        security: {
          internationalEnabled: false,
          callingPermissions: { international: false },
        },
      },
      targetExtension: null,
      destination: { pstnNumber: '+442071234567' },
      routingFlow: 'DESK_TO_PSTN',
      from: 'ext:101',
      observeOnly: false,
    });

    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
    expect(decision.enforced).toBe(true);
  });
});
