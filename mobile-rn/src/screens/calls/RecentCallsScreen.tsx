import React, { useCallback, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
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
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { EmptyState, SearchBar, VspSegmentedControl } from '../../components';
import { MessageDateSeparator } from '../../components/messaging/MessagingStates';
import { RecentCallRow } from '../../components/recents/RecentCallRow';
import { FriendlyError } from '../../components/ui/FriendlyError';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import {
  filterRecentCalls,
  groupRecentCallsWithSeparators,
  matchesRecentAdvancedFilter,
  matchesRecentSegment,
  type RecentCallListItem,
} from '../../calling/groupRecentCalls';
import { getFriendlyCallError, placeOutboundCall } from '../../calling/callingController';
import { usePhoneConnection } from '../../hooks/usePhoneConnection';
import { buildContactLookupMaps, findContactInMaps } from '../../contacts/contactIndex';
import { useContacts } from '../../hooks/useContacts';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useHiddenCallIds } from '../../hooks/useHiddenCallIds';
import { usePreloadMainTabs } from '../../hooks/usePreloadMainTabs';
import { useRecentCalls } from '../../hooks/useRecentCalls';
import { LIST_ITEM_HEIGHT } from '../../lib/listConstants';
import { useTheme } from '../../shared/theme';
import { getFriendlyErrorMessage } from '../../utils/friendlyError';
import { spacing, typography } from '../../shared/theme';
import type { MainTabParamList, RecentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RecentStackParamList, 'RecentMain'>;

const SEGMENTS = [
  { key: 'all', label: 'All' },
  { key: 'missed', label: 'Missed' },
];

const EMPTY_CALLS = (
  <EmptyState icon="📞" title="No recent calls" message="Your call history will appear here." />
);

export function RecentCallsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  usePreloadMainTabs(tabNavigation ?? undefined);

  const [segment, setSegment] = useState('all');
  const [advancedFilter, setAdvancedFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { canPlaceCalls } = usePhoneConnection();
  const { hiddenIds, hideCall, hideCalls } = useHiddenCallIds();

  const { data: calls = [], isLoading, isRefetching, error, refetch } = useRecentCalls();
  const { data: contacts = [] } = useContacts();

  const contactMaps = useMemo(() => buildContactLookupMaps(contacts), [contacts]);

  const filtered = useMemo(() => {
    const visible = calls.filter((call) => {
      if (hiddenIds.has(call.id)) return false;
      if (!matchesRecentSegment(call, segment)) return false;
      return matchesRecentAdvancedFilter(call, advancedFilter);
    });
    return filterRecentCalls(visible, debouncedSearch, contactMaps.namesByPhoneKey);
  }, [advancedFilter, calls, contactMaps.namesByPhoneKey, debouncedSearch, hiddenIds, segment]);

  const listItems = useMemo(() => groupRecentCallsWithSeparators(filtered), [filtered]);

  const toggleSelected = useCallback((callId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(filtered.map((call) => call.id)));
  }, [filtered]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Delete calls',
      `Remove ${selectedIds.size} call${selectedIds.size === 1 ? '' : 's'} from recents on this device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            hideCalls(selectedIds);
            setSelectedIds(new Set());
            setIsEditing(false);
          },
        },
      ],
    );
  }, [hideCalls, selectedIds]);

  const exitEditMode = useCallback(() => {
    setIsEditing(false);
    setSelectedIds(new Set());
  }, []);

  const handleCallPress = useCallback(
    (call: RecentCallListItem & { type: 'call' }) => {
      if (isEditing) {
        toggleSelected(call.call.id);
        return;
      }
      navigation.navigate('CallDetails', { callId: call.call.id, call: call.call });
    },
    [isEditing, navigation, toggleSelected],
  );

  const handleInfoPress = useCallback(
    (call: RecentCallListItem & { type: 'call' }) => {
      const peer = call.call.direction === 'inbound' ? call.call.from : call.call.to;
      const contact = findContactInMaps(contactMaps, peer);
      if (contact) {
        tabNavigation?.navigate('Contacts', {
          screen: 'ContactDetail',
          params: { contactId: contact.id },
        });
      } else {
        navigation.navigate('CallDetails', { callId: call.call.id, call: call.call });
      }
    },
    [contactMaps, navigation, tabNavigation],
  );

  const handleSwipeCall = useCallback((call: RecentCallListItem & { type: 'call' }) => {
    if (!canPlaceCalls) {
      Alert.alert(
        'Unable to place call',
        'The phone is not connected. Please wait while we reconnect.',
      );
      return;
    }
    const peer = call.call.direction === 'inbound' ? call.call.from : call.call.to;
    void placeOutboundCall(peer).catch((err) => {
      Alert.alert('Unable to place call', getFriendlyCallError(err));
    });
  }, [canPlaceCalls]);

  const handleDelete = useCallback(
    (callId: string) => {
      hideCall(callId);
    },
    [hideCall],
  );

  const showFilterMenu = useCallback(() => {
    const options = ['All calls', 'Incoming', 'Outgoing', 'Missed', 'Voicemail', 'Cancel'];
    const cancelIndex = 5;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        (index) => {
          const filters = ['all', 'incoming', 'outgoing', 'missed', 'voicemail'];
          if (index !== undefined && index < cancelIndex) {
            setAdvancedFilter(filters[index] ?? 'all');
          }
        },
      );
      return;
    }

    Alert.alert('Filter calls', undefined, [
      { text: 'All calls', onPress: () => setAdvancedFilter('all') },
      { text: 'Incoming', onPress: () => setAdvancedFilter('incoming') },
      { text: 'Outgoing', onPress: () => setAdvancedFilter('outgoing') },
      { text: 'Missed', onPress: () => setAdvancedFilter('missed') },
      { text: 'Voicemail', onPress: () => setAdvancedFilter('voicemail') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: RecentCallListItem }) => {
      if (item.type === 'separator') {
        return <MessageDateSeparator label={item.label} />;
      }
      const peer = item.call.direction === 'inbound' ? item.call.from : item.call.to;
      const contact = findContactInMaps(contactMaps, peer);
      return (
        <RecentCallRow
          call={item.call}
          contact={contact}
          isEditing={isEditing}
          selected={selectedIds.has(item.call.id)}
          onPress={() => handleCallPress(item)}
          onInfoPress={() => handleInfoPress(item)}
          onCall={() => handleSwipeCall(item)}
          onDelete={() => handleDelete(item.call.id)}
        />
      );
    },
    [contactMaps, handleCallPress, handleDelete, handleInfoPress, handleSwipeCall, isEditing, selectedIds],
  );

  const keyExtractor = useCallback((item: RecentCallListItem) => item.key, []);
  const getItemType = useCallback((item: RecentCallListItem) => item.type, []);

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const refreshControl = useMemo(
    () => <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />,
    [colors.primary, isRefetching, onRefresh],
  );

  if (isLoading && calls.length === 0) {
    return <SkeletonList rows={8} />;
  }

  if (error && calls.length === 0) {
    return (
      <FriendlyError
        title="Couldn't load calls"
        message={getFriendlyErrorMessage(error, 'calls')}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => (isEditing ? exitEditMode() : setIsEditing(true))} hitSlop={8}>
          <Text style={[styles.topAction, { color: colors.primary }]}>
            {isEditing ? 'Done' : 'Edit'}
          </Text>
        </Pressable>
        {!isEditing ? (
          <VspSegmentedControl
            options={SEGMENTS}
            value={segment}
            onChange={setSegment}
            style={styles.segment}
          />
        ) : (
          <Pressable onPress={selectAllVisible} hitSlop={8}>
            <Text style={[styles.selectAll, { color: colors.primary }]}>Select All</Text>
          </Pressable>
        )}
        {!isEditing ? (
          <Pressable onPress={showFilterMenu} hitSlop={8} accessibilityLabel="Filter menu">
            <Ionicons name="ellipsis-horizontal-circle-outline" size={26} color={colors.primary} />
          </Pressable>
        ) : (
          <Pressable onPress={clearSelection} hitSlop={8} disabled={selectedIds.size === 0}>
            <Text
              style={[
                styles.topAction,
                { color: colors.primary, opacity: selectedIds.size === 0 ? 0.4 : 1, textAlign: 'right' },
              ]}
            >
              Clear
            </Text>
          </Pressable>
        )}
      </View>

      <Text style={[styles.title, { color: colors.text }]}>Recents</Text>

      <View style={styles.searchWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search" />
      </View>

      <FlashList
        data={listItems}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        drawDistance={LIST_ITEM_HEIGHT.call * 10}
        removeClippedSubviews
        refreshControl={refreshControl}
        ListEmptyComponent={EMPTY_CALLS}
        renderItem={renderItem}
        contentContainerStyle={listItems.length === 0 ? styles.emptyList : undefined}
        style={styles.list}
      />

      {isEditing && selectedIds.size > 0 ? (
        <View style={[styles.editToolbar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Pressable onPress={deleteSelected} style={styles.deleteSelectedBtn}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={styles.deleteSelectedText}>
              Delete {selectedIds.size} call{selectedIds.size === 1 ? '' : 's'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  topAction: {
    ...typography.body,
    fontWeight: '600',
    minWidth: 44,
  },
  segment: {
    flex: 1,
    maxWidth: 200,
  },
  title: {
    ...typography.display,
    fontSize: 34,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  selectAll: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  editToolbar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
  deleteSelectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  deleteSelectedText: {
    ...typography.bodyMedium,
    color: '#FF3B30',
    fontWeight: '600',
  },
  list: { flex: 1 },
  emptyList: { flexGrow: 1 },
});
