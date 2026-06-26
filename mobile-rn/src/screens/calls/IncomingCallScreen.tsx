import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, VspBadge, VspIconButton } from '../../components';
import type { CallSessionSnapshot } from '../../store/callingStore';
import { answerIncomingCall, declineIncomingCall } from '../../calling/callingController';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = {
  session: CallSessionSnapshot;
};

export function IncomingCallScreen({ session }: Props) {
  const { colors } = useTheme();
  const { identity } = session;

  return (
    <LinearGradient
      colors={[colors.heroStart, colors.heroEnd, colors.background]}
      style={styles.container}
    >
      <View style={styles.top}>
        <VspBadge label="Incoming" tone="primary" />
        <Text style={styles.ringing}>Ringing…</Text>
      </View>

      <View style={styles.center}>
        <Avatar name={identity.name} size={96} />
        <Text style={styles.name}>{identity.name}</Text>
        <Text style={styles.number}>{identity.number}</Text>
      </View>

      <View style={styles.actions}>
        <VspIconButton
          icon="close-outline"
          label="Decline"
          variant="danger"
          size="lg"
          onPress={() => void declineIncomingCall()}
        />
        <VspIconButton
          icon="checkmark-outline"
          label="Accept"
          variant="success"
          size="lg"
          onPress={() => void answerIncomingCall()}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  top: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
  ringing: {
    ...typography.caption,
    color: '#e0e7ff',
  },
  center: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.title,
    color: '#fff',
    marginTop: spacing.md,
  },
  number: {
    ...typography.body,
    color: '#c7d2fe',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: spacing.xxl,
  },
});
