import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ContactEntry } from '../../api/types';
import { EmptyState, ErrorScreen, SearchBar } from '../../components';
import { AlphabetIndex } from '../../components/contacts/AlphabetIndex';
import { ContactRow } from '../../components/contacts/ContactRow';
import { ContactSectionHeader } from '../../components/contacts/ContactSectionHeader';
import { RipplePressable } from '../../components/ui/RipplePressable';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { filterContacts } from '../../contacts';
import {
  flattenContactsWithSections,
  groupContactsByLetter,
  type ContactListItem,
} from '../../contacts/contactIndex';
import { useContacts } from '../../hooks/useContacts';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { ContactsStackParamList } from '../../navigation/types';
import { useFavoritesStore } from '../../store/favoritesStore';
import { useTheme } from '../../shared/theme';
import { LIST_ITEM_HEIGHT } from '../../lib/listConstants';
import { spacing, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<ContactsStackParamList, 'ContactsList'>;

export function ContactsListScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const listRef = useRef<FlashListRef<ContactListItem>>(null);
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

  const listItems = useMemo(() => flattenContactsWithSections(filtered), [filtered]);

  const sectionLetters = useMemo(
    () => groupContactsByLetter(filtered).map((group) => group.letter),
    [filtered],
  );

  const sectionIndexByLetter = useMemo(() => {
    const map = new Map<string, number>();
    listItems.forEach((item, index) => {
      if (item.type === 'section') map.set(item.letter, index);
    });
    return map;
  }, [listItems]);

  const handleContactPress = useCallback(
    (contactId: string) => {
      navigation.navigate('ContactDetail', { contactId });
    },
    [navigation],
  );

  const handleJumpToLetter = useCallback(
    (letter: string) => {
      const index = sectionIndexByLetter.get(letter);
      if (index == null) return;
      listRef.current?.scrollToIndex({ index, animated: true });
    },
    [sectionIndexByLetter],
  );

  const renderItem = useCallback(
    ({ item }: { item: ContactListItem }) => {
      if (item.type === 'section') {
        return <ContactSectionHeader letter={item.letter} />;
      }
      return (
        <ContactRow
          item={item.contact}
          isFavorite={hydrated && favoriteSet.has(item.contact.id)}
          onPress={handleContactPress}
        />
      );
    },
    [favoriteSet, handleContactPress, hydrated],
  );

  const keyExtractor = useCallback((item: ContactListItem) => item.key, []);
  const getItemType = useCallback((item: ContactListItem) => item.type, []);

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Contacts
        </Text>
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
            accessibilityRole="button"
            accessibilityState={{ selected: !showFavoritesOnly }}
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
            accessibilityRole="button"
            accessibilityState={{ selected: showFavoritesOnly }}
          >
            <Text style={{ color: showFavoritesOnly ? '#fff' : colors.text }}>Favorites</Text>
          </RipplePressable>
        </View>
      </View>

      <View style={styles.listWrap}>
        <FlashList
          ref={listRef}
          data={listItems}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          drawDistance={LIST_ITEM_HEIGHT.contact * 10}
          removeClippedSubviews
          refreshControl={refreshControl}
          ListEmptyComponent={listEmpty}
          renderItem={renderItem}
          contentContainerStyle={listItems.length === 0 ? styles.emptyList : undefined}
        />
        <AlphabetIndex letters={sectionLetters} onJump={handleJumpToLetter} />
      </View>
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
  filters: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 36,
    justifyContent: 'center',
  },
  listWrap: {
    flex: 1,
    position: 'relative',
  },
  emptyList: {
    flexGrow: 1,
  },
});
