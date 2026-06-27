import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VoicemailRecord } from '../../api/types';
import { EmptyState, VspVoicemailRow } from '../../components';
import { FriendlyError } from '../../components/ui/FriendlyError';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { keyExtractorById, LIST_ITEM_HEIGHT } from '../../lib/listConstants';
import { voicemailRowLayout } from '../../lib/listLayout';
import { fetchVoicemails } from '../../voicemail';
import { useTheme } from '../../shared/theme';
import { getFriendlyErrorMessage } from '../../utils/friendlyError';
import { spacing } from '../../shared/theme';
import type { CallsStackParamList, YouStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CallsStackParamList & YouStackParamList>;

const EMPTY_VOICEMAIL = (
  <EmptyState icon="🎙️" title="No voicemail" message="New messages will appear here." />
);

export function VoicemailListScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
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
      setError(getFriendlyErrorMessage(err, 'voicemail'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleVoicemailPress = useCallback(
    (voicemailId: string) => {
      navigation.navigate('VoicemailDetail', { voicemailId });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: VoicemailRecord }) => (
      <VspVoicemailRow
        from={item.from}
        timestamp={item.createdAt}
        durationSeconds={item.durationSeconds ?? undefined}
        isRead={item.isRead}
        onPress={() => handleVoicemailPress(item.id)}
      />
    ),
    [handleVoicemailPress],
  );

  const onRefresh = useCallback(() => {
    void load(true);
  }, [load]);

  const refreshControl = useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />,
    [colors.primary, onRefresh, refreshing],
  );

  if (loading) return <SkeletonList rows={6} />;
  if (error) return <FriendlyError title="Couldn't load voicemail" message={error} onRetry={() => load()} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlashList
        data={items}
        keyExtractor={keyExtractorById}
        drawDistance={LIST_ITEM_HEIGHT.voicemail * 8}
        overrideItemLayout={voicemailRowLayout}
        removeClippedSubviews
        refreshControl={refreshControl}
        ListEmptyComponent={EMPTY_VOICEMAIL}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
