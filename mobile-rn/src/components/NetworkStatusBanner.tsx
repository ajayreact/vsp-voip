import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { TelnyxConnectionState } from '@telnyx/react-voice-commons-sdk';
import { useAppStore } from '../store/appStore';
import { useCallingStore } from '../store/callingStore';
import { useTheme } from '../shared/theme';
import { spacing, typography } from '../shared/theme';

export function NetworkStatusBanner() {
  const { colors } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const setOnline = useAppStore((s) => s.setOnline);
  const hasLiveCall = useCallingStore((s) => Boolean(s.activeCall || s.incomingCall));
  const connectionState = useCallingStore((s) => s.connectionState);

  if (isOnline && connectionState !== TelnyxConnectionState.RECONNECTING) return null;

  const message = !isOnline
    ? hasLiveCall
      ? 'Network interrupted — call may recover when connectivity returns.'
      : 'You are offline. Calls resume when connectivity returns.'
    : 'Reconnecting to Telnyx…';

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}
      accessibilityRole="alert"
    >
      <Text style={[styles.text, { color: colors.warning }]}>{message}</Text>
      {!isOnline ? (
        <Pressable
          onPress={() => NetInfo.fetch().then((s) => setOnline(Boolean(s.isConnected)))}
          accessibilityRole="button"
          accessibilityLabel="Retry network connection"
        >
          <Text style={[styles.action, { color: colors.primary }]}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderBottomWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  text: {
    ...typography.caption,
    flex: 1,
    fontWeight: '600',
  },
  action: {
    ...typography.caption,
    fontWeight: '700',
  },
});
