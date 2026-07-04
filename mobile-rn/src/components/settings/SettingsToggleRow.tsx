import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  last?: boolean;
};

export function SettingsToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
  last,
}: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: colors.border },
        last ? styles.lastRow : null,
      ]}
    >
      <View style={styles.textWrap}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.desc, { color: colors.textMuted }]}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    minHeight: 56,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  textWrap: { flex: 1 },
  label: { ...typography.bodyMedium, fontWeight: '600' },
  desc: { ...typography.caption, marginTop: 2 },
});
