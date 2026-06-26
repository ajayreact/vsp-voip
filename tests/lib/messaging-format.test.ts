import { describe, it, expect } from 'vitest';
import {
  filterConversations,
  formatMessageStatus,
  formatPhoneDisplay,
  isFailedMessageStatus,
  isPendingMessageStatus,
  normalizeDirection,
  peerInitials,
} from '../../web/src/lib/messaging/format';

describe('messaging format', () => {
  it('formats US phone numbers for display', () => {
    expect(formatPhoneDisplay('+13095551212')).toBe('+1 (309) 555-1212');
    expect(formatPhoneDisplay('3095551212')).toBe('+1 (309) 555-1212');
  });

  it('normalizes message direction', () => {
    expect(normalizeDirection('OUTBOUND')).toBe('outbound');
    expect(normalizeDirection('INBOUND')).toBe('inbound');
  });

  it('maps delivery statuses', () => {
    expect(formatMessageStatus('delivered')).toBe('Delivered');
    expect(isFailedMessageStatus('delivery_failed')).toBe(true);
    expect(isPendingMessageStatus('queued')).toBe(true);
  });

  it('filters conversations by peer, line, and preview', () => {
    const items = [
      { id: '1', peer: '+13095551212', line: '+15551234567', lastMessagePreview: 'Hello' },
      { id: '2', peer: '+15559876543', line: '+15551234567', lastMessagePreview: 'Invoice' },
    ];
    expect(filterConversations(items, '309')).toHaveLength(1);
    expect(filterConversations(items, 'invoice')).toHaveLength(1);
  });

  it('derives peer initials', () => {
    expect(peerInitials('+13095551212')).toBe('12');
    expect(peerInitials('John Smith')).toBe('JS');
  });
});
