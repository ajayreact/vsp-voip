import React, { ReactNode, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MOTION } from '../../lib/animations';
import { useReducedMotion } from '../../hooks/useReducedMotion';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  delay?: number;
};

export function FadeInView({ children, style, duration = MOTION.fadeMs, delay = 0 }: Props) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    const timer = setTimeout(() => {
      opacity.value = withTiming(1, { duration });
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, duration, opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
