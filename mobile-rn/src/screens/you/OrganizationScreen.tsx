import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { VspPanel } from '../../components';
import { FriendlyError } from '../../components/ui/FriendlyError';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { fetchTenantProfile } from '../../settings';
import { useTheme } from '../../shared/theme';
import { getFriendlyErrorMessage } from '../../utils/friendlyError';
import { spacing, typography } from '../../shared/theme';

export function OrganizationScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<Awaited<ReturnType<typeof fetchTenantProfile>> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setOrg(await fetchTenantProfile());
      } catch (err) {
        setError(getFriendlyErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <SkeletonList rows={3} />;
  if (error) return <FriendlyError message={error} onRetry={() => setLoading(true)} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <VspPanel>
        <Text style={[styles.label, { color: colors.textMuted }]}>Organization</Text>
        <Text style={[styles.value, { color: colors.text }]}>{org?.name}</Text>
        <Text style={[styles.label, { color: colors.textMuted, marginTop: spacing.md }]}>Contact email</Text>
        <Text style={[styles.value, { color: colors.text }]}>{org?.contactEmail}</Text>
        <Text style={[styles.label, { color: colors.textMuted, marginTop: spacing.md }]}>Timezone</Text>
        <Text style={[styles.value, { color: colors.text }]}>{org?.timezone}</Text>
      </VspPanel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  label: { ...typography.caption },
  value: { ...typography.bodyMedium, marginTop: 4 },
});
