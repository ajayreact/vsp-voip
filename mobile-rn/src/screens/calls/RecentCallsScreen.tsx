import React, { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { CallLogEntry } from '../../api/types';
import { EmptyState, ErrorScreen, LoadingScreen, VspCallRow } from '../../components';
import { useRecentCalls } from '../../hooks/useRecentCalls';
import { useTheme } from '../../shared/theme';

export function RecentCallsScreen() {
  const { colors } = useTheme();
  const { data: calls = [], isLoading, isRefetching, error, refetch } = useRecentCalls(50);

  const renderItem = useCallback(({ item }: { item: CallLogEntry }) => (
    <VspCallRow
      peer={item.direction === 'inbound' ? item.from : item.to}
      direction={item.direction || 'call'}
      status={item.status}
      timestamp={item.createdAt}
      durationLabel={item.durationLabel}
    />
  ), []);

  if (isLoading && calls.length === 0) {
    return <LoadingScreen message="Loading call history…" />;
  }

  if (error && calls.length === 0) {
    return (
      <ErrorScreen
        message={error instanceof Error ? error.message : 'Failed to load calls'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={calls}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📞"
            title="No calls yet"
            message="Your organization's call history will appear here."
          />
        }
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
