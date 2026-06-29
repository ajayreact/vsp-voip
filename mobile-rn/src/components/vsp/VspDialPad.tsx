import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../shared/theme';
import { dialPadHaptic } from '../../lib/haptics';
import { spacing, typography } from '../../shared/theme';

type VspDialKeyProps = {
  digit: string;
  subLabel?: string;
  onPress: (digit: string) => void;
  onLongPress?: (digit: string) => void;
  variant?: 'default' | 'iphone';
};

export function VspDialKey({
  digit,
  subLabel,
  onPress,
  onLongPress,
  variant = 'default',
}: VspDialKeyProps) {
  const { colors } = useTheme();
  const isIphone = variant === 'iphone';

  return (
    <Pressable
      onPress={() => onPress(digit)}
      onLongPress={onLongPress ? () => onLongPress(digit) : undefined}
      delayLongPress={400}
      style={({ pressed }) => [
        isIphone ? styles.iphoneKey : styles.key,
        {
          backgroundColor: pressed
            ? isIphone
              ? '#E5E5EA'
              : colors.primarySoft
            : isIphone
              ? '#F2F2F7'
              : colors.surface,
          borderColor: isIphone ? 'transparent' : colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Dial ${digit}`}
    >
      <Text style={[isIphone ? styles.iphoneDigit : styles.digit, { color: colors.text }]}>
        {digit}
      </Text>
      {subLabel ? (
        <Text style={[isIphone ? styles.iphoneSub : styles.sub, { color: colors.textMuted }]}>
          {subLabel}
        </Text>
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
  variant?: 'default' | 'iphone';
  enableHaptics?: boolean;
};

export function VspDialPad({ onDigit, variant = 'default', enableHaptics = true }: VspDialPadProps) {
  const isIphone = variant === 'iphone';

  const handleDigit = (digit: string) => {
    if (enableHaptics) dialPadHaptic();
    onDigit(digit);
  };

  return (
    <View style={isIphone ? styles.iphonePad : styles.pad}>
      {DIAL_ROWS.map((row, ri) => (
        <View key={ri} style={isIphone ? styles.iphoneRow : styles.row}>
          {row.map((key) => (
            <VspDialKey
              key={key.digit}
              digit={key.digit}
              subLabel={key.sub || undefined}
              onPress={handleDigit}
              onLongPress={key.digit === '0' ? () => handleDigit('+') : undefined}
              variant={variant}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const IPHONE_KEY = 78;

const styles = StyleSheet.create({
  pad: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  iphonePad: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  iphoneRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iphoneKey: {
    width: IPHONE_KEY,
    height: IPHONE_KEY,
    borderRadius: IPHONE_KEY / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    ...typography.mono,
    fontSize: 26,
    letterSpacing: 0,
  },
  iphoneDigit: {
    fontSize: 32,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  sub: {
    ...typography.caption,
    fontSize: 10,
    marginTop: 2,
  },
  iphoneSub: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 2,
  },
  subSpacer: {
    height: 14,
  },
  display: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 18,
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
