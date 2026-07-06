import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// These three modules are plain CommonJS and reference each other via require()
// at runtime (PstnCallService.js and internalExtensionDial.js both
// `require('./deskOutboundLegGuard')`). Loading them here via Node's native
// require (instead of Vitest's dynamic import transform) guarantees this test
// shares the exact same module singleton as production code — a real
// call.initiated webhook always flows through require(), never import().
const nodeRequire = createRequire(import.meta.url);

/**
 * Regression coverage for the Desk -> PSTN self-reinforcing re-dial loop bug.
 *
 * Root cause: dialDestination() creates a new outbound leg on the same
 * connection_id (Call Control Application) that desk-originated calls use.
 * Telnyx fires call.initiated for that new leg too, and
 * handleParkedWebRtcOutboundInitiated() had no way to distinguish it from a
 * fresh desk call, so it dialed the same PSTN destination again — and again,
 * once per generated leg — producing dozens of call-history entries for one
 * dialed call.
 *
 * Fix: lib/telephony/deskOutboundLegGuard.js records every call_control_id we
 * create via PstnCallService.handlePstnOutbound the moment the Dial API
 * responds (before that leg's own call.initiated can arrive), and
 * handleParkedWebRtcOutboundInitiated() skips outbound routing entirely for
 * any call_control_id it recognizes as a leg we created ourselves.
 */

const CREDENTIAL_CONNECTION_ID = '2982156817053779933';
const CALL_CONTROL_APPLICATION_ID = '2985826004359972249';

const platform = {
  source: 'database',
  telnyxCredentialConnectionId: CREDENTIAL_CONNECTION_ID,
  telnyxCallControlApplicationId: CALL_CONTROL_APPLICATION_ID,
};

const deskPstnPayload = {
  connection_id: CALL_CONTROL_APPLICATION_ID,
  direction: 'outgoing',
  call_control_id: 'v3:desk-pstn-leg-original',
  from: '+15551112222',
  to: '+19563961388',
  sip_username: 'gencred-desk-user-a',
};

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

const deskOutboundLegGuardPath = nodeRequire.resolve('../../lib/telephony/deskOutboundLegGuard.js');
const pstnCallServicePath = nodeRequire.resolve('../../lib/telephony/PstnCallService.js');
const internalExtensionDialPath = nodeRequire.resolve('../../lib/internalExtensionDial.js');

function freshRequire(path: string): any {
  delete nodeRequire.cache[path];
  return nodeRequire(path);
}

describe('deskOutboundLegGuard', () => {
  let guard: any;

  beforeEach(() => {
    guard = freshRequire(deskOutboundLegGuardPath);
  });

  it('a call_control_id is not a child leg until explicitly marked', async () => {
    expect(await guard.isDeskOutboundChildLeg('v3:never-marked')).toBe(false);
  });

  it('marks a call_control_id and recognizes it as a child leg afterward', async () => {
    await guard.markDeskOutboundChildLeg('v3:child-leg-1');
    expect(await guard.isDeskOutboundChildLeg('v3:child-leg-1')).toBe(true);
    expect(await guard.isDeskOutboundChildLeg('v3:some-other-leg')).toBe(false);
  });

  it('is a no-op for a null/undefined call_control_id', async () => {
    await guard.markDeskOutboundChildLeg(null);
    expect(await guard.isDeskOutboundChildLeg(null)).toBe(false);
    expect(await guard.isDeskOutboundChildLeg(undefined)).toBe(false);
  });
});

