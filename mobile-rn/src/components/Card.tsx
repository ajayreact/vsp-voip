import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../shared/theme';
import { spacing, typography } from '../shared/theme';

type StatCardProps = {
  label: string;
  value: string | number;
  accent?: 'blue' | 'green' | 'orange' | 'red' | 'indigo';
  hint?: string;
};

const accentMap = {
  green: 'success',
  blue: 'primary',
  orange: 'warning',
  red: 'error',
  indigo: 'primary',
} as const;

export function StatCard({ label, value, accent = 'blue', hint }: StatCardProps) {
  const { colors } = useTheme();
  const accentColor = colors[accentMap[accent]];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      {hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

type ListItemProps = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  left?: ReactNode;
};

export function ListItem({ title, subtitle, onPress, right, left }: ListItemProps) {
  const { colors } = useTheme();
  const content = (
    <>
      {left}
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: colors.border, backgroundColor: pressed ? colors.backgroundAlt : colors.surface },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.row, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      {content}
    </View>
  );
}

type EmptyStateProps = {
  title: string;
  message: string;
  icon?: string;
};

export function EmptyState({ title, message, icon = '📭' }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
  },
  hint: {
    ...typography.caption,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    ...typography.subtitle,
    textAlign: 'center',
  },
  emptyMessage: {
    ...typography.body,
    textAlign: 'center',
  },
});
