import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { resolveExtensionRingTargets } from '../../lib/inboundRouting.js';
import { ensureExtensionTelnyxCredential } from '../../lib/extensionSip.js';

describe('Phase 2.4a / employee SIP identity', () => {
  it('resolveExtensionRingTargets returns legacy sip target when extension has no assigned user', async () => {
    const extension = {
      id: 'ext-102',
      extensionNumber: '102',
      displayName: 'Ajay',
      userId: null,
      user: null,
      telnyxSipUsername: 'gencred-desk-102',
      sipEnabled: true,
    };

    const resolution = await resolveExtensionRingTargets({}, extension, 'conn-1');
    expect(resolution?.targets).toHaveLength(1);
    expect(resolution?.targets[0].type).toBe('sip');
    expect(resolution?.targets[0].sipUsername).toBe('gencred-desk-102');
    expect(resolution?.appTargets).toEqual([]);
    expect(resolution?.sipTargets).toHaveLength(1);
  });

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

  it('extensionSip only creates extension-scoped Telnyx credentials behind the Symplore pilot allowlist', () => {
    // Phase 2.4a intentionally removed per-extension Telnyx credentials in favor of the
    // shared employee credential. Runtime evidence (see lib/telephony/deskDedicatedCredentialPilot.js)
    // proved that shared credential causes desk phones and the employee's app to evict
    // each other's single Telnyx registration slot, so a dedicated desk credential was
    // reintroduced — but only for an opt-in tenant allowlist, not unconditionally.
    const source = fs.readFileSync(path.join(process.cwd(), 'lib/extensionSip.js'), 'utf8');
    expect(source).toContain('createExtensionTelephonyCredential');
    expect(source).toContain('isDedicatedDeskCredentialPilotTenant');
    expect(source).toContain('ensureEmployeeTelephonyForExtension');
  });

  it('ensureExtensionTelnyxCredential delegates to employee telephony for non-pilot tenants', async () => {
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

describe('Symplore pilot — dedicated desk Telnyx credential ring targets', () => {
  const PILOT_TENANT_ID = 'symplore-tenant-id';
  const ORIGINAL_ENV = process.env.DESK_DEDICATED_CREDENTIAL_PILOT_TENANT_IDS;

  beforeEach(() => {
    process.env.DESK_DEDICATED_CREDENTIAL_PILOT_TENANT_IDS = PILOT_TENANT_ID;
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.DESK_DEDICATED_CREDENTIAL_PILOT_TENANT_IDS;
    } else {
      process.env.DESK_DEDICATED_CREDENTIAL_PILOT_TENANT_IDS = ORIGINAL_ENV;
    }
  });

  function pilotExtension(overrides = {}) {
    return {
      id: 'ext-1',
      tenantId: PILOT_TENANT_ID,
      extensionNumber: '100',
      displayName: 'Suresh Desk',
      userId: 'user-1',
      user: {
        id: 'user-1',
        name: 'Suresh',
        telnyxSipUsername: 'gencred-suresh-app',
      },
      sipEnabled: true,
      multiDeviceEnabled: true,
      ...overrides,
    };
  }

  it('rings both the app target and the dedicated desk sip target when the desk credential is distinct', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(pilotExtension().user) },
    };
    const extension = pilotExtension({ telnyxSipUsername: 'gencred-suresh-desk' });

    const resolution = await resolveExtensionRingTargets(prisma, extension, 'conn-1');
    expect(resolution?.targets).toHaveLength(2);
    expect(resolution?.targets[0].type).toBe('app');
    expect(resolution?.targets[0].user.telnyxSipUsername).toBe('gencred-suresh-app');
    expect(resolution?.targets[1].type).toBe('sip');
    expect(resolution?.targets[1].sipUsername).toBe('gencred-suresh-desk');
  });

  it('does not double-ring when the extension has not been backfilled yet (desk credential equals app credential)', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(pilotExtension().user) },
    };
    const extension = pilotExtension({ telnyxSipUsername: 'gencred-suresh-app' });

    const resolution = await resolveExtensionRingTargets(prisma, extension, 'conn-1');
    expect(resolution?.targets).toHaveLength(1);
    expect(resolution?.targets[0].type).toBe('app');
  });

  it('does not add a second target for non-pilot tenants even with a distinct desk credential', async () => {
    delete process.env.DESK_DEDICATED_CREDENTIAL_PILOT_TENANT_IDS;
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(pilotExtension().user) },
    };
    const extension = pilotExtension({
      tenantId: 'some-other-tenant',
      telnyxSipUsername: 'gencred-suresh-desk',
    });

    const resolution = await resolveExtensionRingTargets(prisma, extension, 'conn-1');
    expect(resolution?.targets).toHaveLength(1);
    expect(resolution?.targets[0].type).toBe('app');
  });
});
