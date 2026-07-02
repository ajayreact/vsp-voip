import { describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const extensionRuntimeAdapter = require('../../lib/v3/runtime/extensionRuntimeAdapter.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const provisioningService = require('../../lib/v3/provisioningService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtimeAdapter = require('../../lib/v3/runtime/runtimeAdapter.js');

describe('V3 extensionRuntimeAdapter', () => {
  it('syncs extension provisioning idempotently', async () => {
    vi.spyOn(provisioningService, 'ensureExtensionProvisioned').mockResolvedValue({
      ok: true,
      provisioned: true,
      telnyxCredentialId: 'cred-1',
      telnyxSipUsername: 'sip101',
    });
    vi.spyOn(runtimeAdapter, 'upsertLink').mockResolvedValue({ id: 'link-1' });

    const prisma = {
      extension: {
        findFirst: vi.fn(async () => ({
          id: 'ext-1',
          tenantId: 't1',
          extensionNumber: '101',
          userId: 'u1',
          user: { telnyxCredentialId: 'cred-1', telnyxSipUsername: 'sip101' },
        })),
      },
    };

    const result = await extensionRuntimeAdapter.sync(prisma, 't1', 'ext-1');
    expect(result.ok).toBe(true);
    expect(result.provision.provisioned).toBe(true);
    expect(runtimeAdapter.upsertLink).toHaveBeenCalled();
  });
});
