import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { useTheme } from '../shared/theme';
import { scaleTextStyle, typography } from '../shared/theme/typography';
import { spacing } from '../shared/theme';

type SessionExpiredScreenProps = {
  onSignIn: () => void;
};

export function SessionExpiredScreen({ onSignIn }: SessionExpiredScreenProps) {
  const { colors, fontScale } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      accessibilityLabel="Session expired. Your sign-in session has ended. Please sign in again to continue."
    >
      <Text style={[styles.icon, { color: colors.warning }]} accessibilityElementsHidden importantForAccessibility="no">
        🔒
      </Text>
      <Text style={[styles.title, { color: colors.text }, scaleTextStyle(typography.title, fontScale)]} accessibilityRole="header">
        Session expired
      </Text>
      <Text style={[styles.message, { color: colors.textMuted }, scaleTextStyle(typography.body, fontScale)]}>
        Your sign-in session has ended. Please sign in again to continue.
      </Text>
      <Button
        label="Sign in"
        accessibilityHint="Opens the sign-in screen"
        onPress={onSignIn}
        style={styles.button}
      />
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
