import { describe, expect, it, vi } from 'vitest';
import {
  resolveCallerFromPayload,
  resolveParkedOutboundPstnFrom,
} from '../../lib/internalExtensionDial.js';

describe('telephony / desk outbound caller resolution', () => {
  it('resolveCallerFromPayload resolves desk phone via sip_username when from is extension SIP URI (CASE A)', async () => {
    const tenantId = 'tenant-a-id';
    const userFindFirst = vi.fn(async ({ where }) => {
      if (where?.telnyxSipUsername?.equals === 'gencred-desk-user-a') {
        return {
          tenantId,
          id: 'user-a',
          telnyxSipUsername: 'gencred-desk-user-a',
          extensions: [{ id: 'ext-a', extensionNumber: '101', tenantId }],
        };
      }
      return null;
    });

    const prisma = {
      extension: { findFirst: vi.fn().mockResolvedValue(null) },
      user: { findFirst: userFindFirst },
      phoneNumber: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    const result = await resolveCallerFromPayload(prisma, {
      from: 'sip:101@sip.telnyx.com',
      sip_username: 'gencred-desk-user-a',
      direction: 'outgoing',
    });

    expect(result?.tenantId).toBe(tenantId);
    expect(result?.callerExtension?.extensionNumber).toBe('101');
    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          telnyxSipUsername: expect.objectContaining({ equals: 'gencred-desk-user-a' }),
        }),
      }),
    );
  });

  it('resolveCallerFromPayload resolves desk phone via unique registered extension when sip_username missing', async () => {
    const tenantId = 'tenant-a-id';
    const prisma = {
      extension: { findFirst: vi.fn().mockResolvedValue(null) },
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{
          tenantId,
          id: 'user-a',
          telnyxSipUsername: 'gencred-desk-user-a',
          extensions: [{ id: 'ext-a', extensionNumber: '101', tenantId }],
        }]),
      },
      phoneNumber: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    const result = await resolveCallerFromPayload(prisma, {
      from: 'sip:101@sip.telnyx.com',
      direction: 'outbound',
    });

    expect(result?.tenantId).toBe(tenantId);
    expect(result?.resolvedVia).toBe('unique_registered_extension');
  });

  it('resolveCallerFromPayload does not resolve extension when multiple tenants share the number', async () => {
    const prisma = {
      extension: { findFirst: vi.fn().mockResolvedValue(null) },
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([
          { tenantId: 'tenant-a', id: 'user-a', telnyxSipUsername: 'cred-a', extensions: [] },
          { tenantId: 'tenant-b', id: 'user-b', telnyxSipUsername: 'cred-b', extensions: [] },
        ]),
      },
      phoneNumber: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    const result = await resolveCallerFromPayload(prisma, {
      from: 'sip:101@sip.telnyx.com',
      direction: 'outgoing',
    });

    expect(result).toBeNull();
  });

  it('resolveCallerFromPayload still ignores bare ext:101 without credential username', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = {
      extension: { findFirst },
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      phoneNumber: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    const result = await resolveCallerFromPayload(prisma, {
      from: 'ext:101',
      direction: 'outgoing',
    });

    expect(result).toBeNull();
    expect(findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ extensionNumber: '101' }),
      }),
    );
  });

  it('resolveCallerFromPayload WebRTC/mobile path unchanged when from matches telnyxSipUsername', async () => {
    const tenantId = 'tenant-a-id';
    const userFindFirst = vi.fn(async ({ where }) => {
      if (where?.telnyxSipUsername?.equals === 'gencred-mobile-a') {
        return {
          tenantId,
          id: 'user-a',
          telnyxSipUsername: 'gencred-mobile-a',
          extensions: [{ id: 'ext-a', extensionNumber: '101', tenantId }],
        };
      }
      return null;
    });

    const prisma = {
      extension: { findFirst: vi.fn().mockResolvedValue(null) },
      user: { findFirst: userFindFirst },
      phoneNumber: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    const result = await resolveCallerFromPayload(prisma, {
      from: 'sip:gencred-mobile-a@sip.telnyx.com',
      direction: 'outgoing',
    });

    expect(result?.tenantId).toBe(tenantId);
    expect(userFindFirst).toHaveBeenCalledTimes(1);
  });

  it('resolveParkedOutboundPstnFrom keeps valid E.164 payload.from', async () => {
    const prisma = { extension: { findFirst: vi.fn() }, phoneNumber: { findFirst: vi.fn() } };
    const from = await resolveParkedOutboundPstnFrom(
      prisma,
      { from: '+13135551212' },
      null,
    );
    expect(from).toBe('+13135551212');
    expect(prisma.extension.findFirst).not.toHaveBeenCalled();
  });

  it('resolveParkedOutboundPstnFrom normalizes desk SIP from to ExtensionSecurity.outboundCallerId', async () => {
    const prisma = {
      extension: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'ext-a',
          security: { outboundCallerId: '+15559876543' },
          primaryPhoneNumber: null,
        }),
      },
      phoneNumber: { findFirst: vi.fn() },
    };

    const caller = {
      tenantId: 'tenant-a',
      callerExtension: { id: 'ext-a', extensionNumber: '101' },
    };

    const from = await resolveParkedOutboundPstnFrom(
      prisma,
      { from: 'sip:101@sip.telnyx.com' },
      caller,
    );

    expect(from).toBe('+15559876543');
  });

  it('resolveParkedOutboundPstnFrom falls back to assigned DID then company DID', async () => {
    const prisma = {
      extension: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'ext-a',
          security: { outboundCallerId: null },
          primaryPhoneNumber: { number: '+15551112222' },
        }),
      },
      phoneNumber: { findFirst: vi.fn() },
    };

    const from = await resolveParkedOutboundPstnFrom(
      prisma,
      { from: '101' },
      { tenantId: 'tenant-a', callerExtension: { id: 'ext-a' } },
    );
    expect(from).toBe('+15551112222');

    const prismaCompany = {
      extension: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'ext-a',
          security: null,
          primaryPhoneNumber: null,
        }),
      },
      phoneNumber: {
        findFirst: vi.fn().mockResolvedValue({ number: '+15553334444' }),
      },
    };

    const fromCompany = await resolveParkedOutboundPstnFrom(
      prismaCompany,
      { from: 'sip:101@sip.telnyx.com' },
      { tenantId: 'tenant-a', callerExtension: { id: 'ext-a' } },
    );
    expect(fromCompany).toBe('+15553334444');
  });
});
