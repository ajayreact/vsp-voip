import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CREDENTIAL_CONNECTION_ID = '2982156817053779933';
const CALL_CONTROL_APPLICATION_ID = '2985826004359972249';

const platform = {
  source: 'database',
  telnyxCredentialConnectionId: CREDENTIAL_CONNECTION_ID,
  telnyxCallControlApplicationId: CALL_CONTROL_APPLICATION_ID,
};

const deskMobilePayload = {
  connection_id: CALL_CONTROL_APPLICATION_ID,
  direction: 'outgoing',
  call_control_id: 'v3:desk-mobile-leg',
  from: 'sip:101@sip.telnyx.com',
  to: '102',
  sip_username: 'gencred-desk-user-a',
  call_session_id: 'session-mobile-1',
};

const mobileCredentialPayload = {
  connection_id: CREDENTIAL_CONNECTION_ID,
  direction: 'outbound',
  call_control_id: 'v3:mobile-cred-leg',
  from: 'sip:mobile-user@sip.telnyx.com',
  to: '102',
};

function makeTargetExtension() {
  return {
    id: 'ext-target',
    extensionNumber: '102',
    tenantId: 'tenant-a-id',
    userId: 'user-b',
    user: { id: 'user-b', telnyxSipUsername: 'mobile-user-b' },
    forwarding: null,
    security: null,
    primaryPhoneNumber: null,
  };
}

function makeAppRingResolution() {
  return {
    targets: [{
      type: 'app',
      user: { id: 'user-b', telnyxSipUsername: 'mobile-user-b', name: 'Mobile User' },
      extensionId: 'ext-target',
      label: 'Mobile User',
    }],
    ringTimeout: 25,
    strategy: 'sequential',
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
      findUnique: vi.fn().mockResolvedValue(makeTargetExtension().user),
      findMany: vi.fn().mockResolvedValue([]),
    },
    phoneNumber: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };
}

