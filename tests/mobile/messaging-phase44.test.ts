import { beforeEach, describe, expect, it } from 'vitest';
import { __resetAsyncStorageForTests } from '@react-native-async-storage/async-storage';
import { useConversationPreferencesStore } from '../../mobile-rn/src/messaging/conversationPreferencesStore';
import {
  applyConversationListFilters,
  conversationDisplayName,
  conversationDeliveryPreview,
} from '../../mobile-rn/src/messaging/conversationDisplay';
import type { PlatformConversation } from '../../mobile-rn/src/messaging/types';

const sampleConversation = (id: string, peer: string): PlatformConversation => ({
  id,
  peer,
  line: '+15551230000',
  unreadCount: 0,
  lastMessagePreview: 'Hello',
  lastMessageAt: '2026-06-24T12:00:00.000Z',
});

describe('mobile / messaging preferences (Phase 4.4)', () => {
  beforeEach(() => {
    __resetAsyncStorageForTests();
    useConversationPreferencesStore.setState({
      pinnedIds: [],
      archivedIds: [],
      hiddenIds: [],
      hydrated: true,
    });
  });

  it('pins and archives conversations locally', () => {
    useConversationPreferencesStore.getState().pin('c1');
    useConversationPreferencesStore.getState().archive('c2');

    expect(useConversationPreferencesStore.getState().isPinned('c1')).toBe(true);
    expect(useConversationPreferencesStore.getState().isArchived('c2')).toBe(true);
  });

  it('sorts pinned conversations ahead of others', () => {
    const items = [
      sampleConversation('c1', '+15551111111'),
      sampleConversation('c2', '+15552222222'),
    ];
    useConversationPreferencesStore.getState().pin('c2');

    const filtered = applyConversationListFilters(items, {
      query: '',
      mode: 'inbox',
      pinnedIds: ['c2'],
      archivedIds: [],
      hiddenIds: [],
    });

    expect(filtered[0].id).toBe('c2');
  });

  it('hides archived conversations from inbox mode', () => {
    const items = [sampleConversation('c1', '+15551111111')];
    useConversationPreferencesStore.getState().archive('c1');

    const filtered = applyConversationListFilters(items, {
      query: '',
      mode: 'inbox',
      pinnedIds: [],
      archivedIds: ['c1'],
      hiddenIds: [],
    });

    expect(filtered).toHaveLength(0);
  });
});

describe('mobile / conversation display (Phase 4.4)', () => {
  it('uses contact name when available', () => {
    const name = conversationDisplayName(sampleConversation('c1', '+15551111111'), {
      id: 'x',
      name: 'Jane Doe',
      extensionNumber: '101',
      department: '',
      email: null,
      assignedDidNumber: '+15551111111',
      status: 'ACTIVE',
      isOnline: true,
    });
    expect(name).toBe('Jane Doe');
  });

  it('shows outbound delivery status on preview', () => {
    const conversation: PlatformConversation = {
      ...sampleConversation('c1', '+15551111111'),
      lastMessage: {
        id: 'm1',
        conversationId: 'c1',
        from: '+15551230000',
        to: '+15551111111',
        body: 'Hi',
        direction: 'OUTBOUND',
        status: 'delivered',
        createdAt: '2026-06-24T12:00:00.000Z',
      },
    };
    expect(conversationDeliveryPreview(conversation)).toBe('Delivered');
  });
});
