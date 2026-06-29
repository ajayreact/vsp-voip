import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState, SearchBar, VspConversationRow } from '../../components';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { useConversationsInfinite } from '../../hooks/useConversations';
import { useMessagingContacts } from '../../hooks/useMessagingContacts';
import { conversationDisplayName, resolveConversationContact } from '../../messaging/conversationDisplay';
import { formatPhoneDisplay } from '../../messaging/format';
import {
  collectCachedThreadMessages,
  searchMessaging,
  type MessageSearchHit,
} from '../../messaging/messageSearch';
import type { MessagesStackParamList } from '../../navigation/types';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<MessagesStackParamList, 'MessageSearch'>;

function SearchResultRow({
  hit,
  onPress,
}: {
  hit: MessageSearchHit;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const contact = hit.contactName;
  const peer = formatPhoneDisplay(hit.conversation.peer);
  const title = contact || peer;

  if (hit.kind === 'message') {
    return (
      <VspConversationRow
        peerLabel={title}
        phoneNumber={contact ? peer : undefined}
        lineLabel={hit.conversation.line}
        preview={hit.snippet}
        timestamp={hit.message.createdAt}
        onPress={onPress}
      />
    );
  }

  return (
    <VspConversationRow
      peerLabel={title}
      phoneNumber={contact ? peer : undefined}
      lineLabel={hit.conversation.line}
      preview={hit.conversation.lastMessagePreview || 'No messages yet'}
      timestamp={hit.conversation.lastMessageAt || undefined}
      unreadCount={hit.conversation.unreadCount}
      onPress={onPress}
    />
  );
}

export function MessageSearchScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const { conversations, isLoading } = useConversationsInfinite();
  const { data: contacts = [] } = useMessagingContacts();

  const cachedMessagesByConversation = useMemo(() => {
    const map: Record<string, ReturnType<typeof collectCachedThreadMessages>> = {};
    for (const conversation of conversations) {
      const data = queryClient.getQueryData<{ pages: { messages: import('../../messaging/types').PlatformMessage[] }[] }>([
        'messaging',
        'thread',
        conversation.id,
      ]);
      map[conversation.id] = collectCachedThreadMessages(data);
    }
    return map;
  }, [conversations, queryClient]);

  const results = useMemo(
    () => searchMessaging(conversations, contacts, query, cachedMessagesByConversation),
    [cachedMessagesByConversation, contacts, conversations, query],
  );

  const openHit = useCallback(
    (hit: MessageSearchHit) => {
      const contact = resolveConversationContact(hit.conversation, contacts);
      navigation.navigate('ConversationThread', {
        conversationId: hit.conversation.id,
        peerLabel: conversationDisplayName(hit.conversation, contact),
        lineLabel: hit.conversation.line,
        peerNumber: hit.conversation.peer,
      });
    },
    [contacts, navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: MessageSearchHit }) => (
      <SearchResultRow hit={item} onPress={() => openHit(item)} />
    ),
    [openHit],
  );

  const keyExtractor = useCallback(
    (item: MessageSearchHit) =>
      item.kind === 'message'
        ? `msg-${item.conversation.id}-${item.message.id}`
        : `conv-${item.conversation.id}`,
    [],
  );

  if (isLoading && !conversations.length) {
    return <SkeletonList rows={8} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.toolbar}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Contact, number, or message text"
          autoFocus
          accessibilityLabel="Global message search"
        />
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Searches loaded conversations and cached thread history on this device.
        </Text>
      </View>
      <FlashList
        data={results}
        keyExtractor={keyExtractor}
        drawDistance={704}
        removeClippedSubviews
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            icon="🔍"
            title={query ? 'No matches' : 'Search business messages'}
            message={
              query
                ? 'Try another contact, phone number, or keyword.'
                : 'Enter a contact name, number, or message text.'
            }
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  hint: {
    ...typography.caption,
  },
});
