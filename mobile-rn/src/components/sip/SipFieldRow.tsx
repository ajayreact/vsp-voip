import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = {
  label: string;
  tooltip?: string;
  onTooltipPress?: () => void;
  children: React.ReactNode;
  error?: string | null;
};

export function SipFieldRow({ label, tooltip, onTooltipPress, children, error }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        {tooltip ? (
          <Pressable onPress={onTooltipPress} hitSlop={8} accessibilityLabel={`Help: ${label}`}>
            <Ionicons name="help-circle-outline" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {children}
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...typography.caption, fontWeight: '600' },
  error: { ...typography.caption },
});
