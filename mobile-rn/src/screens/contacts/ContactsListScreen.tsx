import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, ErrorScreen, SearchBar } from '../../components';
import { AlphabetIndex } from '../../components/contacts/AlphabetIndex';
import { ContactListRow } from '../../components/contacts/ContactListRow';
import { ContactSectionHeader } from '../../components/contacts/ContactSectionHeader';
import { VspSegmentedControl } from '../../components/vsp/VspBadge';
import {
  callUnifiedContact,
  messageUnifiedContact,
  openUnifiedContact,
} from '../../contacts/contactActions';
import { searchUnifiedContacts } from '../../contacts/contactSearch';
import type { ContactDirectoryMode } from '../../contacts/types';
import { favoriteKeyForContact, type UnifiedContact } from '../../contacts/types';
import {
  flattenRecentContacts,
  flattenUnifiedContactsWithSections,
  groupUnifiedContactsByLetter,
  type UnifiedContactListItem,
} from '../../contacts/unifiedContactIndex';
import { useContactsDirectory } from '../../hooks/useContactsDirectory';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePhoneConnection } from '../../hooks/usePhoneConnection';
import { useRecentContactsDirectory } from '../../hooks/useRecentContactsDirectory';
import { useConversations } from '../../hooks/useConversations';
import type { ContactsStackParamList, MainTabParamList } from '../../navigation/types';
import { useFavoritesStore } from '../../store/favoritesStore';
import { useTheme } from '../../shared/theme';
import { LIST_ITEM_HEIGHT } from '../../lib/listConstants';
import { spacing, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<ContactsStackParamList, 'ContactsList'>;

const MODES: { id: ContactDirectoryMode; label: string }[] = [
  { id: 'company', label: 'Company' },
  { id: 'customers', label: 'Customers' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'recent', label: 'Recent' },
];

export function ContactsListScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const listRef = useRef<FlashListRef<UnifiedContactListItem>>(null);
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const { favoriteIds, hydrate, hydrated, toggleFavoriteContact, isFavoriteContact } = useFavoritesStore();
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<ContactDirectoryMode>('company');
  const debouncedSearch = useDebouncedValue(search, 200);
  const { companyDirectory, customerDirectory, allContacts, isLoading, isRefetching, error, refetch } =
    useContactsDirectory();
  const { recentContacts } = useRecentContactsDirectory();
  const { data: conversations = [] } = useConversations();
  const { canPlaceCalls } = usePhoneConnection();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const baseContacts = useMemo(() => {
    switch (mode) {
      case 'customers':
        return customerDirectory;
      case 'favorites':
        return allContacts.filter((contact) => favoriteSet.has(favoriteKeyForContact(contact)));
      case 'recent':
        return recentContacts;
      default:
        return companyDirectory;
    }
  }, [allContacts, companyDirectory, customerDirectory, favoriteSet, mode, recentContacts]);

  const filtered = useMemo(
    () => searchUnifiedContacts(baseContacts, debouncedSearch),
    [baseContacts, debouncedSearch],
  );

  const listItems = useMemo(() => {
    if (mode === 'recent') return flattenRecentContacts(filtered);
    return flattenUnifiedContactsWithSections(filtered);
  }, [filtered, mode]);

  const sectionLetters = useMemo(
    () => (mode === 'recent' ? [] : groupUnifiedContactsByLetter(filtered).map((group) => group.letter)),
    [filtered, mode],
  );

  const sectionIndexByLetter = useMemo(() => {
    const map = new Map<string, number>();
    listItems.forEach((item, index) => {
      if (item.type === 'section') map.set(item.letter, index);
    });
    return map;
  }, [listItems]);

  const handlePress = useCallback(
    (contact: UnifiedContact) => {
      openUnifiedContact(contact, navigation as never);
    },
    [navigation],
  );

  const handleCall = useCallback(
    (contact: UnifiedContact) => {
      void callUnifiedContact(contact, canPlaceCalls);
    },
    [canPlaceCalls],
  );

  const handleMessage = useCallback(
    (contact: UnifiedContact) => {
      messageUnifiedContact(contact, conversations, tabNavigation);
    },
    [conversations, tabNavigation],
  );

  const handleFavorite = useCallback(
    (contact: UnifiedContact) => {
      void toggleFavoriteContact({ id: contact.id, kind: contact.kind });
    },
    [toggleFavoriteContact],
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
    ({ item }: { item: UnifiedContactListItem }) => {
      if (item.type === 'section') {
        return <ContactSectionHeader letter={item.letter} />;
      }
      return (
        <ContactListRow
          contact={item.contact}
          isFavorite={hydrated && isFavoriteContact(item.contact)}
          onPress={handlePress}
          onCall={handleCall}
          onMessage={handleMessage}
          onFavorite={handleFavorite}
        />
      );
    },
    [handleCall, handleFavorite, handleMessage, handlePress, hydrated, isFavoriteContact],
  );

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const listEmpty = useMemo(
    () => (
      <EmptyState
        icon="👥"
        title={
          mode === 'favorites'
            ? 'No favorites yet'
            : mode === 'customers'
              ? 'No customer contacts'
              : mode === 'recent'
                ? 'No recent contacts'
                : 'No contacts found'
        }
        message={
          mode === 'favorites'
            ? 'Star contacts from the list or detail screen.'
            : mode === 'customers'
              ? 'Add customer contacts with the + button. Sync across devices requires a backend API.'
              : mode === 'recent'
                ? 'Recent calls and messages will appear here.'
                : 'Active extensions in your organization appear here.'
        }
      />
    ),
    [mode],
  );

  if (isLoading && companyDirectory.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Contacts</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && companyDirectory.length === 0) {
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
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, ext, DID, email, company"
        />
        <VspSegmentedControl
          options={MODES.map((item) => ({ key: item.id, label: item.label }))}
          value={mode}
          onChange={(next) => setMode(next as ContactDirectoryMode)}
        />
      </View>

      <View style={styles.listWrap}>
        <FlashList
          ref={listRef}
          data={listItems}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.type}
          drawDistance={LIST_ITEM_HEIGHT.contact * 12}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={listEmpty}
          renderItem={renderItem}
          contentContainerStyle={listItems.length === 0 ? styles.emptyList : undefined}
        />
        {mode !== 'recent' ? (
          <AlphabetIndex letters={sectionLetters} onJump={handleJumpToLetter} />
        ) : null}
      </View>

      {mode === 'customers' ? (
        <Pressable
          onPress={() => navigation.navigate('CustomerContactForm', {})}
          style={[styles.fab, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Add customer contact"
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      ) : null}
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
  listWrap: {
    flex: 1,
    position: 'relative',
  },
  emptyList: {
    flexGrow: 1,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
