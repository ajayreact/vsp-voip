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
} from '../../components';
import { FriendlyError } from '../../components/ui/FriendlyError';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { ConversationListRow } from '../../components/messaging/ConversationListRow';
import { MessagingStateBanner } from '../../components/messaging/MessagingStates';
import { useConversationsInfinite } from '../../hooks/useConversations';
import { useMessagingContacts } from '../../hooks/useMessagingContacts';
import { applyConversationListFilters } from '../../messaging/conversationDisplay';
import { conversationDisplayName, resolveConversationContact } from '../../messaging/conversationDisplay';
import { useConversationPreferencesStore } from '../../messaging/conversationPreferencesStore';
import type { PlatformConversation } from '../../messaging/types';
import { useMessagingLines } from '../../hooks/useMessagingLines';
import { useOutboxStore } from '../../messaging/outboxStore';
import type { MessagesStackParamList } from '../../navigation/types';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../shared/theme';
import { getFriendlyErrorMessage } from '../../utils/friendlyError';
import { keyExtractorById, LIST_ITEM_HEIGHT } from '../../lib/listConstants';
import { conversationRowLayout } from '../../lib/listLayout';
import { spacing, tokens, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<MessagesStackParamList, 'ConversationList'>;

export function ConversationListScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [listMode, setListMode] = useState<ConversationListMode>('inbox');
  const isOnline = useAppStore((s) => s.isOnline);
  const outboxCount = useOutboxStore((s) => s.items.length);
  const pinnedIds = useConversationPreferencesStore((s) => s.pinnedIds);
  const archivedIds = useConversationPreferencesStore((s) => s.archivedIds);
  const hiddenIds = useConversationPreferencesStore((s) => s.hiddenIds);
  const togglePin = useConversationPreferencesStore((s) => s.togglePin);
  const archive = useConversationPreferencesStore((s) => s.archive);
  const unarchive = useConversationPreferencesStore((s) => s.unarchive);
  const hide = useConversationPreferencesStore((s) => s.hide);
  const isPinned = useConversationPreferencesStore((s) => s.isPinned);
  const isArchived = useConversationPreferencesStore((s) => s.isArchived);

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
  const { data: contacts = [] } = useMessagingContacts();
  const { data: setup } = useMessagingLines();

  const filtered = useMemo(
    () =>
      applyConversationListFilters(conversations, {
        query: search,
        mode: listMode,
        pinnedIds,
        archivedIds,
        hiddenIds,
      }),
    [archivedIds, conversations, hiddenIds, listMode, pinnedIds, search],
  );

  const openThread = useCallback(
    (item: PlatformConversation) => {
      const contact = resolveConversationContact(item, contacts);
      navigation.navigate('ConversationThread', {
        conversationId: item.id,
        peerLabel: conversationDisplayName(item, contact),
        lineLabel: item.line,
        peerNumber: item.peer,
      });
    },
    [contacts, navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: PlatformConversation }) => (
      <ConversationListRow
        conversation={item}
        contacts={contacts}
        pinned={isPinned(item.id)}
        archived={isArchived(item.id)}
        onPress={() => openThread(item)}
        onPin={() => togglePin(item.id)}
        onArchive={() => (isArchived(item.id) ? unarchive(item.id) : archive(item.id))}
        onDelete={() => hide(item.id)}
      />
    ),
    [archive, contacts, hide, isArchived, isPinned, openThread, togglePin, unarchive],
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
        title={search ? 'No matches' : listMode === 'archived' ? 'No archived conversations' : 'No conversations'}
        message={
          search
            ? 'Try a different search term.'
            : 'Start a conversation from a contact or tap the compose button.'
        }
      />
    ),
    [listMode, search],
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
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
          <Pressable
            onPress={() => navigation.navigate('MessageSearch')}
            style={[styles.iconBtn, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Global message search"
          >
            <Ionicons name="search-outline" size={20} color={colors.text} />
          </Pressable>
        </View>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations"
          accessibilityLabel="Search conversations"
        />
        <View style={styles.segmentRow}>
          <Pressable
            onPress={() => setListMode('inbox')}
            style={[
              styles.segment,
              {
                backgroundColor: listMode === 'inbox' ? colors.primarySoft : colors.surface,
                borderColor: listMode === 'inbox' ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={{ color: listMode === 'inbox' ? colors.primary : colors.textMuted, fontWeight: '600' }}>
              Inbox
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setListMode('archived')}
            style={[
              styles.segment,
              {
                backgroundColor: listMode === 'archived' ? colors.primarySoft : colors.surface,
                borderColor: listMode === 'archived' ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={{ color: listMode === 'archived' ? colors.primary : colors.textMuted, fontWeight: '600' }}>
              Archived
            </Text>
          </Pressable>
        </View>
      </View>

      {!isOnline ? (
        <MessagingStateBanner
          tone="offline"
          message="You are offline. Showing cached conversations; new messages queue until connectivity returns."
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

      <Pressable
        onPress={() => navigation.navigate('NewMessage', undefined)}
        style={[styles.fab, { backgroundColor: colors.primary }, tokens.shadow.hero]}
        accessibilityRole="button"
        accessibilityLabel="Compose message"
      >
        <Ionicons name="create-outline" size={26} color="#fff" />
      </Pressable>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.display,
    fontSize: 34,
    fontWeight: '700',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    paddingVertical: spacing.lg,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
