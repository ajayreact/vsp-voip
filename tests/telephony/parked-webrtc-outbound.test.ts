import { describe, expect, it } from 'vitest';
import {
  parseInternalExtensionDestination,
  isPstnDestination,
  isCredentialConnectionOutbound,
  loadTargetExtensionByDid,
} from '../../lib/internalExtensionDial.js';

describe('parked WebRTC outbound routing helpers', () => {
  it('parses extension destinations', () => {
    expect(parseInternalExtensionDestination('102')).toBe('102');
    expect(parseInternalExtensionDestination('sip:103@sip.telnyx.com')).toBe('103');
    expect(parseInternalExtensionDestination('+13135551212')).toBeNull();
  });

  it('detects PSTN destinations', () => {
    expect(isPstnDestination('+13135551212')).toBe(true);
    expect(isPstnDestination('102')).toBe(false);
  });

  it('detects credential connection outbound legs', () => {
    const platform = { telnyxCredentialConnectionId: 'cred-conn-1' };
    expect(isCredentialConnectionOutbound({
      connection_id: 'cred-conn-1',
      direction: 'outgoing',
    }, platform)).toBe(true);
    expect(isCredentialConnectionOutbound({
      connection_id: 'cc-app-1',
      direction: 'outgoing',
    }, platform)).toBe(false);
    expect(isCredentialConnectionOutbound({
      connection_id: 'cred-conn-1',
      direction: 'incoming',
    }, platform)).toBe(false);
  });

  it('exports loadTargetExtensionByDid helper', () => {
    expect(typeof loadTargetExtensionByDid).toBe('function');
  });
});
