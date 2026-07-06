import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Bug #2 regression: desk-to-desk extension calls used to answer the caller's
 * parked leg (send 200 OK) BEFORE dialing the target extension, which starts
 * the caller's phone timer at 180 Ringing instead of when the callee answers.
 *
 * Fix: beginInternalExtensionRing() now keeps the caller leg parked and sets
 * session.deferPstnAnswerUntilAgent = true whenever there are real ring
 * targets and the leg hasn't already been answered — reusing the exact same
 * ring-first mechanism (resolveDialBridgeOnAnswer / bridgeParkedInboundToAgentLeg)
 * already proven for inbound PSTN calls (docs/vsp/pbx/21-event-sequence.md).
 *
 * lib/internalExtensionDial.js and lib/inboundCallControl.js load their
 * collaborators via plain CJS require() at module scope, which this
 * project's vitest/CJS interop does not reliably let vi.mock() intercept
 * (see also the pre-existing lib/v3/auditService.js mock in
 * tests/v3/runtimeSyncService.test.ts, which has the same limitation).
 * The wiring is therefore verified against the real source text — the same
 * approach already used in tests/telephony/inbound-telnyx-lifecycle.test.ts
 * for the equivalent inbound PSTN ring-first mechanism — plus a fully
 * functional test of the dependency-injected ExtensionCallService.
 */

const internalExtensionDialSource = fs.readFileSync(
  path.join(process.cwd(), 'lib/internalExtensionDial.js'),
  'utf8',
);

const beginInternalExtensionRingSource = (() => {
  const start = internalExtensionDialSource.indexOf('async function beginInternalExtensionRing');
  const end = internalExtensionDialSource.indexOf('\nasync function handleInternalRingGroupCallInitiated');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return internalExtensionDialSource.slice(start, end);
})();

