import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'lib/inboundCallControl.js'), 'utf8');
const telnyxSource = readFileSync(join(process.cwd(), 'lib/telnyxCallControl.js'), 'utf8');

describe('telephony / inbound ring-first desk SIP (Telnyx Find Me pattern)', () => {
  afterEach(async () => {
    const { __resetMemoryClaimStateForTests } = await import('../../lib/callControlSession.js');
    __resetMemoryClaimStateForTests();
  });

  it('DESK_FIRST defers PSTN answer when pre-connect media is NONE', async () => {
    const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
    expect(shouldDeferPstnAnswerUntilDesk({
      targets: [{
        type: 'app',
        endpointType: 'desk',
        deviceRingStrategy: 'DESK_FIRST',
        user: { id: 'u1', telnyxSipUsername: 'gencred-desk-1' },
        endpoints: [{ endpointType: 'desk', source: 'v3_desk_device', registered: true }],
      }],
      preConnectMediaPolicy: 'NONE',
      extPolicy: { action: 'ring' },
    })).toBe(true);
  });

  it('DESK_ONLY defers PSTN answer when pre-connect media is NONE', async () => {
    const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
    expect(shouldDeferPstnAnswerUntilDesk({
      targets: [{
        type: 'app',
        endpointType: 'desk',
        deviceRingStrategy: 'DESK_ONLY',
        user: { id: 'u1', telnyxSipUsername: 'gencred-desk-1' },
        endpoints: [{ endpointType: 'desk', source: 'v3_desk_device', registered: true }],
      }],
      preConnectMediaPolicy: 'NONE',
      extPolicy: { action: 'ring' },
    })).toBe(true);
  });

  it('ring-first does not defer when pre-connect media requires PSTN answer', async () => {
    const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
    expect(shouldDeferPstnAnswerUntilDesk({
      targets: [{
        type: 'app',
        endpointType: 'desk',
        deviceRingStrategy: 'DESK_FIRST',
        user: { id: 'u1', telnyxSipUsername: 'gencred-desk-1' },
        endpoints: [{ endpointType: 'desk', source: 'v3_desk_device', registered: true }],
      }],
      preConnectMediaPolicy: 'GREETING_AND_RECORDING',
      extPolicy: { action: 'ring' },
    })).toBe(false);
  });

  it('SIMULTANEOUS does not use ring-first defer path', async () => {
    const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
    expect(shouldDeferPstnAnswerUntilDesk({
      targets: [{
        type: 'app',
        endpointType: 'desk',
        deviceRingStrategy: 'SIMULTANEOUS',
        user: { id: 'u1', telnyxSipUsername: 'gencred-desk-1', pushDeviceToken: 'push' },
        endpoints: [{ endpointType: 'desk', source: 'extension_device', registered: true }],
      }],
      preConnectMediaPolicy: 'NONE',
      extPolicy: { action: 'ring' },
    })).toBe(false);
  });

  it('startConnectFlow uses preConnectMediaPolicy for recording preamble', () => {
    expect(source).toMatch(/policyPlaysRecordingNotice\(mediaPolicy\)/);
    expect(source).not.toMatch(/deskFirstSkipAnnouncements/);
  });

  it('handleCallInitiated uses preConnectMediaPolicy instead of ring strategy for greetings', () => {
    expect(source).toMatch(/resolvePreConnectMediaPolicy\(/);
    expect(source).toMatch(/preConnectMediaPolicy === PRE_CONNECT_MEDIA_POLICY\.GREETING/);
    expect(source).not.toMatch(/playGreetingBeforeConnect !== false && !skipsPreConnectAnnouncements/);
  });

  it('defers PSTN answer for DESK_FIRST and DESK_ONLY with NONE pre-connect media', async () => {
    const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
    expect(shouldDeferPstnAnswerUntilDesk({
      targets: [{
        type: 'sip',
        endpointType: 'desk',
        deviceRingStrategy: 'DESK_ONLY',
        sipUsername: 'gencred-desk-1',
        endpoints: [{ endpointType: 'desk', source: 'legacy_sip_target', registered: true }],
      }],
      greeting: {
        playGreetingBeforeConnect: false,
        playCallRecordingNotice: false,
        callRecordingEnabled: true,
      },
      extPolicy: { action: 'ring' },
      preConnectMediaPolicy: 'NONE',
    })).toBe(true);
    expect(shouldDeferPstnAnswerUntilDesk({
      targets: [{
        type: 'app',
        endpointType: 'desk',
        deviceRingStrategy: 'DESK_FIRST',
        user: { id: 'u1', telnyxSipUsername: 'gencred-desk-1', pushDeviceToken: 'push' },
        endpoints: [
          { endpointType: 'desk', source: 'v3_desk_device', registered: true },
          { endpointType: 'mobile', source: 'push_token', registered: false },
        ],
      }],
      extPolicy: { action: 'ring' },
      preConnectMediaPolicy: 'NONE',
    })).toBe(true);
  });

  it('does not defer when ring strategy selects Option A (active mobile)', async () => {
    const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
    expect(shouldDeferPstnAnswerUntilDesk({
      targets: [{
        type: 'app',
        endpointType: 'mobile',
        deviceRingStrategy: 'SIMULTANEOUS',
        user: { id: 'u1', telnyxSipUsername: 'cred' },
        endpoints: [],
      }],
      ringsMobileApp: true,
      extPolicy: { action: 'ring' },
    })).toBe(false);
  });

  it('does not defer when IVR would run', async () => {
    const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
    expect(shouldDeferPstnAnswerUntilDesk({
      targets: [{ type: 'app', endpointType: 'desk', user: { id: 'u1' } }],
      ivrWouldRun: true,
      extPolicy: { action: 'ring' },
    })).toBe(false);
  });

  describe('Issue 1 fix — pilot-tenant desk-only ring-first fallback', () => {
    const PILOT_TENANT_ID = 'pilot-tenant-id';
    const OTHER_TENANT_ID = 'other-tenant-id';
    const simultaneousDeskTarget = {
      type: 'app',
      endpointType: 'desk',
      deviceRingStrategy: 'SIMULTANEOUS',
      user: { id: 'u1', telnyxSipUsername: 'gencred-desk-1' },
      endpoints: [{ endpointType: 'desk', source: 'v3_desk_device', registered: true }],
    };

    afterEach(() => {
      delete process.env.DESK_RING_FIRST_PILOT_TENANT_IDS;
    });

    it('still does NOT defer SIMULTANEOUS desk targets for a tenant not in the allowlist', async () => {
      process.env.DESK_RING_FIRST_PILOT_TENANT_IDS = PILOT_TENANT_ID;
      const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
      expect(shouldDeferPstnAnswerUntilDesk({
        targets: [simultaneousDeskTarget],
        preConnectMediaPolicy: 'NONE',
        extPolicy: { action: 'ring' },
        tenantId: OTHER_TENANT_ID,
      })).toBe(false);
    });

    it('does NOT defer for the pilot tenant when no allowlist is configured (opt-in only)', async () => {
      const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
      expect(shouldDeferPstnAnswerUntilDesk({
        targets: [simultaneousDeskTarget],
        preConnectMediaPolicy: 'NONE',
        extPolicy: { action: 'ring' },
        tenantId: PILOT_TENANT_ID,
      })).toBe(false);
    });

    it('defers SIMULTANEOUS desk-only targets for an allowlisted pilot tenant', async () => {
      process.env.DESK_RING_FIRST_PILOT_TENANT_IDS = PILOT_TENANT_ID;
      const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
      expect(shouldDeferPstnAnswerUntilDesk({
        targets: [simultaneousDeskTarget],
        preConnectMediaPolicy: 'NONE',
        extPolicy: { action: 'ring' },
        tenantId: PILOT_TENANT_ID,
      })).toBe(true);
    });

    it('does not defer for the allowlisted pilot tenant when any target is not desk-capable', async () => {
      process.env.DESK_RING_FIRST_PILOT_TENANT_IDS = PILOT_TENANT_ID;
      const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
      expect(shouldDeferPstnAnswerUntilDesk({
        targets: [
          simultaneousDeskTarget,
          { type: 'app', endpointType: 'mobile', user: { id: 'u2' }, endpoints: [] },
        ],
        preConnectMediaPolicy: 'NONE',
        extPolicy: { action: 'ring' },
        tenantId: PILOT_TENANT_ID,
      })).toBe(false);
    });
  });

  it('shouldDeferPstnAnswerUntilDesk uses usesRingFirstPath not target.type', () => {
    expect(source).toMatch(/if \(!usesRingFirstPath\(targets\)\) \{/);
    expect(source).toMatch(/endpointType: target\?\.endpointType/);
  });

  it('shouldDeferPstnAnswerUntilDesk only widens the gate for the pilot-tenant allowlist', () => {
    // Issue 1 fix: non-DESK_ONLY/DESK_FIRST tenants must keep relying solely on
    // usesRingFirstPath — the desk-only fallback is opt-in via tenant allowlist
    // (lib/telephony/deskRingFirstPilot.js), not a global default change.
    expect(source).toMatch(/isDeskOnlyRingFirstPilotTenant\(tenantId\)/);
    expect(source).toMatch(/allTargetsDeskOnly/);
  });

  it('resolveDialBridgeOnAnswer is false when PSTN answer is deferred', async () => {
    const { resolveDialBridgeOnAnswer } = await import('../../lib/inboundCallControl.js');
    expect(resolveDialBridgeOnAnswer({ deferPstnAnswerUntilAgent: true })).toBe(false);
    expect(resolveDialBridgeOnAnswer({ deferPstnAnswerUntilAgent: false })).toBe(true);
  });

  it('handleCallInitiated defers answer in ring-first branch only', () => {
    expect(source).toMatch(
      /if \(deferPstnAnswer\) \{[\s\S]*ring-first: deferring PSTN answer[\s\S]*\} else \{[\s\S]*await answerCall\(callControlId/,
    );
  });

  it('bridges from answered agent leg to parked PSTN without prior answer (Find Me)', () => {
    const fnMatch = source.match(
      /async function bridgeParkedInboundToAgentLeg[\s\S]*?(?=\nasync function |\nfunction |\nmodule\.exports)/,
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch[0];
    expect(fnBody).toMatch(
      /await bridgeCalls\(legCallControlId, \{ otherCallControlId: inboundCallControlId \}\)/,
    );
    expect(fnBody).not.toMatch(/await answerCall/);
    expect(source).toMatch(
      /session\.deferPstnAnswerUntilAgent && !session\.pstnAnswered[\s\S]*bridgeParkedInboundToAgentLeg/,
    );
  });

  it('answers parked PSTN before voicemail when ring times out (Find Me reject path)', () => {
    expect(source).toMatch(
      /async function ensurePstnAnsweredForMedia[\s\S]*await answerCall\([\s\S]*await ensureInboundCallLogged/,
    );
    expect(source).toMatch(
      /if \(voicemailAllowed\) \{[\s\S]*await ensurePstnAnsweredForMedia\(session, prisma\);[\s\S]*await startVoicemailCapture\(session\)/,
    );
  });
});

describe('telephony / pre-connect announcement state machine', () => {
  it('handleSpeakEnded consumes pendingConnect and calls startRinging after recording notice', () => {
    expect(source).toMatch(
      /if \(session\.stage === 'preamble' \|\| session\.pendingConnect\) \{[\s\S]*session\.pendingConnect = false;[\s\S]*await startRinging\(session, prisma\);/,
    );
    expect(source).not.toMatch(
      /if \(session\.stage === 'greeting' \|\| session\.stage === 'preamble'\)/,
    );
  });

  it('greeting speak.ended enters startConnectFlow with recording skip based on policy', () => {
    expect(source).toMatch(
      /if \(session\.stage === 'greeting'\) \{[\s\S]*await startConnectFlow\(session, prisma, \{ skipAnnouncements \}\);/,
    );
  });

  it('startConnectFlow does not replay recording notice after it was spoken', () => {
    expect(source).toMatch(/if \(session\.recordingNoticePlayed\) \{[\s\S]*await startRinging\(session, prisma\);/);
    expect(source).toMatch(/session\.recordingNoticePlayed = true;/);
  });
});

describe('telephony / inbound mobile app lifecycle (Option A)', () => {
  it('dialDestination uses bridge_on_answer when PSTN is not deferred', () => {
    expect(source).toContain('bridgeOnAnswer: resolveDialBridgeOnAnswer(session)');
    expect(telnyxSource).toContain('bridgeOnAnswer = true');
    expect(telnyxSource).toContain('...(bridgeOnAnswer ? { bridge_on_answer: true } : {})');
  });

  it('onOutboundLegAnswered waits for call.bridged after call.answered', () => {
    expect(source).toContain("function isAgentAnswerEvent(eventType)");
    expect(source).toMatch(/function isAgentAnswerEvent\(eventType\) \{[\s\S]*return eventType === 'call\.answered';/);
    expect(source).toMatch(
      /isAgentAnswerEvent\(eventType\)[\s\S]*awaitingBridge: true/,
    );
  });

  it('handleCallBridged invokes onOutboundLegAnswered with call.bridged', () => {
    expect(source).toMatch(
      /async function handleCallBridged[\s\S]*eventType: 'call\.bridged'/,
    );
    expect(source).toMatch(
      /async function markSessionBridged[\s\S]*session\.stage = 'bridged'[\s\S]*session\.winnerLeg = legCallControlId/,
    );
  });
});

describe('telephony / inbound agent answer leg detection', () => {
  afterEach(async () => {
    const { __resetMemoryClaimStateForTests } = await import('../../lib/callControlSession.js');
    __resetMemoryClaimStateForTests();
  });

  it('isInboundAgentAnswerLeg matches outboundLegs entry', async () => {
    const { isInboundAgentAnswerLeg } = await import('../../lib/inboundCallControl.js');
    const session = {
      callControlId: 'inbound-1',
      callSessionId: 'sess-a',
      outboundLegs: [{ callControlId: 'dial-leg-1', targetIndex: 0, status: 'ringing' }],
    };
    expect(await isInboundAgentAnswerLeg(session, 'inbound-1', 'dial-leg-1', {})).toBe(true);
    expect(await isInboundAgentAnswerLeg(session, 'inbound-1', 'inbound-1', {})).toBe(false);
  });

  it('isInboundAgentAnswerLeg matches Redis-indexed credential leg', async () => {
    const { indexOutboundLeg } = await import('../../lib/callControlSession.js');
    const { isInboundAgentAnswerLeg } = await import('../../lib/inboundCallControl.js');

    await indexOutboundLeg('inbound-2', 'credential-leg-1');
    const session = { callControlId: 'inbound-2', callSessionId: 'sess-b', outboundLegs: [] };

    expect(await isInboundAgentAnswerLeg(session, 'inbound-2', 'credential-leg-1', {})).toBe(true);
  });

  it('handleCallAnswered recognizes credential incoming leg and enters connecting', async () => {
    const { saveSession, getSession } = await import('../../lib/callControlSession.js');
    const {
      handleInboundAgentCredentialRingInitiated,
      handleCallAnswered,
    } = await import('../../lib/inboundCallControl.js');

    const callSessionId = 'telnyx-sess-001';
    const credUser = 'gencredlifecycleanswer01abc';
    await saveSession('inbound-cc-lifecycle', {
      callControlId: 'inbound-cc-lifecycle',
      callSessionId,
      stage: 'ringing',
      tenantId: 'tenant-1',
      tenant: { id: 'tenant-1', name: 'Test Co' },
      ringIndex: 0,
      ringTargets: [{ type: 'sip', sipUsername: credUser }],
      greeting: { callRecordingEnabled: false },
      deferPstnAnswerUntilAgent: false,
      pstnAnswered: true,
    });

    const indexed = await handleInboundAgentCredentialRingInitiated({
      call_control_id: 'credential-leg-lifecycle',
      call_session_id: callSessionId,
      direction: 'incoming',
      link_to: 'inbound-cc-lifecycle',
      to: credUser,
      from: '+19724301252',
    });
    expect(indexed).toBe(true);

    const prisma = {};
    const handled = await handleCallAnswered(prisma, {
      call_control_id: 'credential-leg-lifecycle',
      call_session_id: callSessionId,
      direction: 'incoming',
    });
    expect(handled).toBe(true);

    const session = await getSession('inbound-cc-lifecycle');
    expect(session.stage).toBe('connecting');
    expect(session.outboundLegs?.some((leg) => leg.callControlId === 'credential-leg-lifecycle')).toBe(true);
  });

  it('handleDialAnswered is best-effort fallback normalized to call.answered', () => {
    expect(source).toMatch(
      /async function handleDialAnswered[\s\S]*call\.dial\.answered \(fallback\)[\s\S]*eventType: 'call\.answered'/,
    );
  });
});

describe('telephony / inbound agent leg indexing into outboundLegs', () => {
  afterEach(async () => {
    const { __resetMemoryClaimStateForTests } = await import('../../lib/callControlSession.js');
    __resetMemoryClaimStateForTests();
  });

  it('handleInboundAgentDialLegInitiated adds leg to session.outboundLegs', async () => {
    const { saveSession, getSession } = await import('../../lib/callControlSession.js');
    const { handleInboundAgentDialLegInitiated } = await import('../../lib/inboundCallControl.js');

    await saveSession('inbound-cc-dial', {
      callControlId: 'inbound-cc-dial',
      stage: 'ringing',
      tenantId: 'tenant-1',
      ringIndex: 0,
      ringTargets: [{ type: 'sip', sipUsername: 'desk' }],
    });

    const handled = await handleInboundAgentDialLegInitiated({
      call_control_id: 'outbound-dial-leg',
      direction: 'outgoing',
      link_to: 'inbound-cc-dial',
      to: 'sip:desk@sip.telnyx.com',
    });

    expect(handled).toBe(true);
    const session = await getSession('inbound-cc-dial');
    expect(session.outboundLegs?.some((leg) => leg.callControlId === 'outbound-dial-leg')).toBe(true);
  });
});
