import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning' | 'error';
};

export function SettingsStatusRow({ label, value, tone = 'default' }: Props) {
  const { colors } = useTheme();
  const valueColor =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'error'
          ? colors.error
          : colors.text;

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  label: { ...typography.body, flex: 1 },
  value: { ...typography.bodyMedium, fontWeight: '600', flex: 1, textAlign: 'right' },
});
