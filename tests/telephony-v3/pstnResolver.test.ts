import { describe, expect, it } from 'vitest';

const {
  isPstnInboundSession,
  isPstnOutboundStubSession,
  resolvePstnCaller,
} = require('../../lib/telephony-v3/Routing/pstnResolver');

describe('V3 pstnResolver helpers', () => {
  it('detects PSTN inbound sessions', () => {
    expect(isPstnInboundSession({ origin: 'PSTN_INBOUND', direction: 'INBOUND' })).toBe(true);
    expect(isPstnInboundSession({ origin: 'DESK', direction: 'INBOUND' })).toBe(false);
  });

  it('detects outbound PSTN stub sessions', () => {
    const session = { origin: 'PSTN_OUTBOUND', direction: 'OUTBOUND' };
    const leg = { fromAddress: '+15551234567' };
    expect(isPstnOutboundStubSession(session, leg)).toBe(true);
  });

  it('rejects credential outbound for PSTN stub', () => {
    const session = { origin: 'PSTN_OUTBOUND', direction: 'OUTBOUND' };
    const leg = { fromAddress: 'sip:gencred123@sip.telnyx.com' };
    expect(isPstnOutboundStubSession(session, leg)).toBe(false);
  });

  it('normalizes PSTN caller', () => {
    const caller = resolvePstnCaller('+15551234567');
    expect(caller.pstnNumber).toBeTruthy();
    expect(caller.anonymous).toBe(false);
  });
});
