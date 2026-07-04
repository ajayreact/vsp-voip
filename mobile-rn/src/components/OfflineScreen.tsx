import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { useTheme } from '../shared/theme';
import { scaleTextStyle, typography } from '../shared/theme/typography';
import { spacing } from '../shared/theme';

type OfflineScreenProps = {
  onRetry?: () => void;
};

export function OfflineScreen({ onRetry }: OfflineScreenProps) {
  const { colors, fontScale } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      accessibilityRole="alert"
      accessibilityLabel="You are offline. Check your network connection and try again."
    >
      <Text style={[styles.icon, { color: colors.warning }]} accessibilityElementsHidden importantForAccessibility="no">
        📡
      </Text>
      <Text style={[styles.title, { color: colors.text }, scaleTextStyle(typography.title, fontScale)]} accessibilityRole="header">
        You&apos;re offline
      </Text>
      <Text style={[styles.message, { color: colors.textMuted }, scaleTextStyle(typography.body, fontScale)]}>
        Check your network connection and try again.
      </Text>
      {onRetry ? (
        <Button
          label="Retry"
          accessibilityHint="Checks your network connection again"
          onPress={onRetry}
          style={styles.button}
        />
      ) : null}
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
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
    minWidth: 160,
  },
});
