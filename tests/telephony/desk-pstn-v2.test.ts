import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  call_control_id: 'v3:desk-pstn-leg',
  from: '+15551112222',
  to: '+13135551212',
  sip_username: 'gencred-desk-user-a',
};

const mobilePstnPayload = {
  connection_id: CREDENTIAL_CONNECTION_ID,
  direction: 'outbound',
  call_control_id: 'v3:mobile-pstn-leg',
  from: 'sip:mobile-user@sip.telnyx.com',
  to: '+13135551212',
};

function makePrisma() {
  const tenantId = 'tenant-a-id';
  return {
    extension: { findFirst: vi.fn().mockResolvedValue(null) },
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

describe('telephony / desk PSTN V2 router', () => {
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

  it('routeDeskPstnOutboundV2 returns null when legacy rollback flag is set', async () => {
    const { routeDeskPstnOutboundV2 } = await import('../../lib/telephony/DeskCallRouter.js');
    const resolveCaller = vi.fn();
    const resolveDestination = vi.fn();
    const handlePstnOutbound = vi.fn();

    const result = await routeDeskPstnOutboundV2(
      makePrisma(),
      deskPstnPayload,
      platform,
      {},
      { resolveCaller, resolveDestination, pstnService: { handlePstnOutbound } },
    );

    expect(result).toBeNull();
    expect(resolveCaller).not.toHaveBeenCalled();
    expect(resolveDestination).not.toHaveBeenCalled();
    expect(handlePstnOutbound).not.toHaveBeenCalled();
  });

  it('routeDeskPstnOutboundV2 returns null for mobile credential PSTN (legacy path)', async () => {
    delete process.env.DESK_CALL_ROUTER_V2_LEGACY;
    const { routeDeskPstnOutboundV2 } = await import('../../lib/telephony/DeskCallRouter.js');
    const resolveCaller = vi.fn();
    const resolveDestination = vi.fn();
    const handlePstnOutbound = vi.fn();

    const result = await routeDeskPstnOutboundV2(
      makePrisma(),
      mobilePstnPayload,
      platform,
      {},
      { resolveCaller, resolveDestination, pstnService: { handlePstnOutbound } },
    );

    expect(result).toBeNull();
    expect(resolveCaller).not.toHaveBeenCalled();
    expect(handlePstnOutbound).not.toHaveBeenCalled();
  });

  it('routeDeskPstnOutboundV2 orchestrates desk → PSTN when V2 active', async () => {
    delete process.env.DESK_CALL_ROUTER_V2_LEGACY;
    const { routeDeskPstnOutboundV2 } = await import('../../lib/telephony/DeskCallRouter.js');

    const caller = {
      tenantId: 'tenant-a-id',
      user: { id: 'user-a' },
      callerExtension: { id: 'ext-a', extensionNumber: '101' },
    };
    const resolveCaller = vi.fn().mockResolvedValue(caller);
    const resolveDestination = vi.fn().mockResolvedValue({
      kind: 'PSTN',
      pstnNumber: '+13135551212',
      tenantId: 'tenant-a-id',
    });
    const handlePstnOutbound = vi.fn().mockResolvedValue(true);
    const dialAndBridge = vi.fn().mockResolvedValue({ call_control_id: 'v3:outbound-leg' });

    const prisma = makePrisma();
    const result = await routeDeskPstnOutboundV2(
      prisma,
      deskPstnPayload,
      platform,
      { caller, callerProvided: true, bridge: { dialAndBridge } },
      { resolveCaller, resolveDestination, pstnService: { handlePstnOutbound } },
    );

    expect(result).toBe(true);
    expect(resolveCaller).not.toHaveBeenCalled();
    expect(resolveDestination).toHaveBeenCalledTimes(1);
    expect(resolveDestination).toHaveBeenCalledWith(prisma, deskPstnPayload, caller);
    expect(handlePstnOutbound).toHaveBeenCalledTimes(1);
    expect(handlePstnOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: deskPstnPayload,
        platform,
        caller,
        destination: {
          kind: 'PSTN',
          pstnNumber: '+13135551212',
          tenantId: 'tenant-a-id',
        },
        bridge: expect.objectContaining({ dialAndBridge }),
      }),
    );
  });

  it('PstnCallService uses CallBridgeService.dialAndBridge (telnyx dialDestination adapter)', async () => {
    const dialAndBridge = vi.fn().mockResolvedValue({ call_control_id: 'v3:outbound-leg' });
    const { handlePstnOutbound } = await import('../../lib/telephony/PstnCallService.js');

    const prisma = makePrisma();
    prisma.phoneNumber.findUnique = vi.fn().mockResolvedValue({ number: '+15551112222' });

    const result = await handlePstnOutbound({
      prisma,
      payload: deskPstnPayload,
      platform,
      caller: {
        tenantId: 'tenant-a-id',
        callerExtension: { id: 'ext-a' },
      },
      destination: {
        kind: 'PSTN',
        pstnNumber: '+13135551212',
        tenantId: 'tenant-a-id',
      },
      bridge: { dialAndBridge },
    });

    expect(result).toBe(true);
    expect(dialAndBridge).toHaveBeenCalledTimes(1);
    expect(dialAndBridge).toHaveBeenCalledWith(
      'v3:desk-pstn-leg',
      expect.objectContaining({
        to: '+13135551212',
        connectionId: CALL_CONTROL_APPLICATION_ID,
        timeoutSecs: 45,
      }),
    );
  });

  it('routeDeskPstnOutboundV2 returns null for desk extension destination', async () => {
    delete process.env.DESK_CALL_ROUTER_V2_LEGACY;
    const { routeDeskPstnOutboundV2 } = await import('../../lib/telephony/DeskCallRouter.js');
    const handlePstnOutbound = vi.fn();

    const result = await routeDeskPstnOutboundV2(
      makePrisma(),
      { ...deskPstnPayload, to: '102' },
      platform,
      {},
      {
        resolveCaller: vi.fn(),
        resolveDestination: vi.fn(),
        pstnService: { handlePstnOutbound },
      },
    );

    expect(result).toBeNull();
    expect(handlePstnOutbound).not.toHaveBeenCalled();
  });

  it('V2 end-to-end invokes destination resolver and bridge once with callerProvided', async () => {
    delete process.env.DESK_CALL_ROUTER_V2_LEGACY;
    const { routeDeskPstnOutboundV2, defaultDeps } = await import('../../lib/telephony/DeskCallRouter.js');
    const dialAndBridge = vi.fn().mockResolvedValue({ call_control_id: 'v3:outbound-leg' });
    const resolveCaller = vi.fn();
    const resolveDestination = vi.fn(defaultDeps.resolveDestination);

    const caller = {
      tenantId: 'tenant-a-id',
      user: { id: 'user-a' },
      callerExtension: { id: 'ext-a', extensionNumber: '101' },
    };

    const prisma = makePrisma();
    prisma.phoneNumber.findUnique = vi.fn().mockResolvedValue({ number: '+15551112222' });

    const result = await routeDeskPstnOutboundV2(
      prisma,
      deskPstnPayload,
      platform,
      { caller, callerProvided: true, bridge: { dialAndBridge } },
      { ...defaultDeps, resolveCaller, resolveDestination },
    );

    expect(result).toBe(true);
    expect(resolveCaller).not.toHaveBeenCalled();
    expect(resolveDestination).toHaveBeenCalledTimes(1);
    expect(dialAndBridge).toHaveBeenCalledTimes(1);
    expect(dialAndBridge).toHaveBeenCalledWith(
      'v3:desk-pstn-leg',
      expect.objectContaining({
        to: '+13135551212',
        connectionId: CALL_CONTROL_APPLICATION_ID,
      }),
    );
  });

  it('resolveOutboundDestination returns PSTN shape without dialing', async () => {
    const { resolveOutboundDestination } = await import('../../lib/telephony/DestinationResolver.js');
    const caller = { tenantId: 'tenant-a-id' };

    await expect(resolveOutboundDestination(null, deskPstnPayload, caller)).resolves.toEqual({
      kind: 'PSTN',
      pstnNumber: '+13135551212',
      tenantId: 'tenant-a-id',
    });
  });
});

describe('telephony / handleParkedWebRtcOutboundInitiated V2 wiring', () => {
  it('delegates desk CC App outbound to routeDeskOutbound', async () => {
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
    expect(handlerSource).toContain('handleParkedPstnOutboundPassthrough');
    expect(handlerSource).toContain('handleInternalExtensionCallInitiated');
  });
});
