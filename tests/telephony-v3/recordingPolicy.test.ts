import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const {
  evaluateRecordingPolicy,
  resetRecordingPolicyForTests,
  mapTenantRecordingPolicy,
  recordRecordingRetry,
} = require('../../lib/telephony-v3/Recording/recordingPolicy');
const { POLICY_ACTION, RECORDING_MODE } = require('../../lib/telephony-v3/Recording/recordingConstants');
const prisma = require('../../lib/telephony-v3/internal/prisma');

describe('V3 recordingPolicy', () => {
  beforeEach(() => {
    resetRecordingPolicyForTests();
    prisma.__setGetPrismaForTests(async () => ({
      tenantSecuritySettings: {
        findUnique: async () => ({ recordingPolicy: 'ALWAYS' }),
      },
    }));
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
  });

  it('allows manual recording when enabled', async () => {
    const decision = await evaluateRecordingPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      sessionState: 'ACTIVE',
      legState: 'BRIDGED',
      mode: RECORDING_MODE.MANUAL,
      recordingEnabled: true,
      observeOnly: false,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
  });

  it('denies when recording disabled', async () => {
    const decision = await evaluateRecordingPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      sessionState: 'ACTIVE',
      legState: 'BRIDGED',
      recordingEnabled: false,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });

  it('allows automatic recording for inbound when policy is INBOUND_ONLY', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      tenantSecuritySettings: {
        findUnique: async () => ({ recordingPolicy: 'INBOUND_ONLY' }),
      },
    }));
    const decision = await evaluateRecordingPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      sessionState: 'ACTIVE',
      legState: 'BRIDGED',
      direction: 'inbound',
      mode: RECORDING_MODE.AUTOMATIC,
      recordingEnabled: true,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
  });

  it('denies automatic outbound when policy is INBOUND_ONLY', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      tenantSecuritySettings: {
        findUnique: async () => ({ recordingPolicy: 'INBOUND_ONLY' }),
      },
    }));
    const decision = await evaluateRecordingPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      sessionState: 'ACTIVE',
      legState: 'BRIDGED',
      direction: 'outbound',
      mode: RECORDING_MODE.AUTOMATIC,
      recordingEnabled: true,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });

  it('denies after max recording retries', async () => {
    recordRecordingRetry('sess-1');
    recordRecordingRetry('sess-1');
    const decision = await evaluateRecordingPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      sessionState: 'ACTIVE',
      legState: 'BRIDGED',
      recordingEnabled: true,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });

  it('observe mode keeps effective allow on deny', async () => {
    const decision = await evaluateRecordingPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      sessionState: 'ACTIVE',
      legState: 'BRIDGED',
      recordingEnabled: false,
      observeOnly: true,
    });
    expect(decision.action).toBe(POLICY_ACTION.DENY);
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
  });

  it('maps tenant recording policy enum', () => {
    expect(mapTenantRecordingPolicy('ALWAYS').alwaysRecord).toBe(true);
    expect(mapTenantRecordingPolicy('ON_DEMAND').alwaysRecord).toBe(false);
  });
});
