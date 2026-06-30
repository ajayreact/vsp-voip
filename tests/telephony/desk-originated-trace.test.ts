import { describe, expect, it } from 'vitest';

describe('desk-originated outbound trace classifier', () => {
  it('identifies true desk parked outbound', async () => {
    const { isDeskOriginatedParkedOutbound } = await import('../../lib/telephony/PayloadNormalizer.js');
    expect(isDeskOriginatedParkedOutbound({
      direction: 'outgoing',
      state: 'parked',
      from: 'sip:gencredCaller@sip.telnyx.com',
      to: '102',
    })).toBe(true);
  });

  it('excludes inbound PSTN B-legs (bridging + PSTN from)', async () => {
    const { isDeskOriginatedParkedOutbound } = await import('../../lib/telephony/PayloadNormalizer.js');
    expect(isDeskOriginatedParkedOutbound({
      direction: 'outgoing',
      state: 'bridging',
      from: '+19724301252',
      to: 'sip:gencredDesk@sip.telnyx.com',
    })).toBe(false);
  });

  it('excludes incoming legs', async () => {
    const { isDeskOriginatedParkedOutbound } = await import('../../lib/telephony/PayloadNormalizer.js');
    expect(isDeskOriginatedParkedOutbound({
      direction: 'incoming',
      state: 'parked',
      from: '+15551234567',
      to: '+13136505581',
    })).toBe(false);
  });
});

describe('routeDeskOutbound precheck', () => {
  it('explains skip when V2 disabled via legacy env', async () => {
    process.env.DESK_CALL_ROUTER_V2_LEGACY = 'true';
    const { explainRouteDeskOutboundPrecheck } = await import('../../lib/telephony/deskOutboundTrace.js');
    const payload = {
      direction: 'outgoing',
      state: 'parked',
      connection_id: 'cc-app-1',
    };
    const platform = { telnyxCallControlApplicationId: 'cc-app-1' };
    expect(explainRouteDeskOutboundPrecheck(payload, platform)).toBe('desk_router_v2_disabled');
    delete process.env.DESK_CALL_ROUTER_V2_LEGACY;
  });
});
