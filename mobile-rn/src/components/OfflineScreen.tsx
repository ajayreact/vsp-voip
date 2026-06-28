import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { useTheme } from '../shared/theme';
import { spacing, typography } from '../shared/theme';

type OfflineScreenProps = {
  onRetry?: () => void;
};

export function OfflineScreen({ onRetry }: OfflineScreenProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.icon, { color: colors.warning }]}>📡</Text>
      <Text style={[styles.title, { color: colors.text }]}>You&apos;re offline</Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>
        Check your network connection and try again.
      </Text>
      {onRetry ? <Button label="Retry" onPress={onRetry} style={styles.button} /> : null}
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
