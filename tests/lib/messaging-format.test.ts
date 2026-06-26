import { describe, it, expect } from 'vitest';
import {
  filterConversations,
  formatMessageStatus,
  formatPhoneDisplay,
  formatDateSeparator,
  groupMessagesWithSeparators,
  isFailedMessageStatus,
  isPendingMessageStatus,
  isValidMessagingPeer,
  mergeMessagesById,
  normalizeDirection,
  peerInitials,
  sortConversationsByActivity,
} from '../../web/src/lib/messaging/format';
import type { PlatformMessage } from '../../web/src/lib/messaging/types';

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

  it('sorts conversations by latest activity', () => {
    const sorted = sortConversationsByActivity([
      { id: 'a', lastMessageAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', lastMessageAt: '2026-06-01T00:00:00.000Z' },
    ]);
    expect(sorted[0].id).toBe('b');
  });

  it('merges duplicate messages by id', () => {
    const merged = mergeMessagesById([
      { id: '1', createdAt: '2026-01-01T00:00:00.000Z', body: 'a' } as PlatformMessage,
      { id: '1', createdAt: '2026-01-01T00:00:00.000Z', body: 'b' } as PlatformMessage,
      { id: '2', createdAt: '2026-01-02T00:00:00.000Z', body: 'c' } as PlatformMessage,
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[1].id).toBe('2');
  });

  it('groups messages with date separators', () => {
    const grouped = groupMessagesWithSeparators([
      { id: '1', createdAt: '2026-06-24T10:00:00.000Z', body: 'Hi' } as PlatformMessage,
      { id: '2', createdAt: '2026-06-24T11:00:00.000Z', body: 'There' } as PlatformMessage,
    ]);
    expect(grouped.filter((item) => item.type === 'separator')).toHaveLength(1);
    expect(grouped.filter((item) => item.type === 'message')).toHaveLength(2);
  });

  it('validates messaging peer numbers', () => {
    expect(isValidMessagingPeer('+13095551212')).toBe(true);
    expect(isValidMessagingPeer('123')).toBe(false);
  });

  it('formats date separators', () => {
    expect(formatDateSeparator(new Date().toISOString())).toBe('Today');
  });
});
