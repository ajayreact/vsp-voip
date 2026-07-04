import { describe, expect, it, vi } from 'vitest';
import {
  resolveCallerFromPayload,
  resolveParkedOutboundPstnFrom,
} from '../../lib/internalExtensionDial.js';

const CREDENTIAL_CONNECTION_ID = '2982156817053779933';
const CALL_CONTROL_APPLICATION_ID = '2985826004359972249';

const platform = {
  telnyxCredentialConnectionId: CREDENTIAL_CONNECTION_ID,
  telnyxCallControlApplicationId: CALL_CONTROL_APPLICATION_ID,
};

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

  it('Call Control outbound resolves via assignedUserId when from is tenant DID (desk phone)', async () => {
    const tenantId = 'tenant-a-id';
    const phoneFindUnique = vi.fn(async ({ where }) => {
      if (where.number === '+13136505581') {
        return { tenantId, assignedUserId: 'user-a', extensionId: null };
      }
      return null;
    });
    const userFindFirst = vi.fn(async ({ where }) => {
      if (where.id === 'user-a') {
        return {
          id: 'user-a',
          tenantId,
          telnyxSipUsername: null,
          extensions: [{ id: 'ext-a', extensionNumber: '100', tenantId }],
        };
      }
      return null;
    });

    const prisma = {
      extension: { findFirst: vi.fn().mockResolvedValue(null) },
      user: { findFirst: userFindFirst, findMany: vi.fn().mockResolvedValue([]) },
      phoneNumber: { findUnique: phoneFindUnique },
    };

    const result = await resolveCallerFromPayload(prisma, {
      from: '+13136505581',
      to: '101',
      direction: 'outgoing',
      connection_id: CALL_CONTROL_APPLICATION_ID,
    }, platform);

    expect(result?.tenantId).toBe(tenantId);
    expect(result?.resolvedVia).toBe('call_control_did_assigned_user');
    expect(result?.callerExtension?.extensionNumber).toBe('100');
    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'user-a', tenantId }),
      }),
    );
  });

  it('Call Control outbound resolves via extensionId when DID has no assignedUserId', async () => {
    const tenantId = 'tenant-a-id';
    const phoneFindUnique = vi.fn(async ({ where }) => {
      if (where.number === '+13099880196') {
        return { tenantId, assignedUserId: null, extensionId: 'ext-a' };
      }
      return null;
    });
    const extensionFindFirst = vi.fn(async ({ where }) => {
      if (where.id === 'ext-a') {
        return {
          id: 'ext-a',
          tenantId,
          extensionNumber: '100',
          user: {
            id: 'user-a',
            tenantId,
            telnyxSipUsername: 'gencred-desk-user-a',
          },
        };
      }
      return null;
    });

    const prisma = {
      extension: { findFirst: extensionFindFirst },
      user: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      phoneNumber: { findUnique: phoneFindUnique },
    };

    const result = await resolveCallerFromPayload(prisma, {
      from: '+13099880196',
      to: '+13135551212',
      direction: 'outbound',
      connection_id: CALL_CONTROL_APPLICATION_ID,
    }, platform);

    expect(result?.tenantId).toBe(tenantId);
    expect(result?.resolvedVia).toBe('call_control_did_extension');
    expect(result?.callerExtension?.extensionNumber).toBe('100');
    expect(extensionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'ext-a', tenantId }),
      }),
    );
  });

  it('Credential Connection outbound unchanged — CC DID lookup skipped', async () => {
    const phoneFindUnique = vi.fn().mockResolvedValue(null);

    const prisma = {
      extension: { findFirst: vi.fn().mockResolvedValue(null) },
      user: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      phoneNumber: { findUnique: phoneFindUnique },
    };

    const result = await resolveCallerFromPayload(prisma, {
      from: '+13136505581',
      direction: 'outgoing',
      connection_id: CREDENTIAL_CONNECTION_ID,
    }, platform);

    expect(result).toBeNull();
    expect(phoneFindUnique).toHaveBeenCalled();
  });

  it('incoming DID unchanged — Call Control DID lookup skipped for inbound', async () => {
    const extensionFindFirst = vi.fn().mockResolvedValue(null);

    const prisma = {
      extension: { findFirst: extensionFindFirst },
      user: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      phoneNumber: {
        findUnique: vi.fn().mockResolvedValue({
          tenantId: 'tenant-a',
          assignedUserId: null,
          extensionId: 'ext-a',
        }),
      },
    };

    const result = await resolveCallerFromPayload(prisma, {
      from: '+13136505581',
      direction: 'incoming',
      connection_id: CALL_CONTROL_APPLICATION_ID,
    }, platform);

    expect(result).toBeNull();
    expect(extensionFindFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'ext-a' }),
      }),
    );
  });

  it('Call Control outbound with unknown DID still returns null', async () => {
    const prisma = {
      extension: { findFirst: vi.fn().mockResolvedValue(null) },
      user: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      phoneNumber: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    const result = await resolveCallerFromPayload(prisma, {
      from: '+19998887777',
      direction: 'outgoing',
      connection_id: CALL_CONTROL_APPLICATION_ID,
    }, platform);

    expect(result).toBeNull();
  });

  it('mobile outbound unchanged when platform omitted (no CC DID lookup)', async () => {
    const tenantId = 'tenant-a-id';
    const phoneFindUnique = vi.fn().mockResolvedValue(null);
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
      phoneNumber: { findUnique: phoneFindUnique },
    };

    const result = await resolveCallerFromPayload(prisma, {
      from: 'sip:gencred-mobile-a@sip.telnyx.com',
      direction: 'outgoing',
      connection_id: CREDENTIAL_CONNECTION_ID,
    });

    expect(result?.tenantId).toBe(tenantId);
    expect(phoneFindUnique).not.toHaveBeenCalled();
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
