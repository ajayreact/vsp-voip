import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nodeRequire = createRequire(import.meta.url);

const deskOutboundLegGuardPath = nodeRequire.resolve('../../lib/telephony/deskOutboundLegGuard.js');
const callControlSessionStorePath = nodeRequire.resolve('../../lib/callControlSessionStore.js');
const telnyxCallControlPath = nodeRequire.resolve('../../lib/telnyxCallControl.js');
const inboundCallControlPath = nodeRequire.resolve('../../lib/inboundCallControl.js');

function freshRequire(path: string): any {
  delete nodeRequire.cache[path];
  return nodeRequire(path);
}

describe('handleCallInitiated skips internal extension ring legs', () => {
  let sessionStore: any;
  let guard: any;
  let telnyxCallControl: any;
  let inboundCallControl: any;
  let answerSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStore = freshRequire(callControlSessionStorePath);
    guard = freshRequire(deskOutboundLegGuardPath);
    telnyxCallControl = nodeRequire(telnyxCallControlPath);
    answerSpy = vi.fn().mockResolvedValue({});
    telnyxCallControl.answerCall = answerSpy;
    vi.spyOn(guard, 'isDeskOutboundChildLeg').mockResolvedValue(false);
    vi.spyOn(sessionStore, 'findSession').mockResolvedValue({
      session: {
        callKind: 'internal',
        callSessionId: 'sess-desk-did',
        stage: 'ringing',
      },
      inboundCallControlId: 'v3:parked-desk-leg',
    });
    inboundCallControl = freshRequire(inboundCallControlPath);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not treat Telnyx incoming ring legs as new PSTN inbound calls', async () => {
    await inboundCallControl.handleCallInitiated(
      {},
      {
        call_control_id: 'v3:spurious-incoming-ring-leg',
        call_session_id: 'sess-desk-did',
        direction: 'incoming',
        from: '+10000000000',
        to: 'gencred-target@sip.telnyx.com',
      },
      {},
    );

    expect(sessionStore.findSession).toHaveBeenCalled();
    expect(answerSpy).not.toHaveBeenCalled();
  });
});
