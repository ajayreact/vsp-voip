import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nodeRequire = createRequire(import.meta.url);

const telnyxCallControlPath = nodeRequire.resolve('../../lib/telnyxCallControl.js');
const callControlSessionStorePath = nodeRequire.resolve('../../lib/callControlSessionStore.js');
const inboundCallControlPath = nodeRequire.resolve('../../lib/inboundCallControl.js');

function freshRequire(path: string): any {
  delete nodeRequire.cache[path];
  return nodeRequire(path);
}

describe('PSTN caller hangup cancels ringing desk leg', () => {
  let telnyxCallControl: any;
  let sessionStore: any;
  let inboundCallControl: any;
  let hangupSpy: ReturnType<typeof vi.fn>;
  let deleteSessionSpy: ReturnType<typeof vi.fn>;
  let originalHangup: any;

  beforeEach(() => {
    telnyxCallControl = nodeRequire(telnyxCallControlPath);
    sessionStore = freshRequire(callControlSessionStorePath);
    originalHangup = telnyxCallControl.hangupCall;
    hangupSpy = vi.fn().mockResolvedValue({});
    telnyxCallControl.hangupCall = hangupSpy;
    vi.spyOn(sessionStore, 'getClaimedWinner').mockResolvedValue(null);
    vi.spyOn(sessionStore, 'saveSession').mockResolvedValue(undefined);
    deleteSessionSpy = vi.spyOn(sessionStore, 'deleteSession').mockResolvedValue(undefined);
    inboundCallControl = freshRequire(inboundCallControlPath);
  });

  afterEach(() => {
    telnyxCallControl.hangupCall = originalHangup;
    vi.restoreAllMocks();
  });

  it('cancels sequential desk ring when inbound PSTN leg hangs up during ringing', async () => {
    const inboundId = 'v3:inbound-pstn-leg';
    const deskRingLegId = 'v3:desk-ring-leg';
    const session = {
      callControlId: inboundId,
      stage: 'ringing',
      ringStrategy: 'sequential',
      ringTargets: [{ type: 'app', extensionId: 'ext-101' }],
      outboundLegCallControlId: deskRingLegId,
      outboundLegs: [{ callControlId: deskRingLegId, status: 'ringing', targetIndex: 0 }],
    };

    vi.spyOn(sessionStore, 'findSession').mockResolvedValue({
      session,
      inboundCallControlId: inboundId,
    });

    inboundCallControl = freshRequire(inboundCallControlPath);

    const prisma = {
      callLog: { create: vi.fn().mockResolvedValue({}) },
      callHistory: { create: vi.fn().mockResolvedValue({}) },
    };

    await inboundCallControl.handleHangup(prisma, {
      call_control_id: inboundId,
      hangup_cause: 'originator_cancel',
    });

    expect(hangupSpy).toHaveBeenCalledWith(deskRingLegId);
    expect(deleteSessionSpy).toHaveBeenCalledWith(inboundId);
  });
});
