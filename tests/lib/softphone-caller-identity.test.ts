import { describe, it, expect } from 'vitest';
import { resolveCallerIdentity } from '@/components/softphone-v2/utils';
import { resolveInboundCallerNameHint } from '@/lib/inbound-caller-display';
import type { ContactEntry } from '@/components/softphone-v2/types';

const JOHN: ContactEntry = {
  id: 'c1',
  name: 'John Smith',
  extensionNumber: '1002',
  department: 'Sales',
  number: '+13095551212',
};

describe('resolveCallerIdentity', () => {
  it('shows contact name and formatted inbound number when number is saved in contacts', () => {
    const identity = resolveCallerIdentity('+13095551212', [JOHN]);

    expect(identity.name).toBe('John Smith');
    expect(identity.number).toBe('+1 (309) 555-1212');
    expect(identity.name).not.toBe(identity.number);
  });

  it('matches contacts by last 10 digits regardless of formatting', () => {
    const identity = resolveCallerIdentity('3095551212', [JOHN]);

    expect(identity.name).toBe('John Smith');
    expect(identity.number).toBe('+1 (309) 555-1212');
  });

  it('matches internal extension calls by extension number', () => {
    const extContact: ContactEntry = {
      ...JOHN,
      number: null,
    };
    const identity = resolveCallerIdentity('1002', [extContact]);

    expect(identity.name).toBe('John Smith');
    expect(identity.number).toBe('Ext 1002');
  });

  it('uses Telnyx name hint when no contact match', () => {
    const identity = resolveCallerIdentity('+13095551212', [], {
      nameHint: 'Jane Doe',
    });

    expect(identity.name).toBe('Jane Doe');
    expect(identity.number).toBe('+1 (309) 555-1212');
  });

  it('prefers contact name over Telnyx name hint', () => {
    const identity = resolveCallerIdentity('+13095551212', [JOHN], {
      nameHint: 'CNAM Override',
    });

    expect(identity.name).toBe('John Smith');
    expect(identity.number).toBe('+1 (309) 555-1212');
  });

  it('shows number only when no contact or name hint', () => {
    const identity = resolveCallerIdentity('+13095551212', []);

    expect(identity.name).toBe('+1 (309) 555-1212');
    expect(identity.number).toBe('+1 (309) 555-1212');
  });
});

describe('resolveInboundCallerNameHint', () => {
  it('returns remotePartyName when it is a display name', () => {
    expect(resolveInboundCallerNameHint({
      remotePartyName: 'John Smith',
      remotePartyNumber: '+13095551212',
    })).toBe('John Smith');
  });

  it('ignores phone-number-like remotePartyName values', () => {
    expect(resolveInboundCallerNameHint({
      remotePartyName: '+13095551212',
    })).toBe('');
  });

  it('falls back to options.remoteCallerName', () => {
    expect(resolveInboundCallerNameHint({
      options: { remoteCallerName: 'Acme Corp' },
    })).toBe('Acme Corp');
  });
});
