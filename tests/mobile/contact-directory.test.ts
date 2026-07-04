import { describe, expect, it } from 'vitest';
import {
  getPresenceLabel,
  resolveContactPresence,
  companyContactFromEntry,
} from '../../mobile-rn/src/contacts/contactPresence';
import { searchUnifiedContacts } from '../../mobile-rn/src/contacts/contactSearch';
import { buildRecentContactEntries } from '../../mobile-rn/src/contacts/recentContacts';
import type { ContactEntry } from '../../mobile-rn/src/api/types';

const sampleCompany = (id: string, name: string, ext = '101', department = 'Sales'): ContactEntry => ({
  id,
  name,
  extensionNumber: ext,
  department,
  email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
  assignedDidNumber: '+15551111111',
  status: 'ACTIVE',
  isOnline: true,
});

describe('mobile / contact search (Phase 4.3)', () => {
  it('searches by name, extension, department, and DID instantly', () => {
    const contacts = [
      companyContactFromEntry(sampleCompany('1', 'Jane Doe', '101')),
      companyContactFromEntry(sampleCompany('2', 'Support Desk', '200', 'Support')),
    ];

    expect(searchUnifiedContacts(contacts, 'jane')).toHaveLength(1);
    expect(searchUnifiedContacts(contacts, '101')).toHaveLength(1);
    expect(searchUnifiedContacts(contacts, 'sales')).toHaveLength(1);
    expect(searchUnifiedContacts(contacts, '555111')).toHaveLength(2);
  });
});

describe('mobile / contact presence (Phase 4.3)', () => {
  it('maps backend signals to enterprise presence labels', () => {
    expect(getPresenceLabel(resolveContactPresence({ isOnline: true }))).toBe('Online');
    expect(getPresenceLabel(resolveContactPresence({ doNotDisturb: true }))).toBe('Do not disturb');
    expect(getPresenceLabel(resolveContactPresence({ onCall: true }))).toBe('On call');
  });
});

describe('mobile / recent contacts (Phase 4.3)', () => {
  it('groups recent peers from calls and messages', () => {
    const entries = buildRecentContactEntries({
      calls: [
        {
          id: 'c1',
          from: '+15552222222',
          to: '+15551111111',
          direction: 'inbound',
          status: 'completed',
          createdAt: '2026-06-24T10:00:00.000Z',
        },
      ],
      conversations: [
        {
          id: 'm1',
          peer: '+15553333333',
          line: '+15551111111',
          unreadCount: 0,
          lastMessagePreview: 'Hello',
          lastMessageAt: '2026-06-24T11:00:00.000Z',
        },
      ],
      companyContacts: [sampleCompany('1', 'Jane Doe')],
    });

    expect(entries).toHaveLength(2);
    expect(entries[0].source).toBe('message');
  });
});
