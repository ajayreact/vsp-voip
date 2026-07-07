import { describe, expect, it, afterEach } from 'vitest';
import { isDedicatedDeskCredentialPilotTenant } from '../../lib/telephony/deskDedicatedCredentialPilot.js';

const PILOT_TENANT_ID = 'symplore-tenant-id';
const OTHER_TENANT_ID = 'not-a-pilot-tenant';

describe('Symplore pilot — deskDedicatedCredentialPilot allowlist gate', () => {
  const ORIGINAL_ENV = process.env.DESK_DEDICATED_CREDENTIAL_PILOT_TENANT_IDS;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.DESK_DEDICATED_CREDENTIAL_PILOT_TENANT_IDS;
    } else {
      process.env.DESK_DEDICATED_CREDENTIAL_PILOT_TENANT_IDS = ORIGINAL_ENV;
    }
  });

  it('is false when the allowlist env var is unset', () => {
    delete process.env.DESK_DEDICATED_CREDENTIAL_PILOT_TENANT_IDS;
    expect(isDedicatedDeskCredentialPilotTenant(PILOT_TENANT_ID)).toBe(false);
  });

  it('is true only for tenants in the comma-separated allowlist', () => {
    process.env.DESK_DEDICATED_CREDENTIAL_PILOT_TENANT_IDS = `${PILOT_TENANT_ID}, some-other-id`;
    expect(isDedicatedDeskCredentialPilotTenant(PILOT_TENANT_ID)).toBe(true);
    expect(isDedicatedDeskCredentialPilotTenant(OTHER_TENANT_ID)).toBe(false);
  });

  it('is false for a null/undefined tenantId', () => {
    process.env.DESK_DEDICATED_CREDENTIAL_PILOT_TENANT_IDS = PILOT_TENANT_ID;
    expect(isDedicatedDeskCredentialPilotTenant(null as any)).toBe(false);
    expect(isDedicatedDeskCredentialPilotTenant(undefined as any)).toBe(false);
  });
});
