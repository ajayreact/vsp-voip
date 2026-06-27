import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState, SearchBar, VspConversationRow } from '../../components';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { useConversationsInfinite } from '../../hooks/useConversations';
import { filterConversations, formatPhoneDisplay } from '../../messaging/format';
import type { PlatformConversation } from '../../messaging/types';
import type { MessagesStackParamList } from '../../navigation/types';
import { useTheme } from '../../shared/theme';
import { keyExtractorById, LIST_ITEM_HEIGHT } from '../../lib/listConstants';
import { conversationRowLayout } from '../../lib/listLayout';
import { spacing } from '../../shared/theme';

type Props = NativeStackScreenProps<MessagesStackParamList, 'MessageSearch'>;

export function MessageSearchScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const { conversations, isLoading } = useConversationsInfinite();

  const results = useMemo(
    () => filterConversations(conversations, query),
    [conversations, query],
  );

  const renderItem = useCallback(
    ({ item }: { item: PlatformConversation }) => {
      const peer = formatPhoneDisplay(item.peer);
      return (
        <VspConversationRow
          peerLabel={peer}
          lineLabel={item.line}
          preview={item.lastMessagePreview || 'No messages yet'}
          timestamp={item.lastMessageAt || undefined}
          unreadCount={item.unreadCount}
          onPress={() =>
            navigation.navigate('ConversationThread', {
              conversationId: item.id,
              peerLabel: peer,
              lineLabel: item.line,
              peerNumber: item.peer,
            })
          }
        />
      );
    },
    [navigation],
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
          placeholder="Search by number, line, or preview"
          autoFocus
          accessibilityLabel="Search messages"
        />
      </View>
      <FlashList
        data={results}
        keyExtractor={keyExtractorById}
        overrideItemLayout={conversationRowLayout}
        drawDistance={LIST_ITEM_HEIGHT.conversation * 8}
        removeClippedSubviews
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            icon="🔍"
            title={query ? 'No matches' : 'Search conversations'}
            message={
              query
                ? 'Try another phone number or message preview.'
                : 'Enter a phone number or keyword to find a thread.'
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
  },
});
