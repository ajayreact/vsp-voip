import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { useTheme } from '../shared/theme';
import { spacing, typography } from '../shared/theme';

type BiometricUnlockScreenProps = {
  biometricLabel: string;
  error?: string | null;
  onUnlock: () => void;
  onUsePassword: () => void;
};

export function BiometricUnlockScreen({
  biometricLabel,
  error,
  onUnlock,
  onUsePassword,
}: BiometricUnlockScreenProps) {
  const { colors } = useTheme();
  const iconName = biometricLabel.includes('Face') ? 'scan-outline' : 'finger-print-outline';
  const promptedRef = useRef(false);

  useEffect(() => {
    if (promptedRef.current) return;
    promptedRef.current = true;
    void onUnlock();
  }, [onUnlock]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={iconName} size={40} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        Welcome back
      </Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>
        Use {biometricLabel} to unlock your session.
      </Text>

      {error ? (
        <View
          style={[styles.errorBox, { backgroundColor: colors.errorSoft, borderColor: colors.error }]}
          accessibilityRole="alert"
        >
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      ) : null}

      <Button
        label={`Unlock with ${biometricLabel}`}
        onPress={() => void onUnlock()}
        style={styles.primaryBtn}
      />
      <Button label="Use password instead" variant="ghost" onPress={() => void onUsePassword()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.sm,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
    width: '100%',
    maxWidth: 360,
  },
  errorText: {
    ...typography.caption,
    textAlign: 'center',
  },
  primaryBtn: {
    minWidth: 260,
    marginTop: spacing.sm,
  },
});
