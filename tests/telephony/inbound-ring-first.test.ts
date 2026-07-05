import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'lib/inboundCallControl.js'), 'utf8');
const telnyxSource = readFileSync(join(process.cwd(), 'lib/telnyxCallControl.js'), 'utf8');

describe('telephony / inbound ring-first PSTN answer strategy', () => {
  afterEach(async () => {
    const { __resetMemoryClaimStateForTests } = await import('../../lib/callControlSession.js');
    __resetMemoryClaimStateForTests();
  });

  it('defers when routing is sip-only desk targets without media preambles', async () => {
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

  it('dialDestination supports optional bridgeOnAnswer flag', () => {
    expect(telnyxSource).toContain('bridgeOnAnswer = true');
    expect(telnyxSource).toContain('...(bridgeOnAnswer ? { bridge_on_answer: true } : {})');
  });
});

describe('telephony / inbound ring-first scenario 1 — desk answers', () => {
  it('completeDeferredPstnAnswerAndBridge answers PSTN then bridges immediately', () => {
    expect(source).toMatch(
      /async function completeDeferredPstnAnswerAndBridge[\s\S]*await answerCall\([\s\S]*await logInboundCallStart\(prisma, session\);[\s\S]*await bridgeCalls\(inboundCallControlId/,
    );
  });

  it('dials desk without bridge_on_answer while PSTN remains unanswered', () => {
    expect(source).toContain('bridgeOnAnswer: resolveDialBridgeOnAnswer(session)');
    expect(source).toMatch(
      /function resolveDialBridgeOnAnswer\(session\) \{[\s\S]*return !session\?\.deferPstnAnswerUntilAgent;/,
    );
    expect(source).toMatch(
      /if \(deferPstnAnswer\) \{[\s\S]*ring-first: deferring PSTN answer[\s\S]*\} else \{[\s\S]*pstnAnswered = true/,
    );
  });

  it('onOutboundLegAnswered invokes deferred answer+bridge on call.dial.answered', () => {
    expect(source).toMatch(
      /isDialAnswerEvent\(eventType\)[\s\S]*session\.deferPstnAnswerUntilAgent[\s\S]*!session\.pstnAnswered[\s\S]*completeDeferredPstnAnswerAndBridge/,
    );
  });
});

describe('telephony / inbound ring-first scenario 2 — no answer', () => {
  it('hangs up unanswered deferred PSTN when voicemail is disabled', () => {
    expect(source).toMatch(
      /async function hangupDeferredPstnIfUnanswered[\s\S]*await hangupCall\(session\.callControlId\)/,
    );
    expect(source).toMatch(
      /if \(await hangupDeferredPstnIfUnanswered\(session\)\) \{[\s\S]*return;[\s\S]*\}[\s\S]*await speakCall/,
    );
  });

  it('answers PSTN before voicemail capture when ring times out with VM enabled', () => {
    expect(source).toMatch(
      /async function ensurePstnAnsweredForMedia[\s\S]*await answerCall\([\s\S]*await logInboundCallStart\(prisma, session\)/,
    );
    expect(source).toMatch(
      /if \(voicemailAllowed\) \{[\s\S]*await ensurePstnAnsweredForMedia\(session, prisma\);[\s\S]*await startVoicemailCapture\(session\)/,
    );
  });

  it('handleDialEnded advances sequential targets before final no-answer fallback', () => {
    expect(source).toMatch(
      /session\.ringIndex \+= 1;[\s\S]*await dialNextTarget\(session, prisma\);[\s\S]*await routeToVoicemailOrHangup\(session, \{ fallbackTrigger: 'no_answer' \}\)/,
    );
  });
});

describe('telephony / inbound ring-first scenario 3 — hunt group simultaneous', () => {
  it('defers for sip-only simultaneous hunt-group targets', async () => {
    const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
    expect(shouldDeferPstnAnswerUntilDesk({
      targets: [
        { type: 'sip', sipUsername: 'gencred-desk-a' },
        { type: 'sip', sipUsername: 'gencred-desk-b' },
      ],
      greeting: {
        playGreetingBeforeConnect: false,
        playCallRecordingNotice: false,
      },
      extPolicy: { action: 'ring' },
    })).toBe(true);
  });

  it('first desk answer triggers deferred PSTN answer+bridge', () => {
    expect(source).toMatch(
      /completeDeferredPstnAnswerAndBridge[\s\S]*await bridgeCalls\(inboundCallControlId/,
    );
  });

  it('cancels remaining hunt-group legs when bridge winner is confirmed', () => {
    expect(source).toContain('await cancelRemainingOutboundLegs(session, legCallControlId)');
    expect(source).toMatch(
      /if \(isSimultaneousStrategy\(session\)\) \{[\s\S]*await cancelRemainingOutboundLegs\(session, legCallControlId\)/,
    );
  });
});

describe('telephony / inbound ring-first scenario 4 — IVR unchanged', () => {
  it('does not defer PSTN answer when IVR is enabled', async () => {
    const { shouldDeferPstnAnswerUntilDesk } = await import('../../lib/inboundCallControl.js');
    expect(shouldDeferPstnAnswerUntilDesk({
      targets: [{ type: 'sip', sipUsername: 'gencred-desk-1' }],
      ivrWouldRun: true,
      extPolicy: { action: 'ring' },
    })).toBe(false);
  });

  it('answers PSTN before gatherUsingSpeak for IVR', () => {
    expect(source).toMatch(
      /if \(greeting\?\.ivrEnabled && ivrOptionsResolved\.length && !ringsMobileApp\) \{[\s\S]*await gatherUsingSpeak/,
    );
    const ivrBlockStart = source.indexOf('if (greeting?.ivrEnabled && ivrOptionsResolved.length && !ringsMobileApp)');
    const answerInElse = source.indexOf('} else {', source.indexOf('if (deferPstnAnswer)'));
    expect(ivrBlockStart).toBeGreaterThan(answerInElse);
  });
});
