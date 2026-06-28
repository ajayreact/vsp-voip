import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VspPanel } from '../../components';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

export function NotificationsCenterScreen() {
  const { colors } = useTheme();
  const stats = useAppStore((s) => s.dashboardStats);

  const items = useMemo(
    () => [
      {
        icon: 'call-outline' as const,
        title: 'Missed calls',
        count: stats?.recentCalls?.filter((c) => c.status?.toLowerCase().includes('miss')).length ?? 0,
      },
      {
        icon: 'recording-outline' as const,
        title: 'Voicemails',
        count: stats?.unreadVoicemailCount ?? 0,
      },
      {
        icon: 'chatbubble-ellipses-outline' as const,
        title: 'SMS messages',
        count: stats?.unreadSmsCount ?? 0,
      },
    ],
    [stats?.recentCalls, stats?.unreadSmsCount, stats?.unreadVoicemailCount],
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {items.map((item) => (
        <VspPanel key={item.title} style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={item.icon} size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.sub, { color: colors.textMuted }]}>
                {item.count > 0 ? `${item.count} unread` : 'All caught up'}
              </Text>
            </View>
            {item.count > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.white, fontWeight: '700' }}>{item.count}</Text>
              </View>
            ) : null}
          </View>
        </VspPanel>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm },
  card: { marginBottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.bodyMedium },
  sub: { ...typography.caption, marginTop: 2 },
  badge: { minWidth: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
