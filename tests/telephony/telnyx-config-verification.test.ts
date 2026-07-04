import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/platformSettings', () => ({
  loadPlatformSettings: vi.fn(async () => ({ telnyxConnectionName: 'VSP-SIP-Trunk' })),
}));

vi.mock('../../lib/telnyxConfig', () => ({
  getCredentialConnectionId: vi.fn(() => 'cred-123'),
}));

vi.mock('../../lib/telnyxCallControlSetup', () => ({
  getCallControlApplicationId: vi.fn(() => 'legacy-456'),
  getV3CallControlApplicationId: vi.fn(() => 'v3-789'),
}));

vi.mock('../../lib/telnyxRecordingSetup', () => ({
  getApiPublicUrl: vi.fn(() => 'https://api.vspphone.com'),
}));

const { buildExpectedConfig, formatCheckBlock } = await import('../../lib/telnyxConfigVerification');

describe('telnyxConfigVerification', () => {
  beforeEach(() => {
    vi.stubEnv('API_PUBLIC_URL', 'https://api.vspphone.com');
    vi.stubEnv('TELNYX_OUTBOUND_VOICE_PROFILE_ID', 'ovp-999');
    vi.stubEnv('TELEPHONY_V3_INGRESS_ENABLED', 'true');
    vi.stubEnv('TELEPHONY_V3_EXECUTOR_ENABLED', 'true');
    vi.stubEnv('TELEPHONY_V3_CALLMANAGER_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('buildExpectedConfig includes all required env fields', () => {
    const cfg = buildExpectedConfig(null);
    const fields = cfg.env.map((e) => e.field);
    expect(fields).toContain('TELEPHONY_V3_EXECUTOR_ENABLED');
    expect(fields).toContain('TELEPHONY_V3_CALLMANAGER_ENABLED');
    expect(cfg.urls.v3CallControl).toBe('https://api.vspphone.com/webhook/v3/call-control');
  });

  it('formatCheckBlock renders PASS/FAIL blocks', () => {
    const block = formatCheckBlock({
      pass: false,
      layer: 'credential_connection',
      field: 'outbound.call_parking_enabled',
      apiField: 'outbound.call_parking_enabled',
      apiEndpoint: 'GET /v2/credential_connections/{id}',
      expected: true,
      actual: false,
      autoFixable: true,
      autoFixApi: 'PATCH /v2/credential_connections/{id}',
      reason: null,
    });
    expect(block).toContain('FAIL');
    expect(block).toContain('Auto Fix:');
    expect(block).toContain('YES');
  });
});
