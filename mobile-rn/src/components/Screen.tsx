import React, { ReactNode } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../shared/theme';
import { spacing } from '../shared/theme/spacing';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  padded?: boolean;
};

export function Screen({ children, scroll = false, style, padded = true }: ScreenProps) {
  const { colors } = useTheme();
  const contentStyle = [
    padded ? styles.container : styles.containerFlush,
    { backgroundColor: colors.background },
    style,
  ];

  if (scroll) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={contentStyle}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  containerFlush: {
    flex: 1,
  },
});
