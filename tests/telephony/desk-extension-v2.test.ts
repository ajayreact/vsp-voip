import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CREDENTIAL_CONNECTION_ID = '2982156817053779933';
const CALL_CONTROL_APPLICATION_ID = '2985826004359972249';

const platform = {
  source: 'database',
  telnyxCredentialConnectionId: CREDENTIAL_CONNECTION_ID,
  telnyxCallControlApplicationId: CALL_CONTROL_APPLICATION_ID,
};

const deskExtensionPayload = {
  connection_id: CALL_CONTROL_APPLICATION_ID,
  direction: 'outgoing',
  call_control_id: 'v3:desk-ext-leg',
  from: 'sip:101@sip.telnyx.com',
  to: '102',
  sip_username: 'gencred-desk-user-a',
  call_session_id: 'session-ext-1',
};

const mobileExtensionPayload = {
  connection_id: CREDENTIAL_CONNECTION_ID,
  direction: 'outbound',
  call_control_id: 'v3:mobile-ext-leg',
  from: 'sip:mobile-user@sip.telnyx.com',
  to: '102',
};

function makeTargetExtension() {
  return {
    id: 'ext-target',
    extensionNumber: '102',
    tenantId: 'tenant-a-id',
    forwarding: null,
    security: null,
    user: { id: 'user-b' },
    primaryPhoneNumber: null,
  };
}

