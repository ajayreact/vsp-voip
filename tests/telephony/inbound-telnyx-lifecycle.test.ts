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

  it('defers PSTN answer for sip-only desk targets without media preambles', async () => {
    const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
    expect(shouldDeferPstnAnswerUntilDesk({
      targets: [{ type: 'sip', sipUsername: 'gencred-desk-1' }],
      greeting: {
        playGreetingBeforeConnect: false,
        playCallRecordingNotice: false,
        callRecordingEnabled: true,
      },
      extPolicy: { action: 'ring' },
    })).toBe(true);
  });

  it('does not defer for mobile app ring targets', async () => {
    const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
    expect(shouldDeferPstnAnswerUntilDesk({
      targets: [{ type: 'app', user: { id: 'u1' } }],
      ringsMobileApp: true,
      extPolicy: { action: 'ring' },
    })).toBe(false);
  });

  it('does not defer when IVR would run', async () => {
    const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
    expect(shouldDeferPstnAnswerUntilDesk({
      targets: [{ type: 'sip', sipUsername: 'gencred-desk-1' }],
      ivrWouldRun: true,
      extPolicy: { action: 'ring' },
    })).toBe(false);
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
