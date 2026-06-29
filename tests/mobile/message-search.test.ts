import { describe, expect, it } from 'vitest';
import { searchMessaging } from '../../mobile-rn/src/messaging/messageSearch';
import type { PlatformConversation } from '../../mobile-rn/src/messaging/types';

describe('mobile / message search (Phase 4.4)', () => {
  it('finds conversations by preview and messages by body', () => {
    const conversations: PlatformConversation[] = [
      {
        id: 'c1',
        peer: '+15551111111',
        line: '+15551230000',
        unreadCount: 1,
        lastMessagePreview: 'Invoice attached',
        lastMessageAt: '2026-06-24T12:00:00.000Z',
        lastMessage: {
          id: 'm1',
          conversationId: 'c1',
          from: '+15551111111',
          to: '+15551230000',
          body: 'Please review the invoice',
          direction: 'INBOUND',
          status: 'received',
          createdAt: '2026-06-24T12:00:00.000Z',
        },
      },
    ];

    const hits = searchMessaging(conversations, [], 'invoice');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((hit) => hit.kind === 'message')).toBe(true);
  });
});
