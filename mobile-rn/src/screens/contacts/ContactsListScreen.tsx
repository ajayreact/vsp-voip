import React, { useCallback, useEffect, useMemo } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ContactEntry } from '../../api/types';
import { EmptyState, ErrorScreen, SearchBar } from '../../components';
import { ContactRow } from '../../components/contacts/ContactRow';
import { RipplePressable } from '../../components/ui/RipplePressable';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { filterContacts } from '../../contacts';
import { useContacts } from '../../hooks/useContacts';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { ContactsStackParamList } from '../../navigation/types';
import { useFavoritesStore } from '../../store/favoritesStore';
import { useTheme } from '../../shared/theme';
import { keyExtractorById, LIST_ITEM_HEIGHT } from '../../lib/listConstants';
import { contactRowLayout } from '../../lib/listLayout';
import { spacing, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<ContactsStackParamList, 'ContactsList'>;

export function ContactsListScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { favoriteIds, hydrate, hydrated } = useFavoritesStore();
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(false);
  const { data: contacts = [], isLoading, isRefetching, error, refetch } = useContacts();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const filtered = useMemo(() => {
    let list = filterContacts(contacts, debouncedSearch);
    if (showFavoritesOnly) {
      list = list.filter((c) => favoriteSet.has(c.id));
    } else {
      list = [...list].sort((a, b) => {
        const aFav = favoriteSet.has(a.id) ? 0 : 1;
        const bFav = favoriteSet.has(b.id) ? 0 : 1;
        if (aFav !== bFav) return aFav - bFav;
        return a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [contacts, debouncedSearch, showFavoritesOnly, favoriteSet]);

  const handleContactPress = useCallback(
    (contactId: string) => {
      navigation.navigate('ContactDetail', { contactId });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: ContactEntry }) => (
      <ContactRow item={item} isFavorite={hydrated && favoriteSet.has(item.id)} onPress={handleContactPress} />
    ),
    [favoriteSet, handleContactPress, hydrated],
  );

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const refreshControl = useMemo(
    () => <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />,
    [colors.primary, isRefetching, onRefresh],
  );

  const listEmpty = useMemo(
    () => (
      <EmptyState
        icon="👥"
        title={showFavoritesOnly ? 'No favorites yet' : 'No contacts found'}
        message={
          showFavoritesOnly
            ? 'Star contacts from their detail screen to add them here.'
            : 'Active extensions in your organization appear here.'
        }
      />
    ),
    [showFavoritesOnly],
  );

  if (isLoading && contacts.length === 0) {
    return <SkeletonList rows={8} />;
  }

  if (error && contacts.length === 0) {
    return (
      <ErrorScreen
        message={error instanceof Error ? error.message : 'Failed to load contacts'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Contacts</Text>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, ext, department" />
        <View style={styles.filters}>
          <RipplePressable
            onPress={() => setShowFavoritesOnly(false)}
            style={[
              styles.chip,
              {
                backgroundColor: !showFavoritesOnly ? colors.primary : colors.backgroundAlt,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={{ color: !showFavoritesOnly ? '#fff' : colors.text }}>All</Text>
          </RipplePressable>
          <RipplePressable
            onPress={() => setShowFavoritesOnly(true)}
            style={[
              styles.chip,
              {
                backgroundColor: showFavoritesOnly ? colors.primary : colors.backgroundAlt,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={{ color: showFavoritesOnly ? '#fff' : colors.text }}>Favorites</Text>
          </RipplePressable>
        </View>
      </View>

      <FlashList
        data={filtered}
        keyExtractor={keyExtractorById}
        drawDistance={LIST_ITEM_HEIGHT.contact * 8}
        overrideItemLayout={contactRowLayout}
        removeClippedSubviews
        refreshControl={refreshControl}
        ListEmptyComponent={listEmpty}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: { ...typography.title },
  filters: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
