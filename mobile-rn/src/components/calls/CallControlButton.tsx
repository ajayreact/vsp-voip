import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../shared/theme';
import { callActionHaptic } from '../../lib/haptics';
import { spacing, tokens, typography } from '../../shared/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  active?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'md' | 'lg';
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const CallControlButton = memo(function CallControlButton({
  icon,
  label,
  onPress,
  active = false,
  disabled = false,
  variant = 'secondary',
  size = 'md',
}: Props) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const dim = size === 'lg' ? 68 : 60;

  const palette = {
    primary: { bg: colors.primary, fg: colors.white, activeBg: colors.primarySoft, activeFg: colors.primary },
    secondary: { bg: colors.surfaceElevated, fg: colors.text, activeBg: colors.primarySoft, activeFg: colors.primary },
    danger: { bg: colors.error, fg: colors.white, activeBg: colors.errorSoft, activeFg: colors.error },
    success: { bg: colors.success, fg: colors.white, activeBg: colors.successSoft, activeFg: colors.success },
  }[variant];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.wrap}>
      <AnimatedPressable
        onPress={() => {
          if (disabled) return;
          callActionHaptic();
          onPress?.();
        }}
        onPressIn={() => {
          scale.value = withSpring(0.92, { damping: 16, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 280 });
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, selected: active }}
        style={[
          animatedStyle,
          styles.button,
          {
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            backgroundColor: active ? palette.activeBg : palette.bg,
            borderColor: active ? colors.primary : colors.border,
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        <Ionicons name={icon} size={size === 'lg' ? 28 : 24} color={active ? palette.activeFg : palette.fg} />
      </AnimatedPressable>
      <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 76,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...tokens.shadow.card,
  },
  label: {
    ...typography.caption,
    textAlign: 'center',
    fontWeight: '600',
  },
});
