import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Same technique as tests/telephony/desk-pstn-redial-guard.test.ts: these
// modules are plain CommonJS and reference each other via require() at
// runtime, so we load them with Node's native require (not Vitest's dynamic
// import transform) to guarantee this test shares the exact same module
// singletons as production code.
const nodeRequire = createRequire(import.meta.url);

/**
 * Regression coverage for the Desk -> extension self-reinforcing re-dial
 * "bug" (Symplore + VSP Internal Extension -> Extension "Call Failed").
 *
 * Root cause: dialDestination() creates a new outbound leg on the same Call
 * Control Application connection that desk-originated calls arrive on, for
 * BOTH the PSTN ring path (already guarded, see desk-pstn-redial-guard.test.ts)
 * and the extension/app ring-dial path (dialSingleTarget / dialNextTarget in
 * inboundCallControl.js) — which had no guard. Telnyx fires call.initiated
 * for that new leg, and handleParkedWebRtcOutboundInitiated() could not tell
 * it apart from a fresh desk call, so it re-entered outbound routing,
 * misresolved the destination, failed, and tore down the in-progress ring —
 * producing "Call Failed" on the calling desk phone even though the target
 * extension's ring had already started successfully.
 *
 * Fix: dialSingleTarget() and dialNextTarget() now call
 * markDeskOutboundChildLeg() immediately after dialDestination() returns,
 * exactly like PstnCallService.handlePstnOutbound() already did.
 */

const CALL_CONTROL_APPLICATION_ID = '2985826004359972249';

const platform = {
  source: 'database',
  telnyxCredentialConnectionId: '2982156817053779933',
  telnyxCallControlApplicationId: CALL_CONTROL_APPLICATION_ID,
};

const deskOutboundLegGuardPath = nodeRequire.resolve('../../lib/telephony/deskOutboundLegGuard.js');
const telnyxCallControlPath = nodeRequire.resolve('../../lib/telnyxCallControl.js');
const inboundCallControlPath = nodeRequire.resolve('../../lib/inboundCallControl.js');
const internalExtensionDialPath = nodeRequire.resolve('../../lib/internalExtensionDial.js');

function freshRequire(path: string): any {
  delete nodeRequire.cache[path];
  return nodeRequire(path);
}

/** A prisma stub that throws if anything downstream of the guard is touched. */
function makePoisonPrisma() {
  const poison = () => {
    throw new Error('Guard failed to short-circuit: routing pipeline was re-entered');
  };
  return new Proxy(
    {},
    {
      get() {
        return new Proxy({}, { get: () => poison });
      },
    },
  );
}

