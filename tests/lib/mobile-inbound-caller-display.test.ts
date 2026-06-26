import { describe, it, expect } from 'vitest';
import {
  resolveInboundCallerDisplay,
  extractPhoneDisplayValue,
  isForbiddenInboundCallerValue,
} from '../../mobile-rn/src/calling/inboundCallerDisplay';
import { resolveInboundCallIdentity } from '../../mobile-rn/src/calling/callerIdentity';

const TENANT_DIDS = ['+15559876543', '+15551112222'];

function inboundCall(overrides: Record<string, unknown> = {}) {
  return {
    direction: 'inbound',
    localPartyNumber: '+15559876543',
    options: {
      callerNumber: '+15559876543',
      destinationNumber: '+15559876543',
    },
    ...overrides,
  };
}

describe('mobile inboundCallerDisplay', () => {
  it('PSTN inbound: prefers remotePartyNumber over tenant DID fields', () => {
    const call = inboundCall({
      remotePartyNumber: '+15551234567',
      remotePartyName: 'Jane Doe',
    });

    const result = resolveInboundCallerDisplay(call, TENANT_DIDS);

    expect(result.chosenDisplayNumber).toBe('+15551234567');
    expect(result.source).toBe('remotePartyNumber');
  });

  it('filters tenant DID masquerading as caller', () => {
    const call = inboundCall({
      remotePartyNumber: '+15559876543',
    });

    const result = resolveInboundCallerDisplay(call, TENANT_DIDS);

    expect(result.chosenDisplayNumber).toBe('Unknown');
    expect(result.source).toBe('unknown');
  });

  it('SIP inbound: parses SIP URI in remotePartyNumber', () => {
    const call = inboundCall({
      remotePartyNumber: 'sip:+15557654321@sip.telnyx.com',
    });

    const result = resolveInboundCallerDisplay(call, TENANT_DIDS);

    expect(result.chosenDisplayNumber).toBe('+15557654321');
  });

  it('internal extension call: shows short extension', () => {
    const call = inboundCall({
      remotePartyNumber: '1002',
      localPartyNumber: '1001',
      options: {
        callerNumber: '1001',
        destinationNumber: '1001',
      },
    });

    const result = resolveInboundCallerDisplay(call, TENANT_DIDS);

    expect(result.chosenDisplayNumber).toBe('1002');
  });

  it('anonymous caller resolves to Unknown', () => {
    const call = inboundCall({
      remotePartyNumber: 'Anonymous',
    });

    const result = resolveInboundCallerDisplay(call, TENANT_DIDS);

    expect(result.chosenDisplayNumber).toBe('Unknown');
  });

  it('isForbiddenInboundCallerValue blocks tenant DID', () => {
    const call = inboundCall();
    expect(isForbiddenInboundCallerValue('+15559876543', call, TENANT_DIDS)).toBe(true);
    expect(isForbiddenInboundCallerValue('+15551234567', call, TENANT_DIDS)).toBe(false);
  });

  it('extractPhoneDisplayValue normalizes 10-digit US numbers', () => {
    expect(extractPhoneDisplayValue('5551234567', TENANT_DIDS)).toBe('+15551234567');
  });

  it('resolveInboundCallIdentity applies contact name when matched', () => {
    const call = inboundCall({
      remotePartyNumber: '+15551234567',
      remotePartyName: 'Jane Doe',
    });
    const contacts = [{
      id: '1',
      name: 'Jane Doe',
      extensionNumber: '',
      assignedDidNumber: '+15551234567',
      email: null,
      department: '',
      status: 'ACTIVE' as const,
      isOnline: true,
    }];

    const { identity } = resolveInboundCallIdentity(call, TENANT_DIDS, contacts);

    expect(identity.name).toBe('Jane Doe');
    expect(identity.number).toContain('555');
  });
});