describe('beginInternalExtensionRing ring-first wiring (Bug #2)', () => {
  it('computes deferPstnAnswerUntilAgent from real targets + not-already-answered', () => {
    expect(beginInternalExtensionRingSource).toMatch(
      /const deferAnswerUntilTargetAnswers = !alreadyAnswered && preResolvedTargets\.length > 0;/,
    );
    expect(beginInternalExtensionRingSource).toMatch(
      /deferPstnAnswerUntilAgent: deferAnswerUntilTargetAnswers,/,
    );
  });

  it('does not answer the caller leg before saving the session when targets exist (ring-first)', () => {
    // The unconditional pre-answer call must be gone; answerCall may only
    // run inside the "no targets" branch below.
    expect(beginInternalExtensionRingSource).not.toMatch(
      /await saveSession\(callControlId, session\);\s*\n\s*if \(!alreadyAnswered\) \{\s*\n\s*await answerCall/,
    );
  });

  it('still answers immediately when there are no ring targets (nothing to defer for)', () => {
    const blockedBranch = beginInternalExtensionRingSource.match(
      /if \(!session\.preResolvedTargets\.length\) \{[\s\S]*?return session;\s*\n\s*\}/,
    );
    expect(blockedBranch).toBeTruthy();
    expect(blockedBranch[0]).toMatch(/if \(!alreadyAnswered\) \{\s*\n\s*await answerCall\(/);
    expect(blockedBranch[0]).toMatch(/await speakCall\(/);
  });

  it('reuses the shared ring-first dial path (resolveDialBridgeOnAnswer via startConnectFlow)', () => {
    expect(beginInternalExtensionRingSource).toMatch(
      /await getStartConnectFlow\(\)\(session, prisma, \{ skipAnnouncements: true \}\);/,
    );
  });
});

describe('ExtensionCallService pre-answer gating (Bug #2)', () => {
  const CREDENTIAL_CONNECTION_ID = '2982156817053779933';
  const CALL_CONTROL_APPLICATION_ID = '2985826004359972249';
  const platform = {
    source: 'database',
    telnyxCredentialConnectionId: CREDENTIAL_CONNECTION_ID,
    telnyxCallControlApplicationId: CALL_CONTROL_APPLICATION_ID,
  };
  const tenant = { id: 'tenant-a-id', name: 'Tenant A' };
  const targetExtension = {
    id: 'ext-102',
    extensionNumber: '102',
    tenantId: 'tenant-a-id',
    user: { id: 'user-102' },
  };

  function makePrisma() {
    return {
      tenant: { findUnique: vi.fn().mockResolvedValue(tenant) },
      greeting: { findUnique: vi.fn().mockResolvedValue({}) },
    };
  }

  it('does not pre-answer the caller leg for the default ring policy', async () => {
    const { handleExtensionOutbound } = await import('../../lib/telephony/ExtensionCallService.js');

    const answerParkedLeg = vi.fn().mockResolvedValue(undefined);
    const beginInternalExtensionRing = vi.fn().mockResolvedValue(undefined);
    const applyInternalCallPolicyActions = vi.fn();
    const prisma = makePrisma();

    const result = await handleExtensionOutbound(
      {
        prisma,
        payload: {
          call_control_id: 'cc-desk-1',
          from: 'sip:101@sip.telnyx.com',
          to: '102',
          call_session_id: 'sess-1',
        },
        platform,
        caller: {
          tenantId: 'tenant-a-id',
          callerExtension: { id: 'ext-101', extensionNumber: '101' },
        },
        destination: { kind: 'EXTENSION', extensionNumber: '102', tenantId: 'tenant-a-id' },
        bridge: { answerParkedLeg, speakAndHangup: vi.fn() },
      },
      {
        loadTargetExtension: vi.fn().mockResolvedValue(targetExtension),
        loadRingGroupByExtensionNumber: vi.fn().mockResolvedValue(null),
        resolveExtensionRingTargets: vi.fn().mockResolvedValue({ targets: [], ringTimeout: 25 }),
        hasAppRingTargets: () => false,
        resolveExtensionCallPolicy: vi.fn().mockResolvedValue({ action: 'ring' }),
        beginInternalExtensionRing,
        applyInternalCallPolicyActions,
        callState: { createSession: vi.fn().mockResolvedValue(undefined) },
      },
    );

    expect(result).toBe(true);
    expect(answerParkedLeg).not.toHaveBeenCalled();
    expect(applyInternalCallPolicyActions).not.toHaveBeenCalled();
    expect(beginInternalExtensionRing).toHaveBeenCalledTimes(1);
    expect(beginInternalExtensionRing).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ alreadyAnswered: false }),
    );
  });

  it('still pre-answers the caller leg for block/voicemail/forward policies', async () => {
    const { handleExtensionOutbound } = await import('../../lib/telephony/ExtensionCallService.js');

    const answerParkedLeg = vi.fn().mockResolvedValue(undefined);
    const applyInternalCallPolicyActions = vi.fn().mockResolvedValue(true);
    const beginInternalExtensionRing = vi.fn();
    const prisma = makePrisma();

    const result = await handleExtensionOutbound(
      {
        prisma,
        payload: {
          call_control_id: 'cc-desk-2',
          from: 'sip:101@sip.telnyx.com',
          to: '102',
          call_session_id: 'sess-2',
        },
        platform,
        caller: {
          tenantId: 'tenant-a-id',
          callerExtension: { id: 'ext-101', extensionNumber: '101' },
        },
        destination: { kind: 'EXTENSION', extensionNumber: '102', tenantId: 'tenant-a-id' },
        bridge: { answerParkedLeg, speakAndHangup: vi.fn() },
      },
      {
        loadTargetExtension: vi.fn().mockResolvedValue(targetExtension),
        loadRingGroupByExtensionNumber: vi.fn().mockResolvedValue(null),
        resolveExtensionRingTargets: vi.fn(),
        hasAppRingTargets: () => false,
        resolveExtensionCallPolicy: vi.fn().mockResolvedValue({ action: 'voicemail' }),
        beginInternalExtensionRing,
        applyInternalCallPolicyActions,
        callState: { createSession: vi.fn().mockResolvedValue(undefined) },
      },
    );

    expect(result).toBe(true);
    expect(answerParkedLeg).toHaveBeenCalledTimes(1);
    expect(applyInternalCallPolicyActions).toHaveBeenCalledTimes(1);
    expect(beginInternalExtensionRing).not.toHaveBeenCalled();
  });

  it('does not pass alreadyAnswered:true through to beginInternalExtensionRing for the ring path even with a forward policy that falls through unhandled', async () => {
    const { handleExtensionOutbound } = await import('../../lib/telephony/ExtensionCallService.js');

    const answerParkedLeg = vi.fn().mockResolvedValue(undefined);
    const beginInternalExtensionRing = vi.fn().mockResolvedValue(undefined);
    // Simulates the pre-existing 'screen' policy gap: applyInternalCallPolicyActions
    // does not handle it and falls through to the ring path — the call must already
    // be answered in that case, so beginInternalExtensionRing must be told so.
    const applyInternalCallPolicyActions = vi.fn().mockResolvedValue(false);
    const prisma = makePrisma();

    await handleExtensionOutbound(
      {
        prisma,
        payload: {
          call_control_id: 'cc-desk-3',
          from: 'sip:101@sip.telnyx.com',
          to: '102',
          call_session_id: 'sess-3',
        },
        platform,
        caller: {
          tenantId: 'tenant-a-id',
          callerExtension: { id: 'ext-101', extensionNumber: '101' },
        },
        destination: { kind: 'EXTENSION', extensionNumber: '102', tenantId: 'tenant-a-id' },
        bridge: { answerParkedLeg, speakAndHangup: vi.fn() },
      },
      {
        loadTargetExtension: vi.fn().mockResolvedValue(targetExtension),
        loadRingGroupByExtensionNumber: vi.fn().mockResolvedValue(null),
        resolveExtensionRingTargets: vi.fn().mockResolvedValue({ targets: [], ringTimeout: 25 }),
        hasAppRingTargets: () => false,
        resolveExtensionCallPolicy: vi.fn().mockResolvedValue({ action: 'screen' }),
        beginInternalExtensionRing,
        applyInternalCallPolicyActions,
        callState: { createSession: vi.fn().mockResolvedValue(undefined) },
      },
    );

    expect(answerParkedLeg).toHaveBeenCalledTimes(1);
    expect(beginInternalExtensionRing).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ alreadyAnswered: true }),
    );
  });
});
