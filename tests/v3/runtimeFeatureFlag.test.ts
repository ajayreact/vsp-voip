import { beforeEach, describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isRuntimeSyncEnabledForTenant, isV3RuntimeSyncEnabled } = require('../../lib/v3/runtime/runtimeFeatureFlag.js');

describe('V3 runtimeFeatureFlag', () => {
  beforeEach(() => {
    delete process.env.V3_RUNTIME_SYNC_ENABLED;
    delete process.env.V3_RUNTIME_SYNC_TENANT_ALLOWLIST;
  });

  it('is disabled by default', () => {
    expect(isV3RuntimeSyncEnabled()).toBe(false);
    expect(isRuntimeSyncEnabledForTenant('t1')).toBe(false);
  });

  it('respects tenant allowlist when set', () => {
    process.env.V3_RUNTIME_SYNC_ENABLED = 'true';
    process.env.V3_RUNTIME_SYNC_TENANT_ALLOWLIST = 't1,t2';
    expect(isRuntimeSyncEnabledForTenant('t1')).toBe(true);
    expect(isRuntimeSyncEnabledForTenant('t3')).toBe(false);
  });
});
