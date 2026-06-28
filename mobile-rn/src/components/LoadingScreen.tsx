import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../shared/theme';
import { spacing, typography } from '../shared/theme';

type LoadingScreenProps = {
  message?: string;
};

export function LoadingScreen({ message = 'Loading…' }: LoadingScreenProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  message: {
    ...typography.body,
  },
});
