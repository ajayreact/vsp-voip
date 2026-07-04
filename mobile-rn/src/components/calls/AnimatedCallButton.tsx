import React, { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../shared/theme';
import { callSuccessHaptic } from '../../lib/haptics';
import { spacing, typography } from '../../shared/theme';

type Props = {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const AnimatedDialCallButton = memo(function AnimatedDialCallButton({
  onPress,
  disabled,
  loading,
}: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    if (disabled || loading || reduceMotion) {
      pulse.value = withTiming(1, { duration: 120 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(withTiming(1.04, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      false,
    );
  }, [disabled, loading, pulse, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulse.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => {
        if (disabled || loading) return;
        callSuccessHaptic();
        onPress();
      }}
      onPressIn={() => {
        scale.value = withSpring(0.94, { damping: 16, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 280 });
      }}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel="Place call"
      style={[
        animatedStyle,
        styles.button,
        {
          backgroundColor: disabled ? colors.textMuted : colors.primary,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Ionicons name="call" size={30} color="#fff" />
      )}
    </AnimatedPressable>
  );
});

type DeleteProps = {
  visible: boolean;
  onPress: () => void;
};

export const AnimatedDeleteButton = memo(function AnimatedDeleteButton({ visible, onPress }: DeleteProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(visible ? 1 : 0);

  React.useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 160 });
  }, [opacity, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: 0.92 + opacity.value * 0.08 }],
  }));

  if (!visible) return <View style={styles.deleteSpacer} />;

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Delete digit"
      style={[animatedStyle, styles.deleteBtn]}
    >
      <Ionicons name="backspace-outline" size={28} color={colors.textMuted} />
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  button: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    padding: spacing.xs,
  },
  deleteSpacer: {
    width: 36,
    height: 36,
  },
});
