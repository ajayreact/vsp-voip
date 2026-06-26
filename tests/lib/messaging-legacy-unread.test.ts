import { describe, it, expect } from 'vitest';

const {
  buildLegacyConversationsFromMessages,
  conversationUnreadKey,
} = require('../../lib/messaging/ConversationService');

describe('legacy SMS unread compatibility', () => {
  it('builds unread key as line|peer for inbound messages', () => {
    expect(conversationUnreadKey('+13099880196', '+15551234567')).toBe('+13099880196|+15551234567');
  });

  it('returns legacy SmsMessage ids and unread counts from SmsMessage rows', async () => {
    const prisma = {
      conversation: {
        findMany: async () => ([{
          peer: '+15551234567',
          line: '+13099880196',
          messages: [{
            id: 'platform-msg-1',
            tenantId: 'tenant-1',
            telnyxMessageId: 'tx-1',
            from: '+15551234567',
            to: '+13099880196',
            body: 'Hello',
            direction: 'INBOUND',
            status: 'RECEIVED',
            deliveryError: null,
            readAt: null,
            createdAt: new Date('2026-06-01T12:00:00.000Z'),
            legacySms: {
              id: 'legacy-sms-1',
              isRead: false,
              status: 'received',
            },
          }],
        }]),
      },
      smsMessage: {
        groupBy: async () => ([{
          from: '+15551234567',
          to: '+13099880196',
          _count: { _all: 2 },
        }]),
      },
    };

    const conversations = await buildLegacyConversationsFromMessages(prisma, 'tenant-1');
    expect(conversations).toHaveLength(1);
    expect(conversations[0].unreadCount).toBe(2);
    expect(conversations[0].lastMessage.id).toBe('legacy-sms-1');
    expect(conversations[0].lastMessage.direction).toBe('inbound');
  });
});
