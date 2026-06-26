import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ConversationSummary } from '../../api/types';
import { Button, EmptyState, ErrorScreen, LoadingScreen, SearchBar, VspConversationRow } from '../../components';
import { listConversations } from '../../messaging';
import type { MessagesStackParamList } from '../../navigation/types';
import { useTheme } from '../../shared/theme';
import { formatPhone } from '../../utils/format';
import { spacing } from '../../shared/theme';

type Props = NativeStackScreenProps<MessagesStackParamList, 'ConversationList'>;

export function ConversationListScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setConversations(await listConversations());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const peer = c.peer || c.peerNumber || '';
      const line = c.line || c.lineNumber || '';
      const preview = c.lastMessagePreview || '';
      return peer.toLowerCase().includes(q) || line.includes(q) || preview.toLowerCase().includes(q);
    });
  }, [conversations, search]);

  if (loading && conversations.length === 0) {
    return <LoadingScreen message="Loading conversations…" />;
  }
  if (error && conversations.length === 0) {
    return <ErrorScreen message={error} onRetry={() => load()} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.toolbar}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search conversations" />
        <Button
          label="New message"
          onPress={() => navigation.navigate('NewMessage')}
          style={styles.newBtn}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="💬"
            title="No conversations"
            message="SMS and MMS threads for your organization lines appear here."
          />
        }
        renderItem={({ item }) => {
          const peer = item.peer || item.peerNumber || 'Unknown';
          const line = item.line || item.lineNumber;
          return (
            <VspConversationRow
              peerLabel={formatPhone(peer)}
              lineLabel={line}
              preview={item.lastMessagePreview || 'No messages yet'}
              timestamp={item.lastMessageAt}
              unreadCount={item.unreadCount}
              onPress={() =>
                navigation.navigate('ConversationThread', {
                  conversationId: item.id,
                  peerLabel: formatPhone(peer),
                  lineLabel: line,
                })
              }
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  newBtn: {
    alignSelf: 'flex-start',
  },
});
