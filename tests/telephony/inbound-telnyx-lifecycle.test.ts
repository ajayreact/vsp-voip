import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'lib/inboundCallControl.js'), 'utf8');
const telnyxSource = readFileSync(join(process.cwd(), 'lib/telnyxCallControl.js'), 'utf8');

describe('telephony / inbound Telnyx lifecycle (Option A)', () => {
  afterEach(async () => {
    const { __resetMemoryClaimStateForTests } = await import('../../lib/callControlSession.js');
    __resetMemoryClaimStateForTests();
  });

  it('handleCallInitiated always answers inbound PSTN before routing', () => {
    expect(source).not.toContain('shouldDeferPstnAnswerUntilDesk');
    expect(source).not.toContain('deferPstnAnswerUntilAgent');
    expect(source).not.toContain('ring-first: deferring PSTN answer');
    expect(source).toMatch(
      /await answerCall\(callControlId, encodeClientState\(\{ tenantId: tenant\.id, direction: 'inbound' \}\)\);[\s\S]*await logInboundCallStart\(prisma, session\)/,
    );
  });

  it('dialDestination relies on default bridge_on_answer (link_to + bridge_on_answer)', () => {
    expect(source).not.toContain('resolveDialBridgeOnAnswer');
    expect(source).not.toContain('bridgeOnAnswer:');
    expect(telnyxSource).toContain('bridgeOnAnswer = true');
    expect(telnyxSource).toContain('...(bridgeOnAnswer ? { bridge_on_answer: true } : {})');
  });

  it('onOutboundLegAnswered waits for call.bridged after call.answered', () => {
    expect(source).toContain("function isAgentAnswerEvent(eventType)");
    expect(source).toMatch(/function isAgentAnswerEvent\(eventType\) \{[\s\S]*return eventType === 'call\.answered';/);
    expect(source).not.toContain('completeDeferredPstnAnswerAndBridge');
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

  it('isInboundAgentAnswerLeg matches legs sharing call_session_id', async () => {
    const { isInboundAgentAnswerLeg, sharesInboundCallSession } = await import('../../lib/inboundCallControl.js');
    const session = { callControlId: 'inbound-3', callSessionId: 'shared-sess', outboundLegs: [] };

    expect(sharesInboundCallSession(session, { call_session_id: 'shared-sess' })).toBe(true);
    expect(await isInboundAgentAnswerLeg(session, 'inbound-3', 'orphan-leg', {
      call_session_id: 'shared-sess',
    })).toBe(true);
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

  it('handleInboundAgentCredentialRingInitiated adds leg to session.outboundLegs', async () => {
    const { saveSession, getSession, indexPendingAgentRing } = await import('../../lib/callControlSession.js');
    const { handleInboundAgentCredentialRingInitiated } = await import('../../lib/inboundCallControl.js');

    const credUser = 'gencredlifecycleuser01abc'.toLowerCase();
    await saveSession('inbound-cc-cred', {
      callControlId: 'inbound-cc-cred',
      stage: 'ringing',
      tenantId: 'tenant-1',
      ringIndex: 0,
      ringTargets: [{ type: 'sip', sipUsername: credUser }],
    });
    await indexPendingAgentRing('inbound-cc-cred', credUser, '+19724301252');

    const handled = await handleInboundAgentCredentialRingInitiated({
      call_control_id: 'credential-ring-leg',
      direction: 'incoming',
      to: credUser,
      from: '+19724301252',
    });

    expect(handled).toBe(true);
    const session = await getSession('inbound-cc-cred');
    expect(session.outboundLegs?.some((leg) => leg.callControlId === 'credential-ring-leg')).toBe(true);
  });
});
