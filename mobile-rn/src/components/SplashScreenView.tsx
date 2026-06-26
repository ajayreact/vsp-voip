import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useTheme } from '../shared/theme';
import { spacing, tokens, typography } from '../shared/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

type SplashScreenViewProps = {
  onReady?: () => void;
};

export function SplashScreenView({ onReady }: SplashScreenViewProps) {
  const { colors } = useTheme();

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.heroStart, colors.heroMid, colors.heroEnd]}
        style={[styles.logo, tokens.shadow.hero]}
      >
        <Text style={styles.logoText}>VSP</Text>
      </LinearGradient>
      <Text style={[styles.title, { color: colors.text }]}>VSP Phone</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Enterprise cloud communications</Text>
    </View>
  );
}

export async function hideSplashScreen() {
  await SplashScreen.hideAsync();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoText: {
    ...typography.title,
    color: '#fff',
    fontWeight: '800',
  },
  title: {
    ...typography.title,
    fontSize: 28,
  },
  subtitle: {
    ...typography.body,
  },
});
