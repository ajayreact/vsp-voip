import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const { evaluateQueuePolicy, resetQueuePolicyForTests } = require('../../lib/telephony-v3/Queue/queuePolicy');
const { POLICY_ACTION, QUEUE_ACTION } = require('../../lib/telephony-v3/Queue/queueConstants');
const prisma = require('../../lib/telephony-v3/internal/prisma');

describe('V3 queuePolicy', () => {
  beforeEach(() => {
    resetQueuePolicyForTests();
    prisma.__setGetPrismaForTests(async () => ({
      tenant: {
        findUnique: async () => ({
          id: 'tenant-1',
          timezone: 'America/New_York',
          greeting: { businessHoursEnabled: false },
        }),
      },
    }));
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
  });

  it('allows join when queue enabled', async () => {
    const decision = await evaluateQueuePolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: QUEUE_ACTION.JOIN,
      queueEnabled: true,
      observeOnly: false,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
  });

  it('denies when queue disabled', async () => {
    const decision = await evaluateQueuePolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: QUEUE_ACTION.JOIN,
      queueEnabled: false,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });

  it('denies assign when no agents available', async () => {
    const decision = await evaluateQueuePolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: QUEUE_ACTION.ASSIGN,
      queueEnabled: true,
      agents: [{ extensionId: 'e1', dnd: true, available: false }],
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });

  it('allows overflow after max retries', async () => {
    const decision = await evaluateQueuePolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: QUEUE_ACTION.RETRY,
      queueEnabled: true,
      queue: { retryCount: 3 },
      maxRetries: 3,
      overflowDestination: '+15551234567',
      agents: [{ extensionId: 'e1', available: true }],
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
    expect(decision.overflow).toBe(true);
  });
});
