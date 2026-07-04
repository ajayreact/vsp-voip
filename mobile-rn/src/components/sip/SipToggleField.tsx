import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  subtitle?: string;
};

export function SipToggleField({ label, value, onChange, subtitle }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[styles.row, { borderBottomColor: colors.border }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={styles.textWrap}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primarySoft }}
        thumbColor={value ? colors.primary : colors.surface}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  textWrap: { flex: 1, gap: 2 },
  label: { ...typography.body },
  subtitle: { ...typography.caption },
});
