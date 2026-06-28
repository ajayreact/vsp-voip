import { describe, expect, it } from 'vitest';
import type { Call } from '@telnyx/webrtc';
import { isInboundCall, isLikelyInboundRingingInvite } from '@/lib/softphone-call-utils';

function mockCall(overrides: Record<string, unknown> = {}): Call {
  return overrides as Call;
}

describe('isInboundCall', () => {
  it('detects inbound direction', () => {
    expect(isInboundCall(mockCall({ direction: 'inbound' }))).toBe(true);
  });

  it('detects incoming direction alias', () => {
    expect(isInboundCall(mockCall({ direction: 'incoming' }))).toBe(true);
  });

  it('detects inbound invite via remote caller options', () => {
    expect(isInboundCall(mockCall({
      options: { remoteCallerNumber: '+13135551212' },
    }))).toBe(true);
  });

  it('rejects outbound newCall legs', () => {
    expect(isInboundCall(mockCall({
      direction: 'outbound',
      options: { destinationNumber: '+13135551212' },
    }))).toBe(false);
  });

  it('detects inbound via remotePartyNumber', () => {
    expect(isInboundCall(mockCall({
      remotePartyNumber: '+13135551212',
    }))).toBe(true);
  });
});

describe('isLikelyInboundRingingInvite', () => {
  it('detects ringing invite when idle and no destinationNumber', () => {
    expect(isLikelyInboundRingingInvite(mockCall({
      state: 'ringing',
      options: {},
    }), false)).toBe(true);
  });

  it('rejects when outbound session is live', () => {
    expect(isLikelyInboundRingingInvite(mockCall({
      state: 'ringing',
      direction: 'inbound',
    }), true)).toBe(false);
  });
});