describe('inboundCallControl dial functions mark the child leg they create', () => {
  let guard: any;
  let telnyxCallControl: any;
  let inboundCallControl: any;
  let originalDialDestination: any;

  beforeEach(() => {
    guard = freshRequire(deskOutboundLegGuardPath);
    // telnyxCallControl.js is required by many other already-loaded modules
    // in this suite; mutate the shared singleton's export in place instead of
    // replacing the module object, so every existing reference sees the stub.
    telnyxCallControl = nodeRequire(telnyxCallControlPath);
    originalDialDestination = telnyxCallControl.dialDestination;
    // inboundCallControl.js destructures dialDestination at require-time, so
    // it must be re-required AFTER the stub is installed to pick it up.
    inboundCallControl = freshRequire(inboundCallControlPath);
  });

  afterEach(() => {
    telnyxCallControl.dialDestination = originalDialDestination;
    vi.restoreAllMocks();
  });

  it('dialSingleTarget marks the new leg as a self-dialed child leg (simultaneous ring path)', async () => {
    telnyxCallControl.dialDestination = vi.fn().mockResolvedValue({ call_control_id: 'v3:app-ring-child-leg-1' });
    inboundCallControl = freshRequire(inboundCallControlPath);

    const session = {
      callControlId: 'v3:desk-ext-leg-original',
      callControlApplicationId: CALL_CONTROL_APPLICATION_ID,
      callKind: 'internal',
      from: 'ext:100',
      to: 'ext:101',
    };
    const target = { type: 'app', user: { telnyxSipUsername: 'gencred-bala-app' } };

    const result = await inboundCallControl.dialSingleTarget(session, target, 0, 25);

    expect(result.callControlId).toBe('v3:app-ring-child-leg-1');
    expect(await guard.isDeskOutboundChildLeg('v3:app-ring-child-leg-1')).toBe(true);
    // The original desk leg itself must never be treated as a child leg.
    expect(await guard.isDeskOutboundChildLeg('v3:desk-ext-leg-original')).toBe(false);
  });

  it('dialNextTarget marks the new leg as a self-dialed child leg (default sequential ring path)', async () => {
    telnyxCallControl.dialDestination = vi.fn().mockResolvedValue({ call_control_id: 'v3:app-ring-child-leg-2' });
    inboundCallControl = freshRequire(inboundCallControlPath);

    const session = {
      callControlId: 'v3:desk-ext-leg-original-2',
      callControlApplicationId: CALL_CONTROL_APPLICATION_ID,
      callKind: 'internal',
      from: 'ext:100',
      to: 'ext:101',
      ringIndex: 0,
      ringTimeout: 25,
      ringTargets: [{ type: 'app', user: { telnyxSipUsername: 'gencred-bala-app' } }],
    };

    await inboundCallControl.dialNextTarget(session, {});

    expect(await guard.isDeskOutboundChildLeg('v3:app-ring-child-leg-2')).toBe(true);
    expect(await guard.isDeskOutboundChildLeg('v3:desk-ext-leg-original-2')).toBe(false);
  });

  it('does not mark anything when dialDestination fails to return a call_control_id', async () => {
    telnyxCallControl.dialDestination = vi.fn().mockResolvedValue(null);
    inboundCallControl = freshRequire(inboundCallControlPath);

    const session = {
      callControlId: 'v3:desk-ext-leg-original-3',
      callControlApplicationId: CALL_CONTROL_APPLICATION_ID,
      callKind: 'internal',
      from: 'ext:100',
      to: 'ext:101',
    };
    const target = { type: 'app', user: { telnyxSipUsername: 'gencred-bala-app' } };

    const result = await inboundCallControl.dialSingleTarget(session, target, 0, 25);

    expect(result.callControlId).toBeNull();
  });
});

describe('handleParkedWebRtcOutboundInitiated skips extension-ring child legs end-to-end', () => {
  let guard: any;
  let telnyxCallControl: any;
  let inboundCallControl: any;
  let internalExtensionDial: any;
  let originalDialDestination: any;

  beforeEach(() => {
    guard = freshRequire(deskOutboundLegGuardPath);
    telnyxCallControl = nodeRequire(telnyxCallControlPath);
    originalDialDestination = telnyxCallControl.dialDestination;
  });

  afterEach(() => {
    telnyxCallControl.dialDestination = originalDialDestination;
    vi.restoreAllMocks();
  });

  it('the child leg created by ringing an extension is skipped, not re-routed', async () => {
    telnyxCallControl.dialDestination = vi.fn().mockResolvedValue({ call_control_id: 'v3:extension-ring-child-e2e' });
    inboundCallControl = freshRequire(inboundCallControlPath);
    internalExtensionDial = freshRequire(internalExtensionDialPath);

    const session = {
      callControlId: 'v3:desk-ext-leg-e2e',
      callControlApplicationId: CALL_CONTROL_APPLICATION_ID,
      callKind: 'internal',
      from: 'ext:100',
      to: 'ext:101',
    };
    const target = { type: 'app', user: { telnyxSipUsername: 'gencred-bala-app' } };

    // Step 1: extension ring dials the target's app credential exactly once.
    const dialResult = await inboundCallControl.dialSingleTarget(session, target, 0, 25);
    expect(dialResult.callControlId).toBe('v3:extension-ring-child-e2e');

    // Step 2: Telnyx fires call.initiated for that newly created leg. Without
    // the fix this would re-enter outbound routing, misresolve the
    // destination, and fail — tearing down the in-progress ring.
    const childLegInitiatedPayload = {
      connection_id: CALL_CONTROL_APPLICATION_ID,
      direction: 'outgoing',
      call_control_id: 'v3:extension-ring-child-e2e',
      from: 'ext:100',
      to: 'sip:gencred-bala-app@sip.telnyx.com',
    };

    const handled = await internalExtensionDial.handleParkedWebRtcOutboundInitiated(
      makePoisonPrisma(),
      childLegInitiatedPayload,
      platform,
    );

    expect(handled).toBe(false);
    expect(await guard.isDeskOutboundChildLeg('v3:extension-ring-child-e2e')).toBe(true);
  });
});
