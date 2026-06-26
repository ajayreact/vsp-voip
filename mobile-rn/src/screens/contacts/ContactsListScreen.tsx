import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ContactEntry } from '../../api/types';
import { Avatar, EmptyState, ErrorScreen, LoadingScreen, SearchBar } from '../../components';
import { filterContacts } from '../../contacts';
import { useContacts } from '../../hooks/useContacts';
import type { ContactsStackParamList } from '../../navigation/types';
import { useFavoritesStore } from '../../store/favoritesStore';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<ContactsStackParamList, 'ContactsList'>;

export function ContactsListScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { favoriteIds, hydrate, hydrated } = useFavoritesStore();
  const [search, setSearch] = React.useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(false);
  const { data: contacts = [], isLoading, isRefetching, error, refetch } = useContacts();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const filtered = useMemo(() => {
    let list = filterContacts(contacts, search);
    if (showFavoritesOnly) {
      list = list.filter((c) => favoriteIds.includes(c.id));
    }
    return list;
  }, [contacts, search, showFavoritesOnly, favoriteIds]);

  const renderItem = useCallback(({ item }: { item: ContactEntry }) => (
    <Pressable
      onPress={() => navigation.navigate('ContactDetail', { contactId: item.id })}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.backgroundAlt : colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Avatar name={item.name} online={item.isOnline} />
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          Ext {item.extensionNumber}
          {item.department ? ` · ${item.department}` : ''}
        </Text>
      </View>
      {hydrated && favoriteIds.includes(item.id) ? (
        <Text style={{ color: colors.warning }}>★</Text>
      ) : null}
    </Pressable>
  ), [colors, favoriteIds, hydrated, navigation]);

  if (isLoading && contacts.length === 0) {
    return <LoadingScreen message="Loading directory…" />;
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
          <Pressable
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
          </Pressable>
          <Pressable
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
          </Pressable>
        </View>
      </View>

      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="👥"
            title={showFavoritesOnly ? 'No favorites yet' : 'No contacts found'}
            message={
              showFavoritesOnly
                ? 'Star contacts from their detail screen to add them here.'
                : 'Active extensions in your organization appear here.'
            }
          />
        }
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, minWidth: 0 },
  name: { ...typography.body, fontWeight: '600' },
  meta: { ...typography.caption, marginTop: 2 },
});
