import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../Button';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = {
  message: string;
  tone?: 'error' | 'offline' | 'info' | 'warning';
  onRetry?: () => void;
  onDismiss?: () => void;
};

export function MessagingStateBanner({ message, tone = 'info', onRetry, onDismiss }: Props) {
  const { colors } = useTheme();
  const palette = {
    error: { bg: colors.errorSoft, fg: colors.error, border: colors.error },
    offline: { bg: colors.warningSoft, fg: colors.warning, border: colors.warning },
    warning: { bg: colors.warningSoft, fg: colors.warning, border: colors.warning },
    info: { bg: colors.primarySoft, fg: colors.primary, border: colors.primary },
  }[tone];

  return (
    <View
      style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}
      accessibilityRole="alert"
    >
      <Text style={[styles.text, { color: palette.fg }]}>{message}</Text>
      <View style={styles.actions}>
        {onRetry ? <Button label="Retry" variant="ghost" onPress={onRetry} /> : null}
        {onDismiss ? <Button label="Dismiss" variant="ghost" onPress={onDismiss} /> : null}
      </View>
    </View>
  );
}

export function MessageDateSeparator({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.separatorRow} accessibilityRole="text">
      <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
      <Text style={[styles.separatorLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  separatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  separatorLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
});
