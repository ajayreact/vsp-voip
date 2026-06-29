import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Avatar } from '../../components';
import { CallControlButton } from '../../components/calls';
import { VspBadge } from '../../components/vsp/VspBadge';
import type { CallSessionSnapshot } from '../../store/callingStore';
import { answerIncomingCall, declineIncomingCall } from '../../calling/callingController';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../shared/theme';
import { formatPhone } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

type Props = {
  session: CallSessionSnapshot;
};

export const IncomingCallScreen = React.memo(function IncomingCallScreen({ session }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const { identity } = session;
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      false,
    );
  }, [pulse, reduceMotion]);

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.14 + (pulse.value - 1) * 1.6,
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View entering={FadeInDown.duration(280)} style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>Incoming call</Text>
        <Text style={[styles.ringing, { color: colors.textMuted }]}>Ringing…</Text>

        <View style={styles.avatarWrap}>
          <Animated.View style={[styles.ripple, rippleStyle, { backgroundColor: colors.primary }]} />
          <Avatar name={identity.name} size={112} />
        </View>

        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {identity.name}
        </Text>
        {identity.company ? (
          <Text style={[styles.company, { color: colors.textMuted }]} numberOfLines={1}>
            {identity.company}
          </Text>
        ) : null}
        <Text style={[styles.number, { color: colors.textSecondary }]} numberOfLines={1}>
          {identity.number}
        </Text>
        {identity.businessLine ? (
          <Text style={[styles.line, { color: colors.primary }]} numberOfLines={1}>
            via {formatPhone(identity.businessLine)}
          </Text>
        ) : null}

        <View style={styles.badges}>
          <VspBadge label="HD Voice" tone="muted" />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(320).delay(80)} style={styles.actions}>
        <CallControlButton
          icon="close"
          label="Decline"
          variant="danger"
          size="lg"
          onPress={() => void declineIncomingCall()}
        />
        <CallControlButton
          icon="call"
          label="Accept"
          variant="success"
          size="lg"
          onPress={() => void answerIncomingCall()}
        />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    justifyContent: 'space-between',
  },
  header: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxl,
  },
  eyebrow: {
    ...typography.bodyMedium,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ringing: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    height: 160,
    marginBottom: spacing.md,
  },
  ripple: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  name: {
    ...typography.title,
    textAlign: 'center',
  },
  company: {
    ...typography.bodyMedium,
    textAlign: 'center',
  },
  number: {
    ...typography.body,
    textAlign: 'center',
  },
  line: {
    ...typography.caption,
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: spacing.xl,
  },
});
