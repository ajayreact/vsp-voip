import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { CallLogEntry } from '../../api/types';
import { EmptyState, ErrorScreen, LoadingScreen, VspCallRow } from '../../components';
import { fetchRecentCalls } from '../../calling';
import { useTheme } from '../../shared/theme';

export function RecentCallsScreen() {
  const { colors } = useTheme();
  const [calls, setCalls] = useState<CallLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setCalls(await fetchRecentCalls(50));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calls');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingScreen message="Loading call history…" />;
  if (error) return <ErrorScreen message={error} onRetry={() => load()} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📞"
            title="No calls yet"
            message="Your organization's call history will appear here."
          />
        }
        renderItem={({ item }) => (
          <VspCallRow
            peer={item.direction === 'inbound' ? item.from : item.to}
            direction={item.direction || 'call'}
            status={item.status}
            timestamp={item.createdAt}
            durationLabel={item.durationLabel}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
