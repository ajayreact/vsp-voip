import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components';
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.status, { color: colors.primary }]}>Incoming call</Text>
        <Text style={[styles.ringing, { color: colors.textMuted }]}>Ringing…</Text>
        <Avatar name={identity.name} size={96} />
        <Text style={[styles.name, { color: colors.text }]}>{identity.name}</Text>
        <Text style={[styles.number, { color: colors.textMuted }]}>{identity.number}</Text>
      </View>

      <View style={styles.actions}>
        <View style={styles.actionItem}>
          <Pressable
            onPress={() => void declineIncomingCall()}
            style={styles.declineButton}
            accessibilityRole="button"
            accessibilityLabel="Decline call"
          >
            <Ionicons name="close" size={32} color="#fff" />
          </Pressable>
          <Text style={[styles.actionLabel, { color: colors.textMuted }]}>Decline</Text>
        </View>
        <View style={styles.actionItem}>
          <Pressable
            onPress={() => void answerIncomingCall()}
            style={styles.acceptButton}
            accessibilityRole="button"
            accessibilityLabel="Accept call"
          >
            <Ionicons name="call" size={32} color="#fff" />
          </Pressable>
          <Text style={[styles.actionLabel, { color: colors.textMuted }]}>Accept</Text>
        </View>
      </View>
    </View>
  );
}

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
  status: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  ringing: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  name: {
    ...typography.title,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  number: {
    ...typography.body,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: spacing.xl,
  },
  actionItem: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  declineButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
});
