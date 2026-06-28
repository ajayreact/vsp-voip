import { describe, expect, it } from 'vitest';
import type { Call } from '@telnyx/webrtc';
import { isInboundCall, isLikelyInboundRingingInvite, looksLikeTelnyxCredentialUsername, shouldIgnoreDuplicateInboundNotification, shouldIgnoreInboundStrayLeg, shouldIgnoreOutboundStrayLeg } from '@/lib/softphone-call-utils';

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

  it('rejects when inbound session is live', () => {
    expect(isLikelyInboundRingingInvite(mockCall({
      state: 'ringing',
      direction: 'inbound',
    }), false, true)).toBe(false);
  });
});

describe('outbound stray leg guards', () => {
  it('detects Telnyx credential usernames', () => {
    expect(looksLikeTelnyxCredentialUsername('gencredewJOH8jhDkOrX6xZ')).toBe(true);
    expect(looksLikeTelnyxCredentialUsername('+13135551212')).toBe(false);
    expect(looksLikeTelnyxCredentialUsername('Basha')).toBe(false);
  });

  it('ignores notifications for a different call id during live outbound', () => {
    expect(shouldIgnoreOutboundStrayLeg('call-a', 'call-b', true)).toBe(true);
    expect(shouldIgnoreOutboundStrayLeg('call-a', 'call-a', true)).toBe(false);
    expect(shouldIgnoreOutboundStrayLeg('call-a', 'call-b', false)).toBe(false);
  });

  it('ignores notifications for a different call id during live inbound', () => {
    expect(shouldIgnoreInboundStrayLeg('call-a', 'call-b', true)).toBe(true);
    expect(shouldIgnoreInboundStrayLeg('call-a', 'call-a', true)).toBe(false);
    expect(shouldIgnoreInboundStrayLeg('call-a', 'call-b', false)).toBe(false);
  });

  it('ignores duplicate inbound ringing after connect on the same call id', () => {
    expect(shouldIgnoreDuplicateInboundNotification({
      sessionDirection: 'inbound',
      sessionCallId: 'call-a',
      callPhase: 'connected',
      notificationCallId: 'call-a',
      notificationState: 'ringing',
    })).toBe(true);
    expect(shouldIgnoreDuplicateInboundNotification({
      sessionDirection: 'inbound',
      sessionCallId: 'call-a',
      callPhase: 'connected',
      notificationCallId: 'call-a',
      notificationState: 'active',
    })).toBe(false);
  });
});
