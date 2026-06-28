import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { resolveExtensionRingTargets } from '../../lib/inboundRouting.js';
import { ensureExtensionTelnyxCredential } from '../../lib/extensionSip.js';

describe('Phase 2.4a / employee SIP identity', () => {
  it('resolveExtensionRingTargets returns one app target (no duplicate desk sip target)', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          tenantId: 'tenant-1',
          name: 'Alice',
          telnyxSipUsername: 'gencred-alice',
        }),
      },
    };

    const extension = {
      id: 'ext-1',
      extensionNumber: '101',
      displayName: 'Alice Desk',
      userId: 'user-1',
      user: {
        id: 'user-1',
        name: 'Alice',
        telnyxSipUsername: 'gencred-alice',
      },
      telnyxSipUsername: 'legacy-desk-cred',
      sipEnabled: true,
      multiDeviceEnabled: true,
    };

    const resolution = await resolveExtensionRingTargets(prisma, extension, 'conn-1');
    expect(resolution?.targets).toHaveLength(1);
    expect(resolution?.targets[0].type).toBe('app');
    expect(resolution?.targets[0].user.telnyxSipUsername).toBe('gencred-alice');
    expect(resolution?.sipTargets).toEqual([]);
    expect(resolution?.strategy).toBe('sequential');
  });

  it('extensionSip no longer creates extension-scoped Telnyx credentials', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'lib/extensionSip.js'), 'utf8');
    expect(source).not.toContain('createExtensionTelephonyCredential');
    expect(source).toContain('ensureEmployeeTelephonyForExtension');
  });

  it('ensureExtensionTelnyxCredential delegates to employee telephony', async () => {
    const prisma = {
      extension: {
        update: vi.fn(async ({ data }) => ({ id: 'ext-1', ...data })),
      },
      user: {
        findFirst: vi.fn(),
      },
    };

    const extension = {
      id: 'ext-1',
      tenantId: 'tenant-1',
      extensionNumber: '101',
      userId: null,
      sipEnabled: true,
      sipUsername: null,
    };

    const result = await ensureExtensionTelnyxCredential(prisma, extension);
    expect(result?.sipUsername).toBe('101');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});
