import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nodeRequire = createRequire(import.meta.url);

const telnyxCallControlPath = nodeRequire.resolve('../../lib/telnyxCallControl.js');
const callControlSessionStorePath = nodeRequire.resolve('../../lib/callControlSessionStore.js');
const inboundCallControlPath = nodeRequire.resolve('../../lib/inboundCallControl.js');

function ringFirstSession(overrides: Record<string, unknown> = {}) {
  const inboundId = 'v3:inbound-pstn';
  const deskLegId = 'v3:desk-ring-leg';
  return {
    inboundId,
    deskLegId,
    session: {
      callControlId: inboundId,
      callSessionId: 'sess-ring-first-test',
      stage: 'ringing',
      ringStrategy: 'sequential',
      ringIndex: 0,
      deferPstnAnswerUntilAgent: true,
      pstnAnswered: false,
      ringTargets: [
        { type: 'sip', extensionId: 'ext-100', sipUsername: 'gencred-desk' },
        { type: 'app', extensionId: 'ext-100', user: { telnyxSipUsername: 'gencred-app' } },
      ],
      outboundLegCallControlId: deskLegId,
      outboundLegs: [{ callControlId: deskLegId, status: 'ringing', targetIndex: 0 }],
      ...overrides,
    },
  };
}

describe('Ring-first PSTN caller abandon lifecycle', () => {
  let telnyxCallControl: any;
  let sessionStore: any;
  let inboundCallControl: any;
  let hangupSpy: ReturnType<typeof vi.fn>;
  let bridgeSpy: ReturnType<typeof vi.fn>;
  let deleteSessionSpy: ReturnType<typeof vi.fn>;
  let originalHangup: any;
  let originalBridge: any;

  beforeEach(() => {
    telnyxCallControl = nodeRequire(telnyxCallControlPath);
    delete nodeRequire.cache[callControlSessionStorePath];
    delete nodeRequire.cache[inboundCallControlPath];
    sessionStore = nodeRequire(callControlSessionStorePath);
    originalHangup = telnyxCallControl.hangupCall;
    originalBridge = telnyxCallControl.bridgeCalls;
    hangupSpy = vi.fn().mockResolvedValue({});
    bridgeSpy = vi.fn().mockResolvedValue({});
    telnyxCallControl.hangupCall = hangupSpy;
    telnyxCallControl.bridgeCalls = bridgeSpy;
    vi.spyOn(sessionStore, 'getClaimedWinner').mockResolvedValue(null);
    vi.spyOn(sessionStore, 'saveSession').mockResolvedValue(undefined);
    deleteSessionSpy = vi.spyOn(sessionStore, 'deleteSession').mockResolvedValue(undefined);
    inboundCallControl = nodeRequire(inboundCallControlPath);
  });

  afterEach(() => {
    telnyxCallControl.hangupCall = originalHangup;
    telnyxCallControl.bridgeCalls = originalBridge;
    vi.restoreAllMocks();
  });

  function bindSession(session: Record<string, unknown>, inboundId: string) {
    vi.spyOn(sessionStore, 'findSession').mockResolvedValue({ session, inboundCallControlId: inboundId });
    vi.spyOn(sessionStore, 'getSession').mockImplementation(async (id: string) => {
      if (id === inboundId) return { ...session };
      return null;
    });
    delete nodeRequire.cache[inboundCallControlPath];
    telnyxCallControl.hangupCall = hangupSpy;
    inboundCallControl = nodeRequire(inboundCallControlPath);
  }

  const prisma = {
    callLog: { create: vi.fn().mockResolvedValue({}), upsert: vi.fn().mockResolvedValue({}) },
    callHistory: { create: vi.fn().mockResolvedValue({}) },
  };

  it('inbound PSTN hangup sets callerAbandoned, cancels desk leg, and deletes session', async () => {
    const { inboundId, deskLegId, session } = ringFirstSession();
    bindSession(session, inboundId);

    await inboundCallControl.handleHangup(prisma, {
      call_control_id: inboundId,
      hangup_cause: 'originator_cancel',
      hangup_source: 'caller',
    });

    expect(hangupSpy).toHaveBeenCalledWith(deskLegId);
    expect(deleteSessionSpy).toHaveBeenCalledWith(inboundId);
    expect(bridgeSpy).not.toHaveBeenCalled();
  });

  it('outbound desk hangup during ring-first does not dial next target or voicemail', async () => {
    const { inboundId, deskLegId, session } = ringFirstSession();
    bindSession(session, inboundId);
    const dialNextSpy = vi.spyOn(inboundCallControl, 'dialNextTarget');
    const vmSpy = vi.spyOn(inboundCallControl, 'routeToVoicemailOrHangup');

    await inboundCallControl.handleHangup(prisma, {
      call_control_id: deskLegId,
      hangup_cause: 'normal_clearing',
      hangup_source: 'system',
    });

    expect(dialNextSpy).not.toHaveBeenCalled();
    expect(vmSpy).not.toHaveBeenCalled();
  });

  it('call.dial.ended with non-no-answer status does not advance ring-first ring list', async () => {
    const { inboundId, deskLegId, session } = ringFirstSession();
    bindSession(session, inboundId);
    const dialNextSpy = vi.spyOn(inboundCallControl, 'dialNextTarget');
    const vmSpy = vi.spyOn(inboundCallControl, 'routeToVoicemailOrHangup');

    await inboundCallControl.handleDialEnded(prisma, {
      call_control_id: deskLegId,
      dial_call_status: 'hangup',
    });

    expect(dialNextSpy).not.toHaveBeenCalled();
    expect(vmSpy).not.toHaveBeenCalled();
  });

  it('late desk answer after callerAbandoned is rejected and desk leg is hung up', async () => {
    const { inboundId, deskLegId, session } = ringFirstSession({
      callerAbandoned: true,
      callerAbandonedAt: Date.now(),
    });
    bindSession(session, inboundId);
    vi.spyOn(sessionStore, 'getSession').mockImplementation(async (id: string) => {
      if (id === inboundId) return { ...session, callerAbandoned: true };
      return null;
    });
    delete nodeRequire.cache[inboundCallControlPath];
    inboundCallControl = nodeRequire(inboundCallControlPath);

    await inboundCallControl.onOutboundLegAnswered(
      prisma,
      session,
      inboundId,
      deskLegId,
      { eventType: 'call.answered' },
    );

    expect(hangupSpy).toHaveBeenCalledWith(deskLegId);
    expect(bridgeSpy).not.toHaveBeenCalled();
  });

  it('outbound hangup after callerAbandoned does not start another ring attempt', async () => {
    const { inboundId, deskLegId, session } = ringFirstSession({
      callerAbandoned: true,
      callerAbandonedAt: Date.now(),
      outboundLegs: [{ callControlId: 'v3:desk-ring-leg', status: 'cancelled', targetIndex: 0 }],
    });
    bindSession(session, inboundId);
    const dialNextSpy = vi.spyOn(inboundCallControl, 'dialNextTarget');
    const vmSpy = vi.spyOn(inboundCallControl, 'routeToVoicemailOrHangup');

    await inboundCallControl.handleHangup(prisma, {
      call_control_id: deskLegId,
      hangup_cause: 'normal_clearing',
    });

    expect(dialNextSpy).not.toHaveBeenCalled();
    expect(vmSpy).not.toHaveBeenCalled();
  });

  it('unknown leg hangup during ring does not delete session while dial is in flight', async () => {
    const { inboundId, session } = ringFirstSession({
      dialInFlight: { ringIndex: 0, startedAt: Date.now() },
      outboundLegs: [{ callControlId: null, status: 'ringing', targetIndex: 0 }],
    });
    bindSession(session, inboundId);

    await inboundCallControl.handleHangup(prisma, {
      call_control_id: 'v3:unregistered-leg',
      hangup_cause: 'normal_clearing',
    });

    expect(deleteSessionSpy).not.toHaveBeenCalled();
  });
});
