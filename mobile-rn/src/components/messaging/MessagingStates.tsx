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

type NewMessagesProps = {
  count: number;
  onPress: () => void;
};

export function NewMessagesBanner({ count, onPress }: NewMessagesProps) {
  const { colors } = useTheme();
  if (count <= 0) return null;

  const label = count === 1 ? '1 new message' : `${count} new messages`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Tap to scroll to newest messages.`}
      style={[styles.newMessages, { backgroundColor: colors.primary, shadowColor: colors.text }]}
    >
      <Text style={styles.newMessagesText}>{label}</Text>
    </Pressable>
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
  newMessages: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    zIndex: 2,
    elevation: 4,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  newMessagesText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
  },
});
