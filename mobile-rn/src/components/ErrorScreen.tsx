import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { useTheme } from '../shared/theme';
import { getFriendlyErrorMessage } from '../utils/friendlyError';
import { spacing, typography } from '../shared/theme';

type ErrorScreenProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorScreen({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorScreenProps) {
  const { colors } = useTheme();

  const friendly = getFriendlyErrorMessage(message);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.icon, { color: colors.primary }]}>!</Text>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>{friendly}</Text>
      {onRetry ? <Button label="Try again" onPress={onRetry} style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  icon: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
    minWidth: 160,
  },
});
