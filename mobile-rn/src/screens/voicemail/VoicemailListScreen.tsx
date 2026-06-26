import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { VoicemailRecord } from '../../api/types';
import { EmptyState, ErrorScreen, LoadingScreen, VspHero, VspVoicemailRow } from '../../components';
import type { VoicemailStackParamList } from '../../navigation/types';
import { fetchVoicemails } from '../../voicemail';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../shared/theme';
import { spacing } from '../../shared/theme';

type Props = NativeStackScreenProps<VoicemailStackParamList, 'VoicemailList'>;

export function VoicemailListScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const unreadVm = useAppStore((s) => s.dashboardStats?.unreadVoicemailCount ?? 0);
  const [items, setItems] = useState<VoicemailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setItems(await fetchVoicemails());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voicemail');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingScreen message="Loading voicemail…" />;
  if (error) return <ErrorScreen message={error} onRetry={() => load()} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <VspHero
          eyebrow="Voicemail"
          title={`${unreadVm} unread`}
          subtitle="Organization mailbox"
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="🎙️"
            title="No voicemail"
            message="Recorded messages from callers will appear here."
          />
        }
        renderItem={({ item }) => (
          <VspVoicemailRow
            from={item.from}
            durationSeconds={item.durationSeconds}
            isRead={item.isRead}
            timestamp={item.createdAt}
            onPress={() => navigation.navigate('VoicemailDetail', { voicemailId: item.id })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
});
