import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const {
  evaluateConferencePolicy,
  resetConferencePolicyForTests,
} = require('../../lib/telephony-v3/Conference/conferencePolicy');
const { POLICY_ACTION, CONFERENCE_ACTION } = require('../../lib/telephony-v3/Conference/conferenceConstants');
const prisma = require('../../lib/telephony-v3/internal/prisma');

describe('V3 conferencePolicy', () => {
  beforeEach(() => {
    resetConferencePolicyForTests();
    prisma.__setGetPrismaForTests(async () => ({
      tenant: { findUnique: async () => ({ id: 'tenant-1' }) },
    }));
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
  });

  it('allows create when conference enabled', async () => {
    const decision = await evaluateConferencePolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: CONFERENCE_ACTION.CREATE,
      conferenceEnabled: true,
      observeOnly: false,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
    expect(decision.maxParticipants).toBe(10);
  });

  it('denies when conference disabled', async () => {
    const decision = await evaluateConferencePolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: CONFERENCE_ACTION.CREATE,
      conferenceEnabled: false,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });

  it('denies join when max participants reached', async () => {
    const participants = Array.from({ length: 10 }, (_, i) => ({
      callControlId: `cc-${i}`,
      role: 'PARTICIPANT',
    }));
    const decision = await evaluateConferencePolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: CONFERENCE_ACTION.JOIN,
      conferenceEnabled: true,
      maxParticipants: 10,
      conference: { participants },
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });

  it('denies recording when policy disabled', async () => {
    const decision = await evaluateConferencePolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: CONFERENCE_ACTION.START_RECORDING,
      conferenceEnabled: true,
      conferenceRecordingPolicy: 'DISABLED',
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });

  it('observe mode keeps effective allow on deny', async () => {
    const decision = await evaluateConferencePolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: CONFERENCE_ACTION.CREATE,
      conferenceEnabled: false,
      observeOnly: true,
    });
    expect(decision.action).toBe(POLICY_ACTION.DENY);
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
  });
});
