import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { VspConnectionState } from '../calling/vspTelephonyState';
import { useAppStore } from '../store/appStore';
import { useCallingStore } from '../store/callingStore';
import { useTheme } from '../shared/theme';
import { spacing, typography } from '../shared/theme';

const RECOVERY_DISMISS_MS = 3000;

export function NetworkStatusBanner() {
  const { colors } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const networkRecovery = useAppStore((s) => s.networkRecovery);
  const clearNetworkRecovery = useAppStore((s) => s.clearNetworkRecovery);
  const setOnline = useAppStore((s) => s.setOnline);
  const hasLiveCall = useCallingStore((s) => Boolean(s.activeCall || s.incomingCall));
  const connectionState = useCallingStore((s) => s.connectionState);

  useEffect(() => {
    if (networkRecovery !== 'connected') return undefined;
    const timer = setTimeout(clearNetworkRecovery, RECOVERY_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [clearNetworkRecovery, networkRecovery]);

  if (networkRecovery === 'connected') {
    return (
      <View
        style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.primary }]}
        accessibilityRole="alert"
      >
        <Text style={[styles.text, { color: colors.primary }]}>Connected</Text>
      </View>
    );
  }

  if (isOnline && connectionState !== VspConnectionState.RECONNECTING) return null;

  const message = !isOnline
    ? hasLiveCall
      ? 'Offline — your call may recover when the network returns.'
      : 'Offline'
    : 'Reconnecting…';

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
