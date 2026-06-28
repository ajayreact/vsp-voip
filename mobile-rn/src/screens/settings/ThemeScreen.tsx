import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

export function ThemeScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Light theme</Text>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        VSP Phone uses a light theme with white backgrounds, blue accents, and high-contrast text for
        enterprise readability.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
  },
  intro: {
    ...typography.body,
  },
});
