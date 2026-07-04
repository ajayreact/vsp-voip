import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseInternalExtensionDestination,
  isPstnDestination,
  isTelnyxCredentialSipDestination,
  describeCredentialConnectionOutboundGate,
} from '../../lib/telephony/PayloadNormalizer.js';
import {
  classifyDestinationKind,
  resolveExtensionNumberFromTo,
} from '../../lib/telephony/DestinationResolver.js';
import { isDeskCallRouterV2Enabled } from '../../lib/telephony/constants.js';
import {
  parseInternalExtensionDestination as legacyParse,
  isPstnDestination as legacyPstn,
  describeCredentialConnectionOutboundGate as legacyGate,
} from '../../lib/internalExtensionDial.js';

describe('telephony / module extraction parity', () => {
  afterEach(() => {
    delete process.env.DESK_CALL_ROUTER_V2_LEGACY;
    delete process.env.DESK_CALL_ROUTER_V2;
  });

  it('PayloadNormalizer matches legacy internalExtensionDial exports', () => {
    expect(parseInternalExtensionDestination('102')).toBe(legacyParse('102'));
    expect(parseInternalExtensionDestination('sip:103@sip.telnyx.com')).toBe(
      legacyParse('sip:103@sip.telnyx.com'),
    );
    expect(isPstnDestination('+13135551212')).toBe(legacyPstn('+13135551212'));
    expect(isPstnDestination('102')).toBe(legacyPstn('102'));

    const platform = {
      telnyxCredentialConnectionId: '2982156817053779933',
      telnyxCallControlApplicationId: '2985826004359972249',
    };
    const payload = { connection_id: '2985826004359972249', direction: 'outgoing' };
    expect(describeCredentialConnectionOutboundGate(payload, platform)).toEqual(
      legacyGate(payload, platform),
    );
  });

  it('classifyDestinationKind identifies extension vs PSTN vs credential SIP', () => {
    expect(classifyDestinationKind('101')).toEqual({ kind: 'EXTENSION', extensionNumber: '101' });
    expect(classifyDestinationKind('+13135551212')).toEqual({
      kind: 'PSTN',
      pstnNumber: '+13135551212',
    });
    expect(classifyDestinationKind('')).toEqual({ kind: 'UNKNOWN' });
    expect(
      classifyDestinationKind('sip:gencred3a9GoMgohOzCHT92aQZ7cvcRPP0FZhrb2hP7EyOyCL@sip.telnyx.com'),
    ).toEqual({
      kind: 'CREDENTIAL_SIP',
      sipUsername: 'gencred3a9GoMgohOzCHT92aQZ7cvcRPP0FZhrb2hP7EyOyCL',
    });
    expect(isTelnyxCredentialSipDestination('sip:gencredDesk@sip.telnyx.com')).toBe(true);
    expect(parseInternalExtensionDestination('sip:gencredDesk@sip.telnyx.com')).toBeNull();
  });

  it('resolveExtensionNumberFromTo maps gencred SIP URI to extension via DB', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          tenantId: 'tenant-a',
          extensions: [{ extensionNumber: '102', status: 'ACTIVE' }],
        }),
      },
      extension: { findFirst: vi.fn() },
    };

    const extensionNumber = await resolveExtensionNumberFromTo(
      prisma,
      'sip:gencredTargetUser@sip.telnyx.com',
      'tenant-a',
    );

    expect(extensionNumber).toBe('102');
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-a',
          telnyxSipUsername: expect.objectContaining({ equals: 'gencredTargetUser' }),
        }),
      }),
    );
  });

  it('resolveExtensionNumberFromTo falls back to global gencred lookup without tenant', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          tenantId: 'tenant-a',
          extensions: [{ extensionNumber: '103', status: 'ACTIVE' }],
        }),
      },
      extension: { findFirst: vi.fn() },
    };

    const extensionNumber = await resolveExtensionNumberFromTo(
      prisma,
      'sip:gencredTargetUser@sip.telnyx.com',
      null,
    );

    expect(extensionNumber).toBe('103');
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          telnyxSipUsername: expect.objectContaining({ equals: 'gencredTargetUser' }),
        }),
      }),
    );
  });

  it('DESK_CALL_ROUTER_V2 is enabled by default', () => {
    expect(isDeskCallRouterV2Enabled()).toBe(true);
  });

  it('DESK_CALL_ROUTER_V2_LEGACY disables the router', () => {
    process.env.DESK_CALL_ROUTER_V2_LEGACY = 'true';
    expect(isDeskCallRouterV2Enabled()).toBe(false);
  });
});