function makePrisma() {
  const tenantId = 'tenant-a-id';
  const tenant = { id: tenantId, name: 'Tenant A' };
  const targetExtension = makeTargetExtension();

  return {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(tenant),
    },
    greeting: {
      findUnique: vi.fn().mockResolvedValue({}),
    },
    extension: {
      findFirst: vi.fn(async ({ where }) => {
        if (where?.extensionNumber === '102') return targetExtension;
        return null;
      }),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({
        tenantId,
        id: 'user-a',
        telnyxSipUsername: 'gencred-desk-user-a',
        extensions: [{ id: 'ext-a', extensionNumber: '101', tenantId }],
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    phoneNumber: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };
}

describe('telephony / desk Extension V2 router', () => {
  const originalEnv = process.env.DESK_CALL_ROUTER_V2;

  beforeEach(() => {
    vi.resetModules();
    process.env.DESK_CALL_ROUTER_V2_LEGACY = 'true';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DESK_CALL_ROUTER_V2;
    } else {
      process.env.DESK_CALL_ROUTER_V2 = originalEnv;
    }
    delete process.env.DESK_CALL_ROUTER_V2_LEGACY;
    vi.restoreAllMocks();
  });

  it('routeDeskExtensionOutboundV2 returns null when legacy rollback flag is set', async () => {
    const { routeDeskExtensionOutboundV2 } = await import('../../lib/telephony/DeskCallRouter.js');
    const resolveCaller = vi.fn();
    const resolveDestination = vi.fn();
    const handleExtensionOutbound = vi.fn();

    const result = await routeDeskExtensionOutboundV2(
      makePrisma(),
      deskExtensionPayload,
      platform,
      {},
      { resolveCaller, resolveDestination, pstnService: {}, extensionService: { handleExtensionOutbound } },
    );

    expect(result).toBeNull();
    expect(resolveCaller).not.toHaveBeenCalled();
    expect(handleExtensionOutbound).not.toHaveBeenCalled();
  });

  it('routeDeskExtensionOutboundV2 returns null for mobile credential extension (legacy path)', async () => {
    delete process.env.DESK_CALL_ROUTER_V2_LEGACY;
    const { routeDeskExtensionOutboundV2 } = await import('../../lib/telephony/DeskCallRouter.js');
    const handleExtensionOutbound = vi.fn();

    const result = await routeDeskExtensionOutboundV2(
      makePrisma(),
      mobileExtensionPayload,
      platform,
      {},
      {
        resolveCaller: vi.fn(),
        resolveDestination: vi.fn(),
        pstnService: {},
        extensionService: { handleExtensionOutbound },
      },
    );

    expect(result).toBeNull();
    expect(handleExtensionOutbound).not.toHaveBeenCalled();
  });

  it('routeDeskExtensionOutboundV2 orchestrates desk → extension when V2 active', async () => {
    delete process.env.DESK_CALL_ROUTER_V2_LEGACY;
    const { routeDeskExtensionOutboundV2 } = await import('../../lib/telephony/DeskCallRouter.js');

    const caller = {
      tenantId: 'tenant-a-id',
      user: { id: 'user-a' },
      callerExtension: { id: 'ext-a', extensionNumber: '101' },
    };
    const resolveCaller = vi.fn();
    const resolveDestination = vi.fn().mockResolvedValue({
      kind: 'EXTENSION',
      extensionNumber: '102',
      tenantId: 'tenant-a-id',
    });
    const handleExtensionOutbound = vi.fn().mockResolvedValue(true);

    const prisma = makePrisma();
    const result = await routeDeskExtensionOutboundV2(
      prisma,
      deskExtensionPayload,
      platform,
      { caller, callerProvided: true },
      {
        resolveCaller,
        resolveDestination,
        pstnService: {},
        extensionService: { handleExtensionOutbound },
      },
    );

    expect(result).toBe(true);
    expect(resolveCaller).not.toHaveBeenCalled();
    expect(resolveDestination).toHaveBeenCalledTimes(1);
    expect(resolveDestination).toHaveBeenCalledWith(prisma, deskExtensionPayload, caller);
    expect(handleExtensionOutbound).toHaveBeenCalledTimes(1);
    expect(handleExtensionOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: deskExtensionPayload,
        platform,
        caller,
        destination: {
          kind: 'EXTENSION',
          extensionNumber: '102',
          tenantId: 'tenant-a-id',
        },
      }),
    );
  });

  it('routeDeskExtensionOutboundV2 returns null for PSTN destination', async () => {
    delete process.env.DESK_CALL_ROUTER_V2_LEGACY;
    const { routeDeskExtensionOutboundV2 } = await import('../../lib/telephony/DeskCallRouter.js');
    const handleExtensionOutbound = vi.fn();

    const result = await routeDeskExtensionOutboundV2(
      makePrisma(),
      { ...deskExtensionPayload, to: '+13135551212' },
      platform,
      {},
      {
        resolveCaller: vi.fn(),
        resolveDestination: vi.fn(),
        pstnService: {},
        extensionService: { handleExtensionOutbound },
      },
    );

    expect(result).toBeNull();
    expect(handleExtensionOutbound).not.toHaveBeenCalled();
  });

  it('ExtensionCallService invokes policy, ring targets, and startConnectFlow once', async () => {
    const { handleExtensionOutbound } = await import('../../lib/telephony/ExtensionCallService.js');
    const prisma = makePrisma();
    const caller = {
      tenantId: 'tenant-a-id',
      user: { id: 'user-a' },
      callerExtension: { id: 'ext-a', extensionNumber: '101' },
    };
    const targetExtension = makeTargetExtension();
    const startConnectFlow = vi.fn().mockResolvedValue(undefined);

    const resolveExtensionCallPolicy = vi.fn().mockResolvedValue({ action: 'allow' });
    const beginInternalExtensionRing = vi.fn().mockImplementation(async (_prisma, params) => {
      await startConnectFlow(
        {
          callControlId: params.callControlId,
          preResolvedTargets: [{ type: 'webrtc', dialTo: 'sip:102@x' }],
        },
        _prisma,
        { skipAnnouncements: true },
      );
      return { callControlId: params.callControlId };
    });
    const applyInternalCallPolicyActions = vi.fn().mockResolvedValue(false);
    const createSession = vi.fn().mockResolvedValue(undefined);
    const answerParkedLeg = vi.fn().mockResolvedValue(undefined);

    const result = await handleExtensionOutbound(
      {
        prisma,
        payload: deskExtensionPayload,
        platform,
        caller,
        destination: {
          kind: 'EXTENSION',
          extensionNumber: '102',
          tenantId: 'tenant-a-id',
        },
        bridge: { answerParkedLeg, speakAndHangup: vi.fn() },
      },
      {
        loadTargetExtension: vi.fn().mockResolvedValue(targetExtension),
        loadRingGroupByExtensionNumber: vi.fn().mockResolvedValue(null),
        resolveExtensionRingTargets: vi.fn().mockResolvedValue({ targets: [], ringTimeout: 25 }),
        hasAppRingTargets: () => false,
        resolveExtensionCallPolicy,
        beginInternalExtensionRing,
        applyInternalCallPolicyActions,
        callState: { createSession },
      },
    );

    expect(result).toBe(true);
    expect(resolveExtensionCallPolicy).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(applyInternalCallPolicyActions).toHaveBeenCalledTimes(1);
    expect(beginInternalExtensionRing).toHaveBeenCalledTimes(1);
    expect(startConnectFlow).toHaveBeenCalledTimes(1);
    expect(answerParkedLeg).toHaveBeenCalledTimes(1);
  });

  it('ExtensionCallService returns null for ring groups (legacy fallback)', async () => {
    const { handleExtensionOutbound } = await import('../../lib/telephony/ExtensionCallService.js');
    const result = await handleExtensionOutbound(
      {
        prisma: makePrisma(),
        payload: deskExtensionPayload,
        platform,
        caller: {
          tenantId: 'tenant-a-id',
          callerExtension: { id: 'ext-a', extensionNumber: '101' },
        },
        destination: {
          kind: 'EXTENSION',
          extensionNumber: '102',
          tenantId: 'tenant-a-id',
        },
        bridge: { answerParkedLeg: vi.fn(), speakAndHangup: vi.fn() },
      },
      {
        loadTargetExtension: vi.fn().mockResolvedValue(null),
        loadRingGroupByExtensionNumber: vi.fn().mockResolvedValue({ id: 'rg-1' }),
        resolveExtensionRingTargets: vi.fn(),
        hasAppRingTargets: () => false,
        resolveExtensionCallPolicy: vi.fn(),
        beginInternalExtensionRing: vi.fn(),
        applyInternalCallPolicyActions: vi.fn(),
        callState: { createSession: vi.fn() },
      },
    );

    expect(result).toBeNull();
  });

  it('resolveOutboundDestination returns EXTENSION shape without dialing', async () => {
    const { resolveOutboundDestination } = await import('../../lib/telephony/DestinationResolver.js');
    const caller = { tenantId: 'tenant-a-id' };

    await expect(resolveOutboundDestination(null, deskExtensionPayload, caller)).resolves.toEqual({
      kind: 'EXTENSION',
      extensionNumber: '102',
      tenantId: 'tenant-a-id',
      resolvedVia: 'extension_digits',
    });
  });
});

describe('telephony / handleParkedWebRtcOutboundInitiated extension V2 wiring', () => {
  it('delegates desk CC App extension outbound to routeDeskOutbound', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/internalExtensionDial.js'),
      'utf8',
    );

    const start = source.indexOf('async function handleParkedWebRtcOutboundInitiated');
    const end = source.indexOf('async function initiateInternalCallFromApi');
    const handlerSource = source.slice(start, end);

    expect(handlerSource).toContain('routeDeskOutbound');
    expect(handlerSource).toContain('handleInternalExtensionCallInitiated');
  });
});
