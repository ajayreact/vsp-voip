import { describe, expect, it, beforeEach } from 'vitest';
import { createRequire } from 'module';

// Real execution of the actual production CJS functions (lib/inboundCallControl.js,
// lib/telnyxCallControl.js) with only the Telnyx HTTP client layer swapped out via
// Node's own require cache -- this exercises the genuine call-control code path,
// not a re-description of it.
const nodeRequire = createRequire(__filename);

const telnyxCallControlPath = nodeRequire.resolve('../../lib/telnyxCallControl.js');
const inboundCallControlPath = nodeRequire.resolve('../../lib/inboundCallControl.js');
const callControlSessionPath = nodeRequire.resolve('../../lib/callControlSession.js');

function installFakeTelnyxCallControl() {
  const calls: { bridgeCalls: any[][] } = { bridgeCalls: [] };
  nodeRequire.cache[telnyxCallControlPath] = {
    id: telnyxCallControlPath,
    filename: telnyxCallControlPath,
    loaded: true,
    exports: {
      answerCall: async () => ({}),
      speakCall: async () => ({}),
      gatherUsingSpeak: async () => ({}),
      dialDestination: async () => ({ call_control_id: 'desk-leg-1' }),
      hangupCall: async () => ({}),
      bridgeCalls: async (...args: any[]) => {
        calls.bridgeCalls.push(args);
        return {};
      },
      startCallRecording: async () => ({}),
      startVoicemailRecording: async () => ({}),
    },
  } as any;
  // getSession returns null so onOutboundLegAnswered keeps using the exact session
  // object passed in by the test, instead of picking up state persisted to the real
  // Redis-backed store by a previous test case (each test uses the same callControlId).
  nodeRequire.cache[callControlSessionPath] = {
    id: callControlSessionPath,
    filename: callControlSessionPath,
    loaded: true,
    exports: {
      getSession: async () => null,
      saveSession: async () => {},
      deleteSession: async () => {},
      pruneStaleSessions: async () => {},
      findSession: async () => null,
      claimConnectedLeg: async () => ({ claimed: true }),
      claimAnswerSideEffects: async () => ({ claimed: true }),
      getClaimedWinner: async () => null,
      indexOutboundLeg: async () => {},
      indexPendingAgentRing: async () => {},
      resolvePendingAgentRing: async () => null,
      clearPendingAgentRing: async () => {},
      indexActiveAgentCall: async () => {},
      clearActiveAgentCall: async () => {},
    },
  } as any;
  // Force inboundCallControl.js to re-require and re-destructure against the fakes above.
  delete nodeRequire.cache[inboundCallControlPath];
  const inboundCallControl = nodeRequire(inboundCallControlPath);
  return { inboundCallControl, calls };
}

function makeSession(overrides: Record<string, any> = {}) {
  return {
    callControlId: 'inbound-1',
    tenantId: 'pilot-tenant',
    ringStrategy: 'simultaneous',
    stage: 'ringing',
    outboundLegs: [{ callControlId: 'desk-leg-1', targetIndex: 0, status: 'ringing' }],
    deferPstnAnswerUntilAgent: false,
    pstnAnswered: true,
    ...overrides,
  };
}

