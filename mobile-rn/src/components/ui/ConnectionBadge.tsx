import React, { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../shared/theme';
import { spacing, tokens, typography } from '../../shared/theme';

type Props = {
  connected: boolean;
  label?: string;
};

function ConnectionBadgeComponent({ connected, label }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  const tone = connected ? colors.primary : colors.warning;
  const text = label ?? (connected ? 'Connected' : 'Connecting…');

  useEffect(() => {
    if (connected || reduceMotion) {
      pulse.value = withTiming(1, { duration: 120 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(withTiming(0.55, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false,
    );
  }, [connected, pulse, reduceMotion]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={[styles.wrap, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
      <Animated.View style={[styles.dot, { backgroundColor: tone }, dotStyle]} />
      <Ionicons name={connected ? 'checkmark-circle' : 'sync-outline'} size={16} color={tone} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

export const ConnectionBadge = memo(ConnectionBadgeComponent);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { ...typography.caption, fontWeight: '600' },
});
