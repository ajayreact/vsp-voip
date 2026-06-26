import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { DashboardStats } from '../../api/types';
import { Avatar, ErrorScreen, ListItem, LoadingScreen, StatCard, VspHero, VspPanel, VspSectionHeader } from '../../components';
import { fetchDashboardStats } from '../../dashboard';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../shared/theme';
import { formatRelativeTime } from '../../utils/format';
import { spacing } from '../../shared/theme';

export function DashboardScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const setDashboardStats = useAppStore((s) => s.setDashboardStats);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardStats();
      setStats(data);
      setDashboardStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setDashboardStats]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !stats) return <LoadingScreen message="Loading dashboard…" />;
  if (error && !stats) return <ErrorScreen message={error} onRetry={() => load()} />;

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
      }
    >
      <VspHero
        eyebrow="Dashboard"
        title={`Welcome back, ${firstName}`}
        subtitle={user?.tenantName || 'Your organization activity at a glance'}
        trailing={<Avatar name={user?.name || 'VSP'} size={56} />}
      />

      <View style={styles.statsGrid}>
        <StatCard label="Total Calls" value={stats?.callCount ?? '—'} accent="green" />
        <StatCard label="Numbers" value={stats?.numberCount ?? '—'} accent="blue" />
        <StatCard label="Unread VM" value={stats?.unreadVoicemailCount ?? '—'} accent="red" />
        <StatCard label="Unread SMS" value={stats?.unreadSmsCount ?? '—'} accent="indigo" />
        <StatCard label="Open Orders" value={stats?.pendingOrdersCount ?? '—'} accent="orange" />
        <StatCard label="Platform" value="Live" accent="green" hint="Connected" />
      </View>

      <VspPanel padded={false}>
        <View style={{ padding: spacing.md }}>
          <VspSectionHeader title="Recent activity" />
        </View>
        {(stats?.recentCalls?.length ?? 0) === 0 ? (
          <ListItem title="No recent calls" subtitle="Activity will appear here" />
        ) : (
          stats?.recentCalls?.slice(0, 5).map((call) => (
            <ListItem
              key={call.id}
              title={call.direction === 'inbound' ? call.from : call.to}
              subtitle={`${call.status} · ${formatRelativeTime(call.createdAt)}`}
            />
          ))
        )}
      </VspPanel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
