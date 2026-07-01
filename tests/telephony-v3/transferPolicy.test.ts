import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const {
  evaluateTransferPolicy,
  resetTransferPolicyForTests,
  isTransferTimedOut,
  recordTransferAttempt,
} = require('../../lib/telephony-v3/HoldTransfer/transferPolicy');
const { POLICY_ACTION, TRANSFER_TYPE } = require('../../lib/telephony-v3/HoldTransfer/holdTransferConstants');
const prisma = require('../../lib/telephony-v3/internal/prisma');

describe('V3 transferPolicy', () => {
  beforeEach(() => {
    resetTransferPolicyForTests();
    prisma.__setGetPrismaForTests(async () => ({
      tenant: { findUnique: async () => ({ id: 'tenant-1' }) },
    }));
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
  });

  it('allows blind transfer when enabled', async () => {
    const decision = await evaluateTransferPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      sessionState: 'ACTIVE',
      transferType: TRANSFER_TYPE.BLIND,
      transferEnabled: true,
      observeOnly: false,
      target: '+15551234567',
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
  });

  it('denies when transfer disabled', async () => {
    const decision = await evaluateTransferPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      sessionState: 'ACTIVE',
      transferType: TRANSFER_TYPE.BLIND,
      transferEnabled: false,
      target: '+15551234567',
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });

  it('denies after max transfer attempts', async () => {
    recordTransferAttempt('sess-1');
    recordTransferAttempt('sess-1');
    recordTransferAttempt('sess-1');
    const decision = await evaluateTransferPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      sessionState: 'ACTIVE',
      transferType: TRANSFER_TYPE.BLIND,
      transferEnabled: true,
      maxTransferAttempts: 3,
      target: '+15551234567',
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });

  it('detects transfer timeout', () => {
    recordTransferAttempt('sess-timeout');
    expect(isTransferTimedOut('sess-timeout', 0)).toBe(true);
  });
});
