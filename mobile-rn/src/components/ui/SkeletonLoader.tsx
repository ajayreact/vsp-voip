import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../shared/theme';
import { MOTION } from '../../lib/animations';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { spacing, tokens } from '../../shared/theme';

const SkeletonPulseContext = createContext<SharedValue<number> | null>(null);

function SkeletonPulseProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0.45);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(1, { duration: MOTION.skeletonPulseMs }), -1, true);
  }, [opacity, reduceMotion]);

  return (
    <SkeletonPulseContext.Provider value={opacity}>{children}</SkeletonPulseContext.Provider>
  );
}

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height = 16, borderRadius = tokens.radius.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const sharedPulse = useContext(SkeletonPulseContext);
  const localOpacity = useSharedValue(reduceMotion ? 1 : 0.45);

  useEffect(() => {
    if (sharedPulse || reduceMotion) return;
    localOpacity.value = withRepeat(withTiming(1, { duration: MOTION.skeletonPulseMs }), -1, true);
  }, [localOpacity, reduceMotion, sharedPulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: sharedPulse ? sharedPulse.value : localOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  const { colors } = useTheme();
  return (
    <SkeletonPulseProvider>
      <View style={[styles.list, { backgroundColor: colors.background }]}>
        {Array.from({ length: rows }).map((_, i) => (
          <View key={i} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Skeleton width={52} height={52} borderRadius={26} />
            <View style={styles.rowText}>
              <Skeleton width="55%" height={14} />
              <Skeleton width="35%" height={12} style={{ marginTop: spacing.sm }} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonPulseProvider>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <SkeletonPulseProvider>
      <View style={styles.cards}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} height={88} borderRadius={tokens.radius.lg} style={{ flex: 1 }} />
        ))}
      </View>
    </SkeletonPulseProvider>
  );
}

export function SkeletonContactDetail() {
  const { colors } = useTheme();
  return (
    <SkeletonPulseProvider>
      <View style={[styles.detail, { backgroundColor: colors.background }]}>
        <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Skeleton width={72} height={72} borderRadius={36} />
          <Skeleton width="55%" height={18} style={{ marginTop: spacing.md }} />
          <Skeleton width="40%" height={14} style={{ marginTop: spacing.sm }} />
          <Skeleton height={48} borderRadius={14} style={{ marginTop: spacing.lg, width: '100%' }} />
        </View>
        <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.detailRow}>
              <Skeleton width="30%" height={12} />
              <Skeleton width="50%" height={12} />
            </View>
          ))}
        </View>
      </View>
    </SkeletonPulseProvider>
  );
}

export function SkeletonProfile() {
  return <SkeletonContactDetail />;
}

export function SkeletonThread() {
  const { colors } = useTheme();
  return (
    <SkeletonPulseProvider>
      <View style={[styles.thread, { backgroundColor: colors.background }]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              i % 2 === 0 ? styles.bubbleIn : styles.bubbleOut,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Skeleton width={i % 2 === 0 ? '70%' : '55%'} height={14} />
            <Skeleton width="35%" height={10} style={{ marginTop: spacing.sm }} />
          </View>
        ))}
      </View>
    </SkeletonPulseProvider>
  );
}

export function SkeletonAttachmentsGrid() {
  const { colors } = useTheme();
  return (
    <SkeletonPulseProvider>
      <View style={[styles.attachments, { backgroundColor: colors.background }]}>
        <Skeleton width="50%" height={18} />
        <View style={styles.attachGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={120} borderRadius={tokens.radius.lg} style={{ flex: 1 }} />
          ))}
        </View>
      </View>
    </SkeletonPulseProvider>
  );
}

export function SkeletonVoicemailDetail() {
  const { colors } = useTheme();
  return (
    <SkeletonPulseProvider>
      <View style={[styles.detail, { backgroundColor: colors.background }]}>
        <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Skeleton width="45%" height={16} />
          <Skeleton width="30%" height={12} style={{ marginTop: spacing.sm }} />
          <Skeleton height={56} borderRadius={14} style={{ marginTop: spacing.lg }} />
        </View>
      </View>
    </SkeletonPulseProvider>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
  },
  rowText: { flex: 1 },
  cards: { flexDirection: 'row', gap: spacing.sm },
  detail: { flex: 1, padding: spacing.lg, gap: spacing.md },
  detailCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.sm,
  },
  thread: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  bubble: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    padding: spacing.md,
    maxWidth: '78%',
  },
  bubbleIn: { alignSelf: 'flex-start' },
  bubbleOut: { alignSelf: 'flex-end' },
  attachments: { flex: 1, padding: spacing.lg, gap: spacing.md },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
