import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const {
  evaluateVoicemailPolicy,
  resetVoicemailPolicyForTests,
  isVoicemailTimedOut,
  markVoicemailStarted,
} = require('../../lib/telephony-v3/Voicemail/voicemailPolicy');
const { POLICY_ACTION, VOICEMAIL_REASON } = require('../../lib/telephony-v3/Voicemail/voicemailConstants');
const prisma = require('../../lib/telephony-v3/internal/prisma');

describe('V3 voicemailPolicy', () => {
  beforeEach(() => {
    resetVoicemailPolicyForTests();
    prisma.__setGetPrismaForTests(async () => ({
      tenant: { findUnique: async () => ({ id: 'tenant-1' }) },
      extensionVoicemailSettings: { findUnique: async () => null },
      greeting: { findUnique: async () => ({ greetingAudioUrl: 'https://example.com/greeting.mp3', voicemailMaxLength: 120 }) },
    }));
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
  });

  it('allows no-answer voicemail when enabled', async () => {
    const decision = await evaluateVoicemailPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      reason: VOICEMAIL_REASON.NO_ANSWER,
      voicemailEnabled: true,
      observeOnly: false,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
    expect(decision.greetingUrl).toBe('https://example.com/greeting.mp3');
  });

  it('denies when voicemail disabled', async () => {
    const decision = await evaluateVoicemailPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      reason: VOICEMAIL_REASON.BUSY,
      voicemailEnabled: false,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });

  it('denies DND when extension voicemail disabled', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      tenant: { findUnique: async () => ({ id: 'tenant-1' }) },
      extensionVoicemailSettings: { findUnique: async () => ({ enabled: false, greetingUrl: null }) },
      greeting: { findUnique: async () => null },
    }));
    const decision = await evaluateVoicemailPolicy({
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      reason: VOICEMAIL_REASON.DND,
      voicemailEnabled: true,
      extensionId: 'ext-1',
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });

  it('detects voicemail timeout', () => {
    markVoicemailStarted('sess-timeout');
    expect(isVoicemailTimedOut('sess-timeout', 0)).toBe(true);
  });
});
