import React, { memo, ReactNode } from 'react';
import { Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MOTION } from '../../lib/animations';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../shared/theme';

type Props = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  ripple?: boolean;
  scaleOnPress?: boolean;
};

export const RipplePressable = memo(function RipplePressable({
  children,
  style,
  ripple = true,
  scaleOnPress = true,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn: PressableProps['onPressIn'] = (event) => {
    if (scaleOnPress && !reduceMotion && !disabled) {
      scale.value = withTiming(MOTION.pressScale, { duration: MOTION.pressInMs });
    }
    onPressIn?.(event);
  };

  const handlePressOut: PressableProps['onPressOut'] = (event) => {
    if (scaleOnPress && !reduceMotion) {
      scale.value = withTiming(1, { duration: MOTION.pressOutMs });
    }
    onPressOut?.(event);
  };

  return (
    <Pressable
      android_ripple={
        ripple && Platform.OS === 'android' && !disabled
          ? { color: `${colors.primary}22`, borderless: false }
          : undefined
      }
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [
        style,
        Platform.OS === 'ios' && pressed && !disabled ? { opacity: 0.78 } : null,
      ]}
      {...rest}
    >
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </Pressable>
  );
});
