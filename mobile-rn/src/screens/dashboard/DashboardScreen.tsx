import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { CallLogEntry } from '../../api/types';
import { Avatar, Button, VspPanel, VspSectionHeader } from '../../components';
import { FriendlyError } from '../../components/ui/FriendlyError';
import { ConnectionBadge } from '../../components/ui/ConnectionBadge';
import { FadeInView } from '../../components/ui/FadeInView';
import { RipplePressable } from '../../components/ui/RipplePressable';
import { SkeletonCards, SkeletonList, Skeleton } from '../../components/ui/SkeletonLoader';
import { fetchDashboardStats } from '../../dashboard';
import { useAfterInteractions } from '../../hooks/useAfterInteractions';
import { usePreloadMainTabs } from '../../hooks/usePreloadMainTabs';
import { useAuth } from '../../hooks/useAuth';
import { useCanPlaceCalls } from '../../calling/TelnyxCallingProvider';
import { useAppStore } from '../../store/appStore';
import { useFavoritesStore } from '../../store/favoritesStore';
import { useTheme } from '../../shared/theme';
import { formatPhone, formatRelativeTime } from '../../utils/format';
import { getFriendlyErrorMessage } from '../../utils/friendlyError';
import { spacing, tokens, typography } from '../../shared/theme';
import type { HomeStackParamList } from '../../navigation/types';
import type { MainTabParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export function DashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const setDashboardStats = useAppStore((s) => s.setDashboardStats);
  const { favoriteIds, hydrate } = useFavoritesStore();
  const connected = useCanPlaceCalls();
  const interactionsReady = useAfterInteractions();
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  usePreloadMainTabs(tabNavigation ?? undefined);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchDashboardStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickDial] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardStats();
      setStats(data);
      setDashboardStats(data);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'dashboard'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setDashboardStats]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!interactionsReady) return;
    hydrate();
  }, [hydrate, interactionsReady]);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const recentCalls = stats?.recentCalls?.slice(0, 6) ?? [];
  const favorites = useMemo(
    () => recentCalls.slice(0, 4),
    [recentCalls],
  );

  function openCallDetails(call: CallLogEntry) {
    navigation.navigate('CallDetails', { callId: call.id, call });
  }

  async function handleQuickCall() {
    navigation.getParent()?.navigate('Keypad');
  }

  if (loading && !stats) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
        <Skeleton height={28} width="60%" />
        <Skeleton height={16} width="40%" style={{ marginTop: spacing.sm }} />
        <SkeletonCards count={2} />
        <SkeletonList rows={4} />
      </ScrollView>
    );
  }

  if (error && !stats) {
    return <FriendlyError title="Couldn't load home" message={error} onRetry={() => load()} />;
  }

  return (
    <FadeInView style={{ flex: 1 }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
      }
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.textMuted }]}>Welcome back</Text>
          <Text style={[styles.name, { color: colors.text }]}>{firstName}</Text>
        </View>
        <RipplePressable onPress={() => navigation.navigate('NotificationsCenter')}>
          <Ionicons name="notifications-outline" size={26} color={colors.text} />
        </RipplePressable>
      </View>

      <ConnectionBadge connected={connected} />

      <VspPanel>
        <VspSectionHeader title="Quick dial" />
        <View style={styles.quickDialRow}>
          <RipplePressable
            style={[styles.quickInput, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
            onPress={() => navigation.getParent()?.navigate('Keypad')}
          >
            <Text style={{ color: quickDial ? colors.text : colors.textMuted }}>
              {quickDial || 'Enter number…'}
            </Text>
          </RipplePressable>
          <Button label="Open dial pad" onPress={handleQuickCall} />
        </View>
      </VspPanel>

      <VspPanel padded={false}>
        <View style={{ padding: spacing.md }}>
          <VspSectionHeader title="Favorites" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favRow}>
          {favoriteIds.length === 0 ? (
            <Text style={[styles.emptyHint, { color: colors.textMuted, paddingHorizontal: spacing.md }]}>
              Star contacts to see them here
            </Text>
          ) : (
            favorites.map((call, i) => (
              <RipplePressable key={call.id || i} style={styles.favItem} onPress={() => openCallDetails(call)}>
                <Avatar name={call.from || call.to} size={56} />
                <Text style={[styles.favName, { color: colors.text }]} numberOfLines={1}>
                  {formatPhone(call.direction === 'inbound' ? call.from : call.to)}
                </Text>
              </RipplePressable>
            ))
          )}
        </ScrollView>
      </VspPanel>

      <VspPanel padded={false}>
        <View style={{ padding: spacing.md }}>
          <VspSectionHeader
            title="Recent activity"
            action={
              <RipplePressable onPress={() => navigation.getParent()?.navigate('Recent')}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>See all</Text>
              </RipplePressable>
            }
          />
        </View>
        {recentCalls.length === 0 ? (
          <Text style={[styles.emptyHint, { color: colors.textMuted, padding: spacing.md }]}>
            Recent calls will appear here
          </Text>
        ) : (
          recentCalls.map((call) => (
            <RipplePressable
              key={call.id}
              onPress={() => openCallDetails(call)}
              style={[styles.activityRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Avatar name={call.direction === 'inbound' ? call.from : call.to} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.text }]}>
                  {formatPhone(call.direction === 'inbound' ? call.from : call.to)}
                </Text>
                <Text style={[styles.activitySub, { color: colors.textMuted }]}>
                  {call.status} · {formatRelativeTime(call.createdAt)}
                </Text>
              </View>
              <Ionicons
                name={call.direction === 'inbound' ? 'arrow-down-outline' : 'arrow-up-outline'}
                size={18}
                color={colors.primary}
              />
            </RipplePressable>
          ))
        )}
      </VspPanel>

      <View style={styles.quickActions}>
        <QuickAction
          icon="call"
          label="Recent"
          color={colors.primary}
          onPress={() => navigation.getParent()?.navigate('Recent')}
        />
        <QuickAction
          icon="chatbubble-ellipses"
          label="Text"
          color={colors.secondary}
          onPress={() => navigation.getParent()?.navigate('Text')}
        />
        <QuickAction
          icon="people"
          label="Contacts"
          color={colors.primary}
          onPress={() => navigation.getParent()?.navigate('Contacts')}
        />
      </View>
    </ScrollView>
    </FadeInView>
  );
}

function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <RipplePressable
      onPress={onPress}
      style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </RipplePressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  greeting: { ...typography.caption, fontWeight: '600' },
  name: { ...typography.title },
  quickDialRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  quickInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  favRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
  favItem: { alignItems: 'center', width: 72, gap: spacing.xs },
  favName: { ...typography.caption, textAlign: 'center' },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  activityTitle: { ...typography.bodyMedium },
  activitySub: { ...typography.caption, marginTop: 2 },
  emptyHint: { ...typography.body },
  quickActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    ...tokens.shadow.card,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...typography.caption, fontWeight: '600' },
});
