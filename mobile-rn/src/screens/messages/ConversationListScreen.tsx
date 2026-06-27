import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  EmptyState,
  SearchBar,
  VspConversationRow,
} from '../../components';
import { FriendlyError } from '../../components/ui/FriendlyError';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { MessagingStateBanner } from '../../components/messaging/MessagingStates';
import { useConversationsInfinite } from '../../hooks/useConversations';
import { filterConversations, formatPhoneDisplay } from '../../messaging/format';
import type { PlatformConversation } from '../../messaging/types';
import { useMessagingLines } from '../../hooks/useMessagingLines';
import { useOutboxStore } from '../../messaging/outboxStore';
import type { MessagesStackParamList } from '../../navigation/types';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../shared/theme';
import { getFriendlyErrorMessage } from '../../utils/friendlyError';
import { keyExtractorById, LIST_ITEM_HEIGHT } from '../../lib/listConstants';
import { conversationRowLayout } from '../../lib/listLayout';
import { spacing, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<MessagesStackParamList, 'ConversationList'>;

export function ConversationListScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const isOnline = useAppStore((s) => s.isOnline);
  const outboxCount = useOutboxStore((s) => s.items.length);
  const {
    conversations,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useConversationsInfinite();
  const { data: setup } = useMessagingLines();

  const filtered = useMemo(
    () => filterConversations(conversations, search),
    [conversations, search],
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

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const refreshControl = useMemo(
    () => <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />,
    [colors.primary, isRefetching, onRefresh],
  );

  const listFooter = useMemo(
    () => (isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null),
    [colors.primary, isFetchingNextPage],
  );

  const listEmpty = useMemo(
    () => (
      <EmptyState
        icon="💬"
        title={search ? 'No matches' : 'No conversations'}
        message={
          search
            ? 'Try a different search term.'
            : 'Start a conversation from a contact or tap the compose button.'
        }
      />
    ),
    [search],
  );

  if (isLoading && conversations.length === 0) {
    return <SkeletonList rows={8} />;
  }

  if (error && conversations.length === 0) {
    const friendly = getFriendlyErrorMessage(error, 'messages');
    const isUnavailable = friendly.includes('Messaging is currently unavailable') || friendly.includes("Couldn't load messages");
    if (isUnavailable) {
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <FriendlyError
            title="Messaging unavailable"
            message="Messaging is currently unavailable. SMS will appear here once the messaging service is enabled."
            icon="chatbubble-ellipses-outline"
            onRetry={() => refetch()}
            retryLabel="Refresh"
          />
        </View>
      );
    }
    return (
      <FriendlyError
        title="Couldn't load messages"
        message={friendly}
        onRetry={() => refetch()}
      />
    );
  }

  if (setup && !setup.lines.length) {
    return (
      <EmptyState
        icon="💬"
        title="No messaging lines"
        message="Assign at least one business number before sending SMS or MMS."
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Text</Text>
        <View style={styles.searchRow}>
          <View style={styles.searchFlex}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search"
              accessibilityLabel="Search conversations"
            />
          </View>
          <Pressable
            onPress={() => navigation.navigate('NewMessage', undefined)}
            style={[styles.composeBtn, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="New message"
          >
            <Ionicons name="create-outline" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {!isOnline ? (
        <MessagingStateBanner
          tone="offline"
          message="You are offline. Conversations refresh when connectivity returns."
        />
      ) : null}

      {outboxCount > 0 ? (
        <MessagingStateBanner
          tone="info"
          message={`${outboxCount} message${outboxCount === 1 ? '' : 's'} queued for delivery.`}
        />
      ) : null}

      {setup && !setup.configured ? (
        <MessagingStateBanner tone="warning" message="Messaging profile is not fully configured on the server." />
      ) : null}

      <FlashList
        data={filtered}
        keyExtractor={keyExtractorById}
        drawDistance={LIST_ITEM_HEIGHT.conversation * 8}
        overrideItemLayout={conversationRowLayout}
        removeClippedSubviews
        refreshControl={refreshControl}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    ...typography.display,
    fontSize: 34,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchFlex: {
    flex: 1,
  },
  composeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingVertical: spacing.lg,
  },
});
