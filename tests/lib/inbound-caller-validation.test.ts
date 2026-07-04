/**
 * Proof tests for inbound caller ID validation (Telnyx WebRTC SDK scenarios).
 *
 * Maps to manual validation scenarios 1–4 in docs/vsp/phase3/09-inbound-caller-id-validation.md
 */
import { describe, expect, it } from 'vitest';
import { resolveCallerIdentity } from '@/components/softphone-v2/utils';
import {
  collectInboundCallerFieldSnapshot,
  mergeInboundCallerLabel,
  resolveInboundSessionIdentity,
} from '@/lib/inbound-caller-display';
import { reduceCallEvent, createInitialTelephonySnapshot } from '@/lib/telephony/call-fsm';

const TENANT_DIDS = ['+15559876543'];

function bridgePstnCall(overrides: Record<string, unknown> = {}) {
  return {
    direction: 'inbound',
    localPartyNumber: '+15559876543',
    remotePartyNumber: '+15559876543',
    options: {
      callerNumber: '+15559876543',
      destinationNumber: '+15559876543',
    },
    ...overrides,
  };
}

describe('Scenario 1 – Incoming PSTN call (Call Control bridge)', () => {
  it('resolves PSTN number from remotePartyName before Accept', () => {
    const identity = resolveInboundSessionIdentity(
      bridgePstnCall({ remotePartyName: '+15551234567' }),
      { ownNumbers: TENANT_DIDS },
    );

    expect(identity.displayNumber).toBe('+15551234567');
    expect(identity.source).toBe('remotePartyName');
    expect(identity.displayNumber).not.toBe('Unknown');
  });

  it('incoming UI shows number immediately, not Unknown Caller', () => {
    const identity = resolveInboundSessionIdentity(
      bridgePstnCall({ remotePartyName: '+15551234567' }),
      { ownNumbers: TENANT_DIDS },
    );
    const ui = resolveCallerIdentity(identity.displayNumber, [], {
      nameHint: identity.nameHint,
    });

    expect(ui.name).not.toBe('Unknown Caller');
    expect(ui.number).toContain('555');
  });

  it('caller identity unchanged after simulated Accept (duplicate notification)', () => {
    const call = bridgePstnCall({ remotePartyName: '+15551234567' });
    const before = resolveInboundSessionIdentity(call, { ownNumbers: TENANT_DIDS });
    const after = resolveInboundSessionIdentity(
      { ...call, remotePartyNumber: '+15559876543' },
      { ownNumbers: TENANT_DIDS },
    );

    const stickyNumber = mergeInboundCallerLabel(before.displayNumber, after.displayNumber);
    expect(stickyNumber).toBe('+15551234567');
  });
});

describe('Scenario 2 – CNAM available', () => {
  it('shows John Smith + E.164 number (name and number separate)', () => {
    const identity = resolveInboundSessionIdentity(
      bridgePstnCall({
        remotePartyName: 'John Smith',
        options: {
          caller_id_number: '+15551234567',
          caller_id_name: 'John Smith',
        },
      }),
      { ownNumbers: TENANT_DIDS },
    );

    expect(identity.nameHint).toBe('John Smith');
    expect(identity.displayNumber).toBe('+15551234567');
    expect(identity.source).toBe('options.callerIdNumber');

    const ui = resolveCallerIdentity(identity.displayNumber, [], {
      nameHint: identity.nameHint,
    });
    expect(ui.name).toBe('John Smith');
    expect(ui.number).toBe('+1 (555) 123-4567');
    expect(ui.name).not.toBe(ui.number);
  });

  it('uses client_state pstnCaller for number when SDK only provides CNAM in remotePartyName', () => {
    const clientState = Buffer.from(JSON.stringify({
      pstnCaller: '+15557654321',
      pstnCallerName: 'John Smith',
    })).toString('base64');

    const identity = resolveInboundSessionIdentity(
      bridgePstnCall({
        remotePartyName: 'John Smith',
        options: { client_state: clientState },
      }),
      { ownNumbers: TENANT_DIDS },
    );

    expect(identity.nameHint).toBe('John Smith');
    expect(identity.displayNumber).toBe('+15557654321');
    expect(identity.source).toBe('options.clientState');
  });
});

describe('Scenario 3 – No CNAM (number only)', () => {
  it('shows E.164 only, never Unknown Caller', () => {
    const identity = resolveInboundSessionIdentity(
      bridgePstnCall({ remotePartyName: '+15551234567' }),
      { ownNumbers: TENANT_DIDS },
    );

    expect(identity.nameHint).toBe('');
    expect(identity.displayNumber).toBe('+15551234567');

    const ui = resolveCallerIdentity(identity.displayNumber, []);
    expect(ui.name).toBe('+1 (555) 123-4567');
    expect(ui.name).not.toBe('Unknown Caller');
  });

  it('direct WebRTC inbound uses caller_id_number when not tenant DID', () => {
    const identity = resolveInboundSessionIdentity(
      {
        direction: 'inbound',
        remotePartyNumber: '+15551234567',
        options: { caller_id_number: '+15551234567' },
      },
      { ownNumbers: TENANT_DIDS },
    );

    expect(identity.displayNumber).toBe('+15551234567');
    expect(identity.source).toBe('options.callerIdNumber');
  });
});