describe('Issue 1 fix — ring-first manual bridge (real code, fake Telnyx HTTP layer)', () => {
  beforeEach(() => {
    delete nodeRequire.cache[telnyxCallControlPath];
    delete nodeRequire.cache[inboundCallControlPath];
    delete nodeRequire.cache[callControlSessionPath];
  });

  it('bridgeParkedInboundToAgentLeg calls bridgeCalls with the parked inbound leg and marks it answered', async () => {
    const { inboundCallControl, calls } = installFakeTelnyxCallControl();
    const session = makeSession({ deferPstnAnswerUntilAgent: true, pstnAnswered: false });

    await inboundCallControl.bridgeParkedInboundToAgentLeg(session, 'inbound-1', 'desk-leg-1');

    expect(calls.bridgeCalls).toHaveLength(1);
    expect(calls.bridgeCalls[0]).toEqual(['desk-leg-1', { otherCallControlId: 'inbound-1' }]);
    expect(session.pstnAnswered).toBe(true);
  });

  it('deferred + unanswered: onOutboundLegAnswered(call.answered) issues a manual bridge', async () => {
    const { inboundCallControl, calls } = installFakeTelnyxCallControl();
    const session = makeSession({ deferPstnAnswerUntilAgent: true, pstnAnswered: false });

    await inboundCallControl.onOutboundLegAnswered(null, session, 'inbound-1', 'desk-leg-1', {
      eventType: 'call.answered',
    });

    expect(calls.bridgeCalls).toHaveLength(1);
    expect(calls.bridgeCalls[0]).toEqual(['desk-leg-1', { otherCallControlId: 'inbound-1' }]);
    expect(session.pstnAnswered).toBe(true);
  });

  it('non-deferred (every existing/non-pilot call today): onOutboundLegAnswered does NOT manually bridge', async () => {
    const { inboundCallControl, calls } = installFakeTelnyxCallControl();
    const session = makeSession({ deferPstnAnswerUntilAgent: false, pstnAnswered: true });

    await inboundCallControl.onOutboundLegAnswered(null, session, 'inbound-1', 'desk-leg-1', {
      eventType: 'call.answered',
    });

    expect(calls.bridgeCalls).toHaveLength(0);
  });

  it('deferred but already bridged (duplicate answer event): does not bridge twice', async () => {
    const { inboundCallControl, calls } = installFakeTelnyxCallControl();
    const session = makeSession({ deferPstnAnswerUntilAgent: true, pstnAnswered: true });

    await inboundCallControl.onOutboundLegAnswered(null, session, 'inbound-1', 'desk-leg-1', {
      eventType: 'call.answered',
    });

    expect(calls.bridgeCalls).toHaveLength(0);
  });

  it('call.bridged (post-manual-bridge confirmation) does not re-trigger the manual bridge branch', async () => {
    const { inboundCallControl, calls } = installFakeTelnyxCallControl();
    const session = makeSession({
      deferPstnAnswerUntilAgent: true,
      pstnAnswered: true, // already bridged by the prior call.answered event
      outboundLegs: [{ callControlId: 'desk-leg-1', targetIndex: 0, status: 'answered' }],
    });

    await inboundCallControl.onOutboundLegAnswered(null, session, 'inbound-1', 'desk-leg-1', {
      eventType: 'call.bridged',
    });

    // call.bridged is the confirmation event -- it must fall through to the normal
    // winner-claim path, not the manual-bridge branch.
    expect(calls.bridgeCalls).toHaveLength(0);
  });
});

describe('Issue 1 fix — dialDestination bridge_on_answer is conditional and defaults unchanged (real code, fake axios)', () => {
  const axiosPath = nodeRequire.resolve('axios');

  beforeEach(() => {
    delete nodeRequire.cache[telnyxCallControlPath];
    delete nodeRequire.cache[axiosPath];
    process.env.TELNYX_API_KEY = 'test-key';
  });

  function installFakeAxios() {
    const requests: any[] = [];
    const fakeAxios = async (config: any) => {
      requests.push(config);
      return { data: { data: { call_control_id: 'desk-leg-1' } } };
    };
    nodeRequire.cache[axiosPath] = {
      id: axiosPath,
      filename: axiosPath,
      loaded: true,
      exports: fakeAxios,
    } as any;
    const telnyxCallControl = nodeRequire(telnyxCallControlPath);
    return { telnyxCallControl, requests };
  }

  it('omits bridge_on_answer when bridgeOnAnswer:false is requested (ring-first dial)', async () => {
    const { telnyxCallControl, requests } = installFakeAxios();

    await telnyxCallControl.dialDestination('inbound-1', {
      to: 'sip:desk@sip.telnyx.com',
      from: '+15551234567',
      connectionId: 'app-id',
      bridgeOnAnswer: false,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].data).not.toHaveProperty('bridge_on_answer');
    expect(requests[0].data.link_to).toBe('inbound-1');
  });

  it('defaults to bridge_on_answer:true when bridgeOnAnswer is omitted (every existing call site, unchanged)', async () => {
    const { telnyxCallControl, requests } = installFakeAxios();

    await telnyxCallControl.dialDestination('inbound-1', {
      to: 'sip:agent@sip.telnyx.com',
      from: '+15551234567',
      connectionId: 'app-id',
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].data.bridge_on_answer).toBe(true);
  });

  it('bridgeOnAnswer:true explicitly behaves identically to the default', async () => {
    const { telnyxCallControl, requests } = installFakeAxios();

    await telnyxCallControl.dialDestination('inbound-1', {
      to: 'sip:agent@sip.telnyx.com',
      from: '+15551234567',
      connectionId: 'app-id',
      bridgeOnAnswer: true,
    });

    expect(requests[0].data.bridge_on_answer).toBe(true);
  });
});
