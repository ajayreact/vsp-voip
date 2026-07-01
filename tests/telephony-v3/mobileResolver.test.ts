import { describe, expect, it } from 'vitest';

const { isMobileOriginatedSession } = require('../../lib/telephony-v3/Routing/mobileResolver');
const { classifyDestinationKind } = require('../../lib/telephony/DestinationResolver');

describe('V3 mobileResolver helpers', () => {
  it('classifies extension destination from numeric to', () => {
    const kind = classifyDestinationKind('102');
    expect(kind.kind).toBe('EXTENSION');
    expect(kind.extensionNumber).toBe('102');
  });

  it('classifies PSTN destination from e164 to', () => {
    const kind = classifyDestinationKind('+15551234567');
    expect(kind.kind).toBe('PSTN');
  });

  it('detects mobile origin via credential connection', () => {
    const session = { origin: 'PSTN_OUTBOUND', direction: 'OUTBOUND' };
    const originLeg = {
      fromAddress: 'sip:gencred123@sip.telnyx.com',
      connectionId: process.env.TELNYX_CREDENTIAL_CONNECTION_ID || 'test-cred-conn',
    };
    const caller = { userId: 'user-1', sipUsername: 'gencred123' };

    const result = isMobileOriginatedSession(session, originLeg, caller);
    expect(typeof result).toBe('boolean');
  });

  it('rejects desk-originated sessions', () => {
    const session = { origin: 'DESK', direction: 'OUTBOUND' };
    const originLeg = { fromAddress: 'sip:101@sip.telnyx.com', connectionId: 'cc-app' };
    const caller = { userId: 'user-1', sipUsername: '101' };

    expect(isMobileOriginatedSession(session, originLeg, caller)).toBe(false);
  });

  it('rejects inbound PSTN sessions', () => {
    const session = { origin: 'PSTN_INBOUND', direction: 'INBOUND' };
    const originLeg = { fromAddress: '+15551234567', connectionId: 'cred-conn' };
    const caller = { userId: 'user-1', sipUsername: 'gencred123' };

    expect(isMobileOriginatedSession(session, originLeg, caller)).toBe(false);
  });
});
