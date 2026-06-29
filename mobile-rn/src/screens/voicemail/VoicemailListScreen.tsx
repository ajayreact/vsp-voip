import React, { useCallback, useEffect, useMemo } from 'react';
import { Alert, Pressable, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState, SearchBar, VspVoicemailRow } from '../../components';
import { FriendlyError } from '../../components/ui/FriendlyError';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { buildUnifiedContactPhoneMap } from '../../contacts/unifiedContactIndex';
import { useContactsDirectory } from '../../hooks/useContactsDirectory';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useHiddenVoicemailIds } from '../../hooks/useHiddenVoicemailIds';
import {
  useHideVoicemailLocal,
  useMarkVoicemailRead,
  useVoicemails,
} from '../../hooks/useVoicemails';
import { keyExtractorById, LIST_ITEM_HEIGHT } from '../../lib/listConstants';
import { voicemailRowLayout } from '../../lib/listLayout';
import { enrichVoicemail, filterVoicemails } from '../../voicemail/voicemailDisplay';
import { useTheme } from '../../shared/theme';
import { spacing } from '../../shared/theme';
import type { CallsStackParamList, YouStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CallsStackParamList & YouStackParamList>;

const EMPTY_VOICEMAIL = (
  <EmptyState icon="🎙️" title="No voicemail" message="New messages will appear here." />
);

export function VoicemailListScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const { hiddenIds, hideVoicemail } = useHiddenVoicemailIds();
  const { allContacts } = useContactsDirectory();
  const markRead = useMarkVoicemailRead();
  const hideLocal = useHideVoicemailLocal();

  const { data: items = [], isLoading, isRefetching, error, refetch } = useVoicemails();

  const contactsByPhone = useMemo(() => buildUnifiedContactPhoneMap(allContacts), [allContacts]);

  const enriched = useMemo(() => {
    const visible = items.filter((item) => !hiddenIds.has(item.id));
    return visible.map((item) => enrichVoicemail(item, contactsByPhone));
  }, [contactsByPhone, hiddenIds, items]);

  const filtered = useMemo(
    () => filterVoicemails(enriched, debouncedSearch),
    [debouncedSearch, enriched],
  );

  const handleVoicemailPress = useCallback(
    (voicemailId: string) => {
      navigation.navigate('VoicemailDetail', { voicemailId });
    },
    [navigation],
  );

  const handleDelete = useCallback(
    (voicemailId: string) => {
      Alert.alert(
        'Remove voicemail',
        'Hide this voicemail on this device? The recording remains on the server.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              hideVoicemail(voicemailId);
              hideLocal.mutate(voicemailId);
            },
          },
        ],
      );
    },
    [hideLocal, hideVoicemail],
  );

  const handleMarkRead = useCallback(
    (voicemailId: string) => {
      markRead.mutate(voicemailId);
    },
    [markRead],
  );

  const renderItem = useCallback(
    ({ item }: { item: ReturnType<typeof enrichVoicemail> }) => (
      <View>
        <VspVoicemailRow
          from={item.from}
          contactName={item.contactName}
          contactCompany={item.contactCompany}
          businessDid={item.businessDidLabel}
          timestamp={item.createdAt}
          durationSeconds={item.durationSeconds ?? undefined}
          isRead={item.isRead}
          onPress={() => handleVoicemailPress(item.id)}
        />
        <View style={[styles.actions, { borderBottomColor: colors.border }]}>
          {!item.isRead ? (
            <Pressable onPress={() => handleMarkRead(item.id)} style={styles.actionBtn}>
              <Ionicons name="mail-open-outline" size={18} color={colors.primary} />
              <Text style={[styles.actionLabel, { color: colors.primary }]}>Mark read</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.actionLabel, { color: colors.error }]}>Remove</Text>
          </Pressable>
        </View>
      </View>
    ),
    [colors.border, colors.error, colors.primary, handleDelete, handleMarkRead, handleVoicemailPress],
  );

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const refreshControl = useMemo(
    () => <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />,
    [colors.primary, isRefetching, onRefresh],
  );

  if (isLoading) return <SkeletonList rows={6} />;
  if (error) {
    return (
      <FriendlyError
        title="Couldn't load voicemail"
        message={error instanceof Error ? error.message : 'Unknown error'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.searchWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search voicemail" />
      </View>
      <FlashList
        data={filtered}
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
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: spacing.xs,
  },
  actionLabel: { fontSize: 13, fontWeight: '600' },
});
