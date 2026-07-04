import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const { evaluatePstnPolicy, isAnonymousCaller } = require('../../lib/telephony-v3/Routing/pstnPolicy');
const { POLICY_ACTION } = require('../../lib/telephony-v3/Routing/pstnRouteResult');
const prisma = require('../../lib/telephony-v3/internal/prisma');

describe('V3 pstnPolicy', () => {
  beforeEach(() => {
    prisma.__setGetPrismaForTests(async () => ({
      extension: { findMany: async () => [] },
    }));
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
  });

  it('detects anonymous callers', () => {
    expect(isAnonymousCaller('anonymous')).toBe(true);
    expect(isAnonymousCaller('+15551234567')).toBe(false);
  });

  it('denies unknown DID routing flow only in observe-off blocked paths via security', async () => {
    const decision = await evaluatePstnPolicy({
      tenant: { id: 'tenant-1', timezone: 'America/New_York' },
      targetExtension: null,
      phoneRecord: null,
      destination: null,
      routingFlow: 'UNKNOWN',
      from: '+15551234567',
      observeOnly: false,
    });

    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
    expect(decision.rules.some((r) => r.rule === 'unknown_did')).toBe(true);
  });

  it('allows in observe mode even when policy action is DENY', async () => {
    const decision = await evaluatePstnPolicy({
      tenant: { id: 'tenant-1', timezone: 'America/New_York' },
      targetExtension: { security: { blockAnonymous: true } },
      phoneRecord: { id: 'did-1' },
      destination: { did: '+15559876543' },
      routingFlow: 'PSTN_TO_DESK',
      from: 'anonymous',
      observeOnly: true,
    });

    expect(decision.action).toBe(POLICY_ACTION.DENY);
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
    expect(decision.enforced).toBe(false);
  });

  it('denies anonymous callers when blockAnonymous enabled', async () => {
    const decision = await evaluatePstnPolicy({
      tenant: { id: 'tenant-1', timezone: 'America/New_York' },
      targetExtension: { security: { blockAnonymous: true } },
      phoneRecord: { id: 'did-1' },
      destination: { did: '+15559876543' },
      routingFlow: 'PSTN_TO_DESK',
      from: 'anonymous',
      observeOnly: false,
    });

    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });
});
