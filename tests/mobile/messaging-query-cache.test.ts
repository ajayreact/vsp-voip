import { beforeEach, describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { resolveOutboundStatusLabel } from '../../mobile-rn/src/messaging/format';
import {
  flattenThreadMessages,
  mergeConversationListFromServer,
  mergeInboundThreadMessages,
  reconcileOptimisticThreadMessage,
  threadQueryKey,
  upsertThreadMessage,
} from '../../mobile-rn/src/messaging/messagingQueryCache';
import type { PlatformConversation, PlatformMessage } from '../../mobile-rn/src/messaging/types';

function sampleMessage(id: string, body: string, createdAt: string): PlatformMessage {
  return {
    id,
    conversationId: 'c1',
    from: '+15551230000',
    to: '+15559876543',
    body,
    direction: 'OUTBOUND',
    status: 'sent',
    createdAt,
  };
}

describe('mobile / messaging query cache (Phase 4.4 enterprise)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('upserts optimistic messages into the thread cache', () => {
    const optimistic = {
      ...sampleMessage('opt-1', 'Hello', '2026-06-24T12:00:00.000Z'),
      _optimistic: true,
      status: 'sending',
    };

    upsertThreadMessage(queryClient, 'c1', optimistic);

    const messages = flattenThreadMessages(queryClient.getQueryData(threadQueryKey('c1')));
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toBe('Hello');
    expect(messages[0]._optimistic).toBe(true);
  });

  it('reconciles optimistic message with server response without full reload', () => {
    const optimistic = {
      ...sampleMessage('opt-1', 'Hello', '2026-06-24T12:00:00.000Z'),
      _optimistic: true,
      status: 'sending',
      _outboxId: 'out-1',
    };
    upsertThreadMessage(queryClient, 'c1', optimistic);

    const server = {
      ...sampleMessage('srv-1', 'Hello', '2026-06-24T12:00:01.000Z'),
      status: 'sent',
      _outboxId: 'out-1',
    };
    reconcileOptimisticThreadMessage(queryClient, 'c1', 'opt-1', server);

    const messages = flattenThreadMessages(queryClient.getQueryData(threadQueryKey('c1')));
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('srv-1');
    expect(messages[0].status).toBe('sent');
  });

  it('merges only inbound messages missing from cache', () => {
    upsertThreadMessage(
      queryClient,
      'c1',
      sampleMessage('m1', 'Existing', '2026-06-24T12:00:00.000Z'),
    );

    const added = mergeInboundThreadMessages(queryClient, 'c1', [
      sampleMessage('m1', 'Existing', '2026-06-24T12:00:00.000Z'),
      sampleMessage('m2', 'New', '2026-06-24T12:01:00.000Z'),
    ]);

    expect(added).toBe(1);
    const messages = flattenThreadMessages(queryClient.getQueryData(threadQueryKey('c1')));
    expect(messages.map((item) => item.id)).toEqual(['m1', 'm2']);
  });

  it('merges conversation list updates incrementally', () => {
    const existing: PlatformConversation = {
      id: 'c1',
      peer: '+15551111111',
      line: '+15551230000',
      unreadCount: 2,
      lastMessagePreview: 'Old',
      lastMessageAt: '2026-06-24T11:00:00.000Z',
    };
    queryClient.setQueryData(['messaging', 'conversations'], {
      pageParams: [undefined],
      pages: [{ success: true, count: 1, conversations: [existing], nextCursor: null }],
    });

    mergeConversationListFromServer(queryClient, [
      {
        ...existing,
        unreadCount: 0,
        lastMessagePreview: 'Updated',
        lastMessageAt: '2026-06-24T12:00:00.000Z',
      },
    ]);

    const data = queryClient.getQueryData<{ pages: { conversations: PlatformConversation[] }[] }>([
      'messaging',
      'conversations',
    ]);
    expect(data?.pages[0].conversations[0].lastMessagePreview).toBe('Updated');
    expect(data?.pages[0].conversations[0].unreadCount).toBe(0);
  });
});

describe('mobile / outbound status labels', () => {
  it('progresses from sending to sent to delivered', () => {
    expect(resolveOutboundStatusLabel({ optimistic: true })).toBe('Sending…');
    expect(resolveOutboundStatusLabel({ status: 'sent' })).toBe('Sent');
    expect(resolveOutboundStatusLabel({ status: 'sent', deliveredAt: '2026-06-24T12:00:00.000Z' })).toBe(
      'Delivered',
    );
    expect(resolveOutboundStatusLabel({ status: 'failed' })).toBe('Failed');
  });
});
