import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../shared/theme';
import { spacing, tokens, typography } from '../../shared/theme';

type VspDialKeyProps = {
  digit: string;
  subLabel?: string;
  onPress: (digit: string) => void;
  wide?: boolean;
};

/**
 * VSP dial pad key — rounded square grid, not iPhone circular keys.
 */
export function VspDialKey({ digit, subLabel, onPress, wide }: VspDialKeyProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => onPress(digit)}
      style={({ pressed }) => [
        styles.key,
        wide && styles.keyWide,
        {
          backgroundColor: pressed ? colors.primarySoft : colors.surface,
          borderColor: colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Dial ${digit}`}
    >
      <Text style={[styles.digit, { color: colors.text }]}>{digit}</Text>
      {subLabel ? (
        <Text style={[styles.sub, { color: colors.textMuted }]}>{subLabel}</Text>
      ) : (
        <View style={styles.subSpacer} />
      )}
    </Pressable>
  );
}

type VspDialDisplayProps = {
  value: string;
  hint?: string;
};

export function VspDialDisplay({ value, hint }: VspDialDisplayProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.display, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}>
      <Text style={[styles.displayText, { color: colors.text }]} numberOfLines={1}>
        {value || 'Enter number'}
      </Text>
      {hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const DIAL_ROWS: { digit: string; sub?: string }[][] = [
  [{ digit: '1', sub: '' }, { digit: '2', sub: 'ABC' }, { digit: '3', sub: 'DEF' }],
  [{ digit: '4', sub: 'GHI' }, { digit: '5', sub: 'JKL' }, { digit: '6', sub: 'MNO' }],
  [{ digit: '7', sub: 'PQRS' }, { digit: '8', sub: 'TUV' }, { digit: '9', sub: 'WXYZ' }],
  [{ digit: '*', sub: '' }, { digit: '0', sub: '+' }, { digit: '#', sub: '' }],
];

type VspDialPadProps = {
  onDigit: (digit: string) => void;
};

export function VspDialPad({ onDigit }: VspDialPadProps) {
  return (
    <View style={styles.pad}>
      {DIAL_ROWS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((key) => (
            <VspDialKey
              key={key.digit}
              digit={key.digit}
              subLabel={key.sub || undefined}
              onPress={onDigit}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  key: {
    width: tokens.dialKey,
    height: tokens.dialKey,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyWide: {
    flex: 1,
    maxWidth: tokens.dialKey * 2 + spacing.sm,
  },
  digit: {
    ...typography.mono,
    fontSize: 26,
    letterSpacing: 0,
  },
  sub: {
    ...typography.caption,
    fontSize: 10,
    marginTop: 2,
  },
  subSpacer: {
    height: 14,
  },
  display: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    minHeight: 88,
    justifyContent: 'center',
  },
  displayText: {
    ...typography.mono,
    fontSize: 32,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});
