import { describe, expect, it } from 'vitest';
import {
  parseInternalExtensionDestination,
  isPstnDestination,
  isCredentialConnectionOutbound,
  describeCredentialConnectionOutboundGate,
  loadTargetExtensionByDid,
} from '../../lib/internalExtensionDial.js';

const CREDENTIAL_CONNECTION_ID = '2982156817053779933';
const CALL_CONTROL_APPLICATION_ID = '2985826004359972249';

const platform = {
  source: 'database',
  telnyxCredentialConnectionId: CREDENTIAL_CONNECTION_ID,
  telnyxCallControlApplicationId: CALL_CONTROL_APPLICATION_ID,
};

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

  it('exports loadTargetExtensionByDid helper', () => {
    expect(typeof loadTargetExtensionByDid).toBe('function');
  });
});

describe('describeCredentialConnectionOutboundGate', () => {
  it('scenario 1: accepts Credential Connection ID on outbound (mobile/WebRTC path)', () => {
    const result = describeCredentialConnectionOutboundGate({
      connection_id: CREDENTIAL_CONNECTION_ID,
      direction: 'outgoing',
    }, platform);

    expect(result.ok).toBe(true);
    expect(result.acceptedAs).toBe('Credential Connection');
    expect(result.expectedCredentialConnectionId).toBe(CREDENTIAL_CONNECTION_ID);
    expect(result.payloadConnectionId).toBe(CREDENTIAL_CONNECTION_ID);
    expect(isCredentialConnectionOutbound({
      connection_id: CREDENTIAL_CONNECTION_ID,
      direction: 'outbound',
    }, platform)).toBe(true);
  });

  it('scenario 2: accepts Call Control Application ID on outbound (desk phone path)', () => {
    const result = describeCredentialConnectionOutboundGate({
      connection_id: CALL_CONTROL_APPLICATION_ID,
      direction: 'outgoing',
    }, platform);

    expect(result.ok).toBe(true);
    expect(result.acceptedAs).toBe('Call Control Application');
    expect(result.expectedCallControlApplicationId).toBe(CALL_CONTROL_APPLICATION_ID);
    expect(result.payloadConnectionId).toBe(CALL_CONTROL_APPLICATION_ID);
    expect(isCredentialConnectionOutbound({
      connection_id: CALL_CONTROL_APPLICATION_ID,
      direction: 'outgoing',
    }, platform)).toBe(true);
  });

  it('scenario 3: rejects unknown connection ID', () => {
    const result = describeCredentialConnectionOutboundGate({
      connection_id: '9999999999999999999',
      direction: 'outgoing',
    }, platform);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('connection_id_mismatch');
    expect(result.acceptedAs).toBeNull();
    expect(result.expectedCredentialConnectionId).toBe(CREDENTIAL_CONNECTION_ID);
    expect(result.expectedCallControlApplicationId).toBe(CALL_CONTROL_APPLICATION_ID);
    expect(result.payloadConnectionId).toBe('9999999999999999999');
  });

  it('scenario 4: rejects inbound direction even with Call Control Application ID', () => {
    const result = describeCredentialConnectionOutboundGate({
      connection_id: CALL_CONTROL_APPLICATION_ID,
      direction: 'incoming',
    }, platform);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('direction_not_outbound');
    expect(result.acceptedAs).toBeNull();
    expect(isCredentialConnectionOutbound({
      connection_id: CALL_CONTROL_APPLICATION_ID,
      direction: 'incoming',
    }, platform)).toBe(false);
  });

  it('scenario 5: mobile outbound credential path remains accepted', () => {
    const result = describeCredentialConnectionOutboundGate({
      connection_id: CREDENTIAL_CONNECTION_ID,
      direction: 'outbound',
      from: 'sip:gencredMobile@sip.telnyx.com',
      to: '101',
    }, platform);

    expect(result.ok).toBe(true);
    expect(result.acceptedAs).toBe('Credential Connection');
    expect(result.event).toBe('call.initiated');
    expect(result.platform).toBe('database');
  });

  it('scenario 6: desk outbound Call Control Application path passes gate', () => {
    const result = describeCredentialConnectionOutboundGate({
      connection_id: CALL_CONTROL_APPLICATION_ID,
      direction: 'outbound',
      from: 'sip:gencredDesk@sip.telnyx.com',
      to: '101',
      call_control_id: 'v3:desk-leg',
    }, platform);

    expect(result.ok).toBe(true);
    expect(result.acceptedAs).toBe('Call Control Application');
    expect(result.direction).toBe('outbound');
  });

  it('includes rich diagnostics on connection_id_mismatch', () => {
    const result = describeCredentialConnectionOutboundGate({
      connection_id: '2985826004359972249-wrong',
      direction: 'outgoing',
    }, platform);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('connection_id_mismatch');
    expect(result).toMatchObject({
      expectedCredentialConnectionId: CREDENTIAL_CONNECTION_ID,
      expectedCallControlApplicationId: CALL_CONTROL_APPLICATION_ID,
      payloadConnectionId: '2985826004359972249-wrong',
      acceptedAs: null,
      direction: 'outgoing',
      event: 'call.initiated',
      platform: 'database',
    });
  });
});
