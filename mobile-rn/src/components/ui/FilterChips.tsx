import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { RipplePressable } from './RipplePressable';
import { useTheme } from '../../shared/theme';
import { spacing, tokens, typography } from '../../shared/theme';

type FilterOption = { key: string; label: string };

type Props = {
  options: FilterOption[];
  value: string;
  onChange: (key: string) => void;
};

export function FilterChips({ options, value, onChange }: Props) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <RipplePressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.label, { color: active ? colors.white : colors.textSecondary }]}>
              {opt.label}
            </Text>
          </RipplePressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: tokens.touchTarget - 8,
    justifyContent: 'center',
  },
  label: { ...typography.caption, fontWeight: '600' },
});
