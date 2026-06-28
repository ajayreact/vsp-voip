import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { VspPanel } from '../../components';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import { fetchDashboardStats } from '../../dashboard';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

export function NumbersScreen() {
  const { colors } = useTheme();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetchDashboardStats()
      .then((s) => setCount(s.numberCount ?? 0))
      .catch(() => setCount(0));
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <VspPanel>
        <Text style={[styles.label, { color: colors.textMuted }]}>Active numbers</Text>
        {count === null ? (
          <Skeleton width={80} height={32} style={{ marginTop: spacing.sm }} />
        ) : (
          <Text style={[styles.value, { color: colors.text }]}>{count}</Text>
        )}
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Manage numbers in the VSP portal. Assigned DIDs appear in your call settings.
        </Text>
      </VspPanel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  label: { ...typography.caption },
  value: { ...typography.title, marginTop: spacing.sm },
  hint: { ...typography.body, marginTop: spacing.md },
});
