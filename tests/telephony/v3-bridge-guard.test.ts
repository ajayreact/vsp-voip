import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('telephony / v3BridgeGuard flag helpers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TELNYX_V3_CALL_CONTROL_APP_ID = 'v3-desk-app-id';
    process.env.TELEPHONY_V3_INGRESS_ENABLED = 'true';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('tenantFlagsPermitV3DeskExecution requires engine and desk', async () => {
    const { tenantFlagsPermitV3DeskExecution } = await import('../../lib/telephony/v3BridgeGuard.js');

    expect(tenantFlagsPermitV3DeskExecution({
      engineEnabled: true,
      deskEnabled: true,
      observeOnly: false,
    })).toBe(true);

    expect(tenantFlagsPermitV3DeskExecution({
      engineEnabled: false,
      deskEnabled: true,
      observeOnly: false,
    })).toBe(false);

    expect(tenantFlagsPermitV3DeskExecution({
      engineEnabled: true,
      deskEnabled: false,
      observeOnly: false,
    })).toBe(false);

    expect(tenantFlagsPermitV3DeskExecution({
      engineEnabled: true,
      deskEnabled: true,
      observeOnly: true,
    })).toBe(false);
  });

  it('isV3IngressConfigured reflects TELEPHONY_V3_INGRESS_ENABLED', async () => {
    const { isV3IngressConfigured } = await import('../../lib/telephony/v3BridgeGuard.js');
    expect(isV3IngressConfigured()).toBe(true);
    process.env.TELEPHONY_V3_INGRESS_ENABLED = 'false';
    expect(isV3IngressConfigured()).toBe(false);
  });
});

describe('telephony / v3BridgeGuard wiring', () => {
  it('inboundCallControl gates V3 bridge on evaluateV3DeskOutboundBridge', () => {
    const source = readFileSync(join(process.cwd(), 'lib/inboundCallControl.js'), 'utf8');
    expect(source).toContain('evaluateV3DeskOutboundBridge');
    expect(source).toContain('V3 app outbound bridge skipped — using legacy routing');
    expect(source).toContain('if (bridgeDecision.shouldBridge)');
  });

  it('internalExtensionDial falls back to legacy when bridge guard rejects V3', () => {
    const source = readFileSync(join(process.cwd(), 'lib/internalExtensionDial.js'), 'utf8');
    expect(source).toContain('evaluateV3DeskOutboundBridge');
    expect(source).toContain('legacy routing (tenant V3 desk disabled)');
    expect(source).toContain('if (bridgeDecision.shouldBridge)');
  });
});