describe('telephony / desk Mobile V2 router', () => {
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

  it('routeDeskMobileOutboundV2 returns null when legacy rollback flag is set', async () => {
    const { routeDeskMobileOutboundV2 } = await import('../../lib/telephony/DeskCallRouter.js');
    const resolveCaller = vi.fn();
    const resolveDestination = vi.fn();
    const handleMobileOutbound = vi.fn();

    const result = await routeDeskMobileOutboundV2(
      makePrisma(),
      deskMobilePayload,
      platform,
      {},
      {
        resolveCaller,
        resolveDestination,
        pstnService: {},
        extensionService: {},
        mobileService: { handleMobileOutbound },
      },
    );

    expect(result).toBeNull();
    expect(resolveCaller).not.toHaveBeenCalled();
    expect(handleMobileOutbound).not.toHaveBeenCalled();
  });

  it('routeDeskMobileOutboundV2 returns null for mobile credential extension (legacy path)', async () => {
    delete process.env.DESK_CALL_ROUTER_V2_LEGACY;
    const { routeDeskMobileOutboundV2 } = await import('../../lib/telephony/DeskCallRouter.js');
    const handleMobileOutbound = vi.fn();

    const result = await routeDeskMobileOutboundV2(
      makePrisma(),
      mobileCredentialPayload,
      platform,
      {},
      {
        resolveCaller: vi.fn(),
        resolveDestination: vi.fn(),
        pstnService: {},
        extensionService: {},
        mobileService: { handleMobileOutbound },
      },
    );

    expect(result).toBeNull();
    expect(handleMobileOutbound).not.toHaveBeenCalled();
  });

  it('routeDeskMobileOutboundV2 orchestrates desk → mobile when V2 active', async () => {
    delete process.env.DESK_CALL_ROUTER_V2_LEGACY;
    const { routeDeskMobileOutboundV2 } = await import('../../lib/telephony/DeskCallRouter.js');

    const caller = {
      tenantId: 'tenant-a-id',
      user: { id: 'user-a' },
      callerExtension: { id: 'ext-a', extensionNumber: '101' },
    };
    const resolveCaller = vi.fn();
    const resolveDestination = vi.fn().mockReturnValue({
      kind: 'EXTENSION',
      extensionNumber: '102',
      tenantId: 'tenant-a-id',
    });
    const handleMobileOutbound = vi.fn().mockResolvedValue(true);

    const result = await routeDeskMobileOutboundV2(
      makePrisma(),
      deskMobilePayload,
      platform,
      { caller, callerProvided: true },
      {
        resolveCaller,
        resolveDestination,
        pstnService: {},
        extensionService: {},
        mobileService: { handleMobileOutbound },
      },
    );

    expect(result).toBe(true);
    expect(resolveCaller).not.toHaveBeenCalled();
    expect(resolveDestination).toHaveBeenCalledTimes(1);
    expect(resolveDestination).toHaveBeenCalledWith(deskMobilePayload, caller);
    expect(handleMobileOutbound).toHaveBeenCalledTimes(1);
    expect(handleMobileOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: deskMobilePayload,
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

  it('MobileCallService delegates to extension ring flow when app targets exist', async () => {
    const { handleMobileOutbound } = await import('../../lib/telephony/MobileCallService.js');
    const handleExtensionOutbound = vi.fn().mockResolvedValue(true);
    const resolveExtensionRingTargets = vi.fn().mockResolvedValue(makeAppRingResolution());

    const result = await handleMobileOutbound(
      {
        prisma: makePrisma(),
        payload: deskMobilePayload,
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
      },
      {
        loadTargetExtension: vi.fn().mockResolvedValue(makeTargetExtension()),
        loadRingGroupByExtensionNumber: vi.fn().mockResolvedValue(null),
        resolveExtensionRingTargets,
        hasAppRingTargets: (targets) => targets.some((t) => t.type === 'app'),
        handleExtensionOutbound,
        extensionDeps: {},
      },
    );

    expect(result).toBe(true);
    expect(resolveExtensionRingTargets).toHaveBeenCalledTimes(1);
    expect(handleExtensionOutbound).toHaveBeenCalledTimes(1);
    expect(handleExtensionOutbound).toHaveBeenCalledWith(
      expect.objectContaining({ skipMobileGate: true }),
      {},
    );
  });

  it('MobileCallService returns null when ring targets are not app/mobile', async () => {
    const { handleMobileOutbound } = await import('../../lib/telephony/MobileCallService.js');
    const handleExtensionOutbound = vi.fn();

    const result = await handleMobileOutbound(
      {
        prisma: makePrisma(),
        payload: deskMobilePayload,
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
      },
      {
        loadTargetExtension: vi.fn().mockResolvedValue(makeTargetExtension()),
        loadRingGroupByExtensionNumber: vi.fn().mockResolvedValue(null),
        resolveExtensionRingTargets: vi.fn().mockResolvedValue({ targets: [], ringTimeout: 25 }),
        hasAppRingTargets: (targets) => targets.some((t) => t.type === 'app'),
        handleExtensionOutbound,
        extensionDeps: {},
      },
    );

    expect(result).toBeNull();
    expect(handleExtensionOutbound).not.toHaveBeenCalled();
  });

  it('ExtensionCallService returns null for app ring targets (mobile V2 path)', async () => {
    const { handleExtensionOutbound } = await import('../../lib/telephony/ExtensionCallService.js');
    const beginInternalExtensionRing = vi.fn();

    const result = await handleExtensionOutbound(
      {
        prisma: makePrisma(),
        payload: deskMobilePayload,
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
        loadTargetExtension: vi.fn().mockResolvedValue(makeTargetExtension()),
        loadRingGroupByExtensionNumber: vi.fn().mockResolvedValue(null),
        resolveExtensionRingTargets: vi.fn().mockResolvedValue(makeAppRingResolution()),
        hasAppRingTargets: (targets) => targets.some((t) => t.type === 'app'),
        resolveExtensionCallPolicy: vi.fn(),
        beginInternalExtensionRing,
        applyInternalCallPolicyActions: vi.fn(),
        callState: { createSession: vi.fn() },
      },
    );

    expect(result).toBeNull();
    expect(beginInternalExtensionRing).not.toHaveBeenCalled();
  });
});

describe('telephony / handleParkedWebRtcOutboundInitiated mobile V2 wiring', () => {
  it('delegates desk CC App outbound to routeDeskOutbound before legacy handlers', async () => {
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
    expect(handlerSource.indexOf('routeDeskOutbound')).toBeLessThan(
      handlerSource.indexOf('handleInternalExtensionCallInitiated'),
    );
  });
});
