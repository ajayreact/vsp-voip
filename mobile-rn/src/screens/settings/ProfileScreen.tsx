import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, ErrorScreen } from '../../components';
import { SkeletonProfile } from '../../components/ui/SkeletonLoader';
import { FadeInView } from '../../components/ui/FadeInView';
import { useAuth } from '../../hooks/useAuth';
import { fetchTenantProfile } from '../../settings';
import type { TenantProfile } from '../../api/types';
import { useTheme } from '../../shared/theme';
import { roleLabel } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const { colors } = useTheme();
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshUser();
      const tenantProfile = await fetchTenantProfile();
      setProfile(tenantProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <SkeletonProfile />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  return (
    <FadeInView style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Avatar name={user?.name || 'User'} size={72} />
        <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
        <Text style={[styles.email, { color: colors.textMuted }]}>{user?.email}</Text>
        <Text style={[styles.role, { color: colors.primary }]}>
          {user?.role ? roleLabel(user.role) : 'User'}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
        <Row label="User ID" value={user?.id?.slice(0, 8) + '…' || '—'} />
        <Row label="Email" value={user?.email || '—'} />
        <Row label="Role" value={user?.role ? roleLabel(user.role) : '—'} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Organization</Text>
        <Row label="Company" value={profile?.name || user?.tenantName || '—'} />
        <Row label="Contact email" value={profile?.contactEmail || user?.tenantContactEmail || '—'} />
        <Row label="Timezone" value={profile?.timezone || user?.tenantTimezone || '—'} />
      </View>
    </ScrollView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  hero: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: { ...typography.title, marginTop: spacing.sm },
  email: { ...typography.body },
  role: { ...typography.caption, fontWeight: '600' },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  label: { ...typography.body, flex: 1 },
  value: { ...typography.body, fontWeight: '600', flex: 1, textAlign: 'right' },
});
