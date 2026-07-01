import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const {
  evaluateIvrPolicy,
  resetIvrPolicyForTests,
  evaluateHolidayOverride,
} = require('../../lib/telephony-v3/IVR/ivrPolicy');
const { POLICY_ACTION, IVR_ACTION } = require('../../lib/telephony-v3/IVR/ivrConstants');
const prisma = require('../../lib/telephony-v3/internal/prisma');

describe('V3 ivrPolicy', () => {
  beforeEach(() => {
    resetIvrPolicyForTests();
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

  it('allows start when ivr enabled', async () => {
    const decision = await evaluateIvrPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: IVR_ACTION.START,
      ivrEnabled: true,
      observeOnly: false,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
  });

  it('denies when ivr disabled', async () => {
    const decision = await evaluateIvrPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: IVR_ACTION.START,
      ivrEnabled: false,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
    expect(decision.reason).toBe('ivr_disabled');
  });

  it('denies outside business hours on start', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      tenant: {
        findUnique: async () => ({
          id: 'tenant-1',
          timezone: 'America/New_York',
          greeting: {
            businessHoursEnabled: true,
            businessHours: {
              mon: { enabled: false, open: '09:00', close: '17:00' },
              tue: { enabled: false, open: '09:00', close: '17:00' },
              wed: { enabled: false, open: '09:00', close: '17:00' },
              thu: { enabled: false, open: '09:00', close: '17:00' },
              fri: { enabled: false, open: '09:00', close: '17:00' },
              sat: { enabled: false, open: '09:00', close: '17:00' },
              sun: { enabled: false, open: '09:00', close: '17:00' },
            },
          },
        }),
      },
    }));

    const decision = await evaluateIvrPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: IVR_ACTION.START,
      ivrEnabled: true,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
    expect(decision.reason).toBe('outside_business_hours');
  });

  it('routes holiday override on start', async () => {
    const today = new Date().toISOString().slice(0, 10);
    prisma.__setGetPrismaForTests(async () => ({
      tenant: {
        findUnique: async () => ({
          id: 'tenant-1',
          timezone: 'America/New_York',
          greeting: {
            businessHoursEnabled: false,
            holidaySchedule: [{
              date: today,
              route: { destination: 'VOICEMAIL', extensionId: 'ext-vm' },
            }],
          },
        }),
      },
    }));

    const decision = await evaluateIvrPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: IVR_ACTION.START,
      ivrEnabled: true,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
    expect(decision.holiday).toBe(true);
    expect(decision.holidayRoute).toEqual({ destination: 'VOICEMAIL', extensionId: 'ext-vm' });
  });

  it('operator fallback after max retries', async () => {
    const decision = await evaluateIvrPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: IVR_ACTION.RETRY,
      ivrEnabled: true,
      ivr: { retryCount: 3, invalidCount: 3, timeoutCount: 0 },
      maxRetries: 3,
      routeOperator: true,
      operatorEnabled: true,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
    expect(decision.operatorFallback).toBe(true);
  });

  it('observe mode allows denied policy', async () => {
    const decision = await evaluateIvrPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      action: IVR_ACTION.START,
      ivrEnabled: false,
      observeOnly: true,
    });
    expect(decision.action).toBe(POLICY_ACTION.DENY);
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
    expect(decision.enforced).toBe(false);
  });

  it('detects active holiday schedule', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = evaluateHolidayOverride({
      holidaySchedule: [{ date: today, name: 'Holiday' }],
    }, 'America/New_York');
    expect(result.active).toBe(true);
  });
});
