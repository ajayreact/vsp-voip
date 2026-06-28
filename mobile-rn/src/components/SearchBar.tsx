import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { MOTION } from '../lib/animations';
import { useTheme } from '../shared/theme';
import { spacing, typography } from '../shared/theme';

type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  accessibilityLabel?: string;
};

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  autoFocus,
  accessibilityLabel,
}: SearchBarProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const scale = useSharedValue(1);

  const onFocus = () => {
    setFocused(true);
    if (!reduceMotion) {
      scale.value = withTiming(1.01, { duration: MOTION.pressInMs });
    }
  };

  const onBlur = () => {
    setFocused(false);
    if (!reduceMotion) {
      scale.value = withTiming(1, { duration: MOTION.pressOutMs });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.wrap,
        animatedStyle,
        {
          backgroundColor: colors.backgroundAlt,
          borderColor: focused ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.icon, { color: colors.textMuted }]}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text }]}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onBlur={onBlur}
        accessibilityLabel={accessibilityLabel || placeholder}
        clearButtonMode="while-editing"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  icon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.sm,
  },
});
