import { describe, it, expect } from 'vitest';
import { formatSupportReport } from '../../lib/telnyxProductionSetup';

describe('telnyxProductionSetup', () => {
  it('formatSupportReport includes carrier escalation when PSTN not found pattern', () => {
    const report = formatSupportReport({
      timestamp: '2026-07-03T00:00:00.000Z',
      balance: { balance: '5.00' },
      env: { credentialConnectionId: 'c1', callControlAppId: 'a1', v3AppId: 'v3', ovpId: 'o1' },
      urls: { callControl: 'https://api.vspphone.com/webhook/call-control' },
      legacyApp: null,
      v3App: null,
      credentialConnection: null,
      outboundVoiceProfile: null,
      numbers: [{ number: '+13139215654', telnyxId: '123', onCallControl: true, status: 'active' }],
      cdrs: { sip_trunking_today: 0, call_control_today: 0 },
      recentWebhookDeliveries: [],
      issues: ['zero CDRs'],
      pstnNotFoundLikelyCarrier: true,
    });

    expect(report).toContain('Telnyx Support Report');
    expect(report).toContain('LRN provisioning');
    expect(report).toContain('+13139215654');
  });
});