describe('PstnCallService.handlePstnOutbound marks the leg it creates', () => {
  let guard: any;
  let pstnCallService: any;

  beforeEach(() => {
    guard = freshRequire(deskOutboundLegGuardPath);
    pstnCallService = freshRequire(pstnCallServicePath);
  });

  it('dials exactly once and marks the new leg as a self-dialed child leg', async () => {
    const dialAndBridge = vi.fn().mockResolvedValue({ call_control_id: 'v3:new-outbound-leg' });

    const prisma = {
      phoneNumber: { findUnique: vi.fn().mockResolvedValue({ number: '+15551112222' }) },
    };

    const result = await pstnCallService.handlePstnOutbound({
      prisma,
      payload: deskPstnPayload,
      platform,
      caller: { tenantId: 'tenant-a-id', callerExtension: { id: 'ext-a' } },
      destination: { kind: 'PSTN', pstnNumber: '+19563961388', tenantId: 'tenant-a-id' },
      bridge: { dialAndBridge },
    });

    expect(result).toBe(true);
    expect(dialAndBridge).toHaveBeenCalledTimes(1);
    expect(await guard.isDeskOutboundChildLeg('v3:new-outbound-leg')).toBe(true);
    // The original desk leg itself must never be treated as a child leg.
    expect(await guard.isDeskOutboundChildLeg('v3:desk-pstn-leg-original')).toBe(false);
  });
});

describe('handleParkedWebRtcOutboundInitiated skips self-dialed child legs', () => {
  let guard: any;
  let internalExtensionDial: any;

  beforeEach(() => {
    guard = freshRequire(deskOutboundLegGuardPath);
    internalExtensionDial = freshRequire(internalExtensionDialPath);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false and never re-enters routing for a marked child leg call.initiated', async () => {
    await guard.markDeskOutboundChildLeg('v3:child-leg-from-dial');

    const childLegInitiatedPayload = {
      connection_id: CALL_CONTROL_APPLICATION_ID,
      direction: 'outgoing',
      call_control_id: 'v3:child-leg-from-dial',
      from: '+15551112222',
      to: '+19563961388',
    };

    const result = await internalExtensionDial.handleParkedWebRtcOutboundInitiated(
      makePoisonPrisma(),
      childLegInitiatedPayload,
      platform,
    );

    expect(result).toBe(false);
  });

  it('one desk -> PSTN dial followed by the child leg webhook results in exactly one dialAndBridge call', async () => {
    const pstnCallService = freshRequire(pstnCallServicePath);
    const dialAndBridge = vi.fn().mockResolvedValue({ call_control_id: 'v3:child-leg-e2e' });

    // Step 1: genuine desk-originated call dials out exactly once.
    await pstnCallService.handlePstnOutbound({
      prisma: { phoneNumber: { findUnique: vi.fn().mockResolvedValue(null) } },
      payload: deskPstnPayload,
      platform,
      caller: { tenantId: 'tenant-a-id', callerExtension: { id: 'ext-a' } },
      destination: { kind: 'PSTN', pstnNumber: '+19563961388', tenantId: 'tenant-a-id' },
      bridge: { dialAndBridge },
    });
    expect(dialAndBridge).toHaveBeenCalledTimes(1);

    // Step 2: Telnyx fires call.initiated for the newly created child leg.
    // Without the fix, this would recurse back into outbound routing and dial again.
    const childLegInitiatedPayload = {
      connection_id: CALL_CONTROL_APPLICATION_ID,
      direction: 'outgoing',
      call_control_id: 'v3:child-leg-e2e',
      from: deskPstnPayload.from,
      to: deskPstnPayload.to,
    };

    const handled = await internalExtensionDial.handleParkedWebRtcOutboundInitiated(
      makePoisonPrisma(),
      childLegInitiatedPayload,
      platform,
    );

    expect(handled).toBe(false);
    // Still exactly one dial — the child leg's own call.initiated did not trigger a second dial.
    expect(dialAndBridge).toHaveBeenCalledTimes(1);
  });

  it('does not skip a genuine, never-dialed call_control_id (guard is scoped, not a broad block)', async () => {
    // A fresh desk-originated call.initiated must never be pre-recognized as a child leg.
    expect(await guard.isDeskOutboundChildLeg('v3:brand-new-desk-call')).toBe(false);
  });
});
