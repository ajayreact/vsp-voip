import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { resolveCallerFromPayload } from '../../lib/internalExtensionDial.js';

describe('telephony / tenant extension isolation', () => {
  it('does not query extensionNumber without tenantId in internalExtensionDial', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/internalExtensionDial.js'),
      'utf8',
    );
    expect(source).not.toMatch(
      /where:\s*\{\s*extensionNumber:\s*extFromMatch\[1\]/,
    );
    expect(source).not.toMatch(
      /where:\s*\{\s*extensionNumber:[^,}]+,\s*status:\s*'ACTIVE'\s*\}/,
    );
  });

  it('inbound handleCallInitiated does not route bare extension before DID tenant resolution', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/inboundCallControl.js'),
      'utf8',
    );
    const fnStart = source.indexOf('async function handleCallInitiated');
    const fnBody = source.slice(fnStart, fnStart + 2500);
    expect(fnBody).not.toContain('handleInternalExtensionCallInitiated');
  });

  it('resolveCallerFromPayload ignores ext:NNN without SIP username (no global lookup)', async () => {
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

  it('resolveCallerFromPayload resolves caller tenant from Telnyx SIP username', async () => {
    const tenantId = 'tenant-a-id';
    const findFirst = vi.fn(async ({ where }) => {
      if (where?.telnyxSipUsername?.equals === 'gencred-user-a') {
        return {
          tenantId,
          id: 'ext-a',
          extensionNumber: '101',
          user: { telnyxSipUsername: 'gencred-user-a' },
        };
      }
      return null;
    });

    const prisma = {
      extension: { findFirst },
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      phoneNumber: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    const result = await resolveCallerFromPayload(prisma, {
      from: 'sip:gencred-user-a@sip.telnyx.com',
      direction: 'outgoing',
    });

    expect(result?.tenantId).toBe(tenantId);
    expect(result?.callerExtension?.extensionNumber).toBe('101');
  });
});