describe('Scenario 4 – Duplicate notifications', () => {
  it('never replaces known caller with Unknown across notification sequence', () => {
    let label = '';
    const notifications = [
      { remotePartyName: '+15551234567' },
      { remotePartyNumber: '+15559876543', remotePartyName: '+15551234567' },
      { remotePartyNumber: 'Unknown', remotePartyName: '' },
    ];

    for (const fields of notifications) {
      const next = resolveInboundSessionIdentity(
        bridgePstnCall(fields),
        { ownNumbers: TENANT_DIDS },
      );
      label = mergeInboundCallerLabel(label, next.displayNumber);
    }

    expect(label).toBe('+15551234567');
  });

  it('FSM SESSION_LABEL stays sticky under duplicate Unknown updates', () => {
    let snap = createInitialTelephonySnapshot();
    snap = reduceCallEvent(snap, {
      type: 'INBOUND_RECEIVED',
      callId: 'in-1',
      remoteLabel: '+15551234567',
      logFrom: '+15551234567',
      logTo: '+15559876543',
      callerNameHint: 'John Smith',
    });

    for (let i = 0; i < 3; i += 1) {
      snap = reduceCallEvent(snap, {
        type: 'SESSION_LABEL',
        remoteLabel: 'Unknown',
        callerNameHint: '',
      });
    }

    expect(snap.session?.remoteLabel).toBe('+15551234567');
    expect(snap.session?.callerNameHint).toBe('John Smith');
  });
});

describe('Live check scenarios (automated proof)', () => {
  it('known contact: contact name + number, stable after answer', () => {
    const JOHN = {
      id: 'c1',
      name: 'John Smith',
      extensionNumber: '1002',
      department: 'Sales',
      number: '+13095551212',
    };
    const before = resolveInboundSessionIdentity(
      bridgePstnCall({ remotePartyName: '+13095551212' }),
      { ownNumbers: TENANT_DIDS },
    );
    const uiBefore = resolveCallerIdentity(before.displayNumber, [JOHN], {
      nameHint: before.nameHint,
    });
    const afterLabel = mergeInboundCallerLabel(before.displayNumber, 'Unknown');
    const uiAfter = resolveCallerIdentity(afterLabel, [JOHN], {
      nameHint: before.nameHint,
    });

    expect(uiBefore.name).toBe('John Smith');
    expect(uiBefore.number).toContain('555');
    expect(uiAfter.name).toBe(uiBefore.name);
    expect(uiAfter.number).toBe(uiBefore.number);
  });

  it('unknown caller (no CNAM): number only, never Unknown Caller', () => {
    const identity = resolveInboundSessionIdentity(
      bridgePstnCall({ remotePartyName: '+15551234567' }),
      { ownNumbers: TENANT_DIDS },
    );
    const ui = resolveCallerIdentity(identity.displayNumber, []);

    expect(ui.name).not.toBe('Unknown Caller');
    expect(ui.number).not.toBe('Unknown Caller');
    expect(ui.name).toContain('555');
  });

  it('anonymous/private: intentional label, not Unknown Caller', () => {
    for (const [raw, label] of [
      ['Anonymous', 'Anonymous'],
      ['Private', 'Private Number'],
    ] as const) {
      const identity = resolveInboundSessionIdentity(
        bridgePstnCall({ remotePartyNumber: raw, remotePartyName: raw }),
        { ownNumbers: TENANT_DIDS },
      );
      const ui = resolveCallerIdentity(identity.displayNumber, []);

      expect(identity.displayNumber).toBe(label);
      expect(ui.name).toBe(label);
      expect(ui.name).not.toBe('Unknown Caller');
    }
  });

  it('multiple notifications: duplicate update does not clobber established identity', () => {
    const first = resolveInboundSessionIdentity(
      bridgePstnCall({ remotePartyName: '+15551111111' }),
      { ownNumbers: TENANT_DIDS },
    );
    let label = first.displayNumber;

    const duplicateUnknown = resolveInboundSessionIdentity(
      bridgePstnCall({
        remotePartyNumber: '+15559876543',
        remotePartyName: '',
      }),
      { ownNumbers: TENANT_DIDS },
    );
    label = mergeInboundCallerLabel(label, duplicateUnknown.displayNumber);

    expect(label).toBe('+15551111111');
  });
});

describe('Telnyx notification field capture', () => {
  it('documents all SDK caller fields present on first ringing notification', () => {
    const clientState = Buffer.from(JSON.stringify({
      pstnCaller: '+15551234567',
      pstnCallerName: 'John Smith',
    })).toString('base64');

    const snapshot = collectInboundCallerFieldSnapshot(
      bridgePstnCall({
        remotePartyName: 'John Smith',
        options: {
          caller_id_name: 'John Smith',
          caller_id_number: '+15551234567',
          client_state: clientState,
          customHeaders: [{ name: 'X-Test', value: '1' }],
        },
      }),
      {
        ownNumbers: TENANT_DIDS,
        notification: { type: 'callUpdate', payload: { from: '+15551234567' } },
        pstnCallerHint: '+15551234567',
      },
    );

    expect(snapshot.notificationType).toBe('callUpdate');
    expect(snapshot.remotePartyNumber).toBe('+15559876543');
    expect(snapshot.remotePartyName).toBe('John Smith');
    expect(snapshot.callerIdName).toBe('John Smith');
    expect(snapshot.callerIdNumber).toBe('+15551234567');
    expect(snapshot.clientState).toBe(clientState);
    expect(snapshot.notificationFrom).toBe('+15551234567');
  });
});
