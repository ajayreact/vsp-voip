import { describe, it, expect } from 'vitest';
import {
  resolveInboundCallerDisplay,
  extractPhoneDisplayValue,
  isForbiddenInboundCallerValue,
  mergeInboundCallerLabel,
} from '@/lib/inbound-caller-display';

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

describe('resolveInboundCallerDisplay', () => {
  it('PSTN inbound: prefers call.remotePartyNumber over tenant DID fields', () => {
    const call = inboundCall({
      remotePartyNumber: '+15551234567',
      remotePartyName: 'Jane Doe',
    });

    const result = resolveInboundCallerDisplay(call, { ownNumbers: TENANT_DIDS });

    expect(result.chosenDisplayNumber).toBe('+15551234567');
    expect(result.source).toBe('remotePartyNumber');
    expect(result.chosenDisplayNumber).not.toBe(call.localPartyNumber);
    expect(result.chosenDisplayNumber).not.toBe(call.options.callerNumber);
  });

  it('SIP inbound: parses SIP URI in remotePartyNumber', () => {
    const call = inboundCall({
      remotePartyNumber: 'sip:+15557654321@sip.telnyx.com',
    });

    const result = resolveInboundCallerDisplay(call, { ownNumbers: TENANT_DIDS });

    expect(result.chosenDisplayNumber).toBe('+15557654321');
    expect(result.source).toBe('remotePartyNumber');
  });

  it('internal extension call: shows short extension when remotePartyNumber is extension', () => {
    const call = inboundCall({
      remotePartyNumber: '1002',
      localPartyNumber: '1001',
      options: {
        callerNumber: '1001',
        destinationNumber: '1001',
      },
    });

    const result = resolveInboundCallerDisplay(call, { ownNumbers: TENANT_DIDS });

    expect(result.chosenDisplayNumber).toBe('1002');
    expect(result.source).toBe('remotePartyNumber');
  });

  it('anonymous caller: shows intentional Anonymous label', () => {
    const call = inboundCall({
      remotePartyNumber: 'Anonymous',
      remotePartyName: 'Anonymous',
    });

    const result = resolveInboundCallerDisplay(call, { ownNumbers: TENANT_DIDS });

    expect(result.chosenDisplayNumber).toBe('Anonymous');
    expect(result.source).toBe('restrictedCaller');
  });

  it('private caller: shows Private Number label', () => {
    const call = inboundCall({
      remotePartyNumber: 'Private',
    });

    const result = resolveInboundCallerDisplay(call, { ownNumbers: TENANT_DIDS });

    expect(result.chosenDisplayNumber).toBe('Private Number');
    expect(result.source).toBe('restrictedCaller');
  });

  it('blocked caller: resolves to Blocked label', () => {
    const call = inboundCall({
      remotePartyNumber: 'Blocked',
    });

    const result = resolveInboundCallerDisplay(call, { ownNumbers: TENANT_DIDS });

    expect(result.chosenDisplayNumber).toBe('Blocked');
    expect(result.source).toBe('restrictedCaller');
  });

  it('caller with display name: number from remotePartyNumber, name preserved in snapshot', () => {
    const call = inboundCall({
      remotePartyNumber: '+15551234567',
      remotePartyName: 'Acme Corp',
    });

    const result = resolveInboundCallerDisplay(call, { ownNumbers: TENANT_DIDS });

    expect(result.chosenDisplayNumber).toBe('+15551234567');
    expect(result.remotePartyName).toBe('Acme Corp');
    expect(result.source).toBe('remotePartyNumber');
  });

  it('missing remotePartyNumber: falls back through priority chain', () => {
    const fromOptions = inboundCall({
      remotePartyNumber: undefined,
      options: {
        callerNumber: '+15559876543',
        destinationNumber: '+15559876543',
        remoteCallerNumber: '+15559887766',
      },
    });
    expect(resolveInboundCallerDisplay(fromOptions, { ownNumbers: TENANT_DIDS }).chosenDisplayNumber)
      .toBe('+15559887766');

    const fromNotification = inboundCall({
      remotePartyNumber: undefined,
      options: { callerNumber: '+15559876543' },
    });
    const notificationResult = resolveInboundCallerDisplay(fromNotification, {
      ownNumbers: TENANT_DIDS,
      notification: { payload: { from: '+15554443322' } },
    });
    expect(notificationResult.chosenDisplayNumber).toBe('+15554443322');
    expect(notificationResult.source).toBe('notification.from');

    const fromPstnHint = inboundCall({ remotePartyNumber: undefined });
    const pstnResult = resolveInboundCallerDisplay(fromPstnHint, {
      ownNumbers: TENANT_DIDS,
      pstnCallerHint: '+15553332211',
    });
    expect(pstnResult.chosenDisplayNumber).toBe('+15553332211');
    expect(pstnResult.source).toBe('pstnCallerHint');
  });

  it('multiple tenant DIDs: never displays a tenant DID as inbound caller', () => {
    const call = inboundCall({
      remotePartyNumber: '+15559876543',
      options: {
        callerNumber: '+15551112222',
        remoteCallerNumber: '+15551112222',
        destinationNumber: '+15559876543',
      },
    });

    const fromIdentity = inboundCall({
      remotePartyNumber: '+15559876543',
      remoteIdentity: {
        displayName: '+15551112222',
        uri: { user: '+15559876543' },
      },
    });

    expect(resolveInboundCallerDisplay(call, { ownNumbers: TENANT_DIDS }).chosenDisplayNumber)
      .toBe('Unknown');

    const identityResult = resolveInboundCallerDisplay(fromIdentity, {
      ownNumbers: TENANT_DIDS,
      notification: { payload: { from: '+15557778899' } },
    });
    expect(identityResult.chosenDisplayNumber).toBe('+15557778899');
    expect(identityResult.source).toBe('notification.from');
  });

  it('never uses localPartyNumber or options.callerNumber as inbound caller', () => {
    const call = inboundCall({
      remotePartyNumber: undefined,
      localPartyNumber: '+15559876543',
      options: {
        callerNumber: '+15559876543',
        destinationNumber: '+15559876543',
      },
    });

    const result = resolveInboundCallerDisplay(call, { ownNumbers: TENANT_DIDS });

    expect(result.chosenDisplayNumber).toBe('Unknown');
    expect(isForbiddenInboundCallerValue('+15559876543', call, TENANT_DIDS)).toBe(true);
  });

  it('display name alone without number resolves to Unknown', () => {
    const call = inboundCall({
      remotePartyNumber: undefined,
      remotePartyName: 'Acme Corp',
      remoteIdentity: { displayName: 'Acme Corp' },
    });

    const result = resolveInboundCallerDisplay(call, { ownNumbers: TENANT_DIDS });

    expect(result.chosenDisplayNumber).toBe('Unknown');
    expect(extractPhoneDisplayValue('Acme Corp', TENANT_DIDS, call)).toBe('');
  });

  it('PSTN bridge: uses remotePartyName when remotePartyNumber is tenant DID', () => {
    const call = inboundCall({
      remotePartyNumber: '+15559876543',
      remotePartyName: '+15551234567',
    });

    const result = resolveInboundCallerDisplay(call, { ownNumbers: TENANT_DIDS });

    expect(result.chosenDisplayNumber).toBe('+15551234567');
    expect(result.source).toBe('remotePartyName');
  });

  it('mergeInboundCallerLabel keeps established caller over Unknown', () => {
    expect(mergeInboundCallerLabel('+15551234567', 'Unknown')).toBe('+15551234567');
    expect(mergeInboundCallerLabel('', '+15551234567')).toBe('+15551234567');
  });
});
