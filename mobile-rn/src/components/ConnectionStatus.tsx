import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/appStore';
import { useCallingStore } from '../store/callingStore';
import {
  getPhoneConnectionHint,
  type PhoneConnectionStatus,
  usePhoneConnection,
} from '../hooks/usePhoneConnection';
import { useTheme } from '../shared/theme';
import { spacing, typography } from '../shared/theme';

const RECOVERY_DISMISS_MS = 2500;

type BannerTone = 'success' | 'warning' | 'error' | 'neutral';

function resolveBannerTone(status: PhoneConnectionStatus): BannerTone {
  if (status === 'connected') return 'success';
  if (status === 'auth_failed' || status === 'network_offline') return 'error';
  if (status === 'disconnected') return 'warning';
  return 'neutral';
}

function resolveIcon(status: PhoneConnectionStatus): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case 'connected':
      return 'checkmark-circle';
    case 'network_offline':
      return 'cloud-offline-outline';
    case 'auth_failed':
      return 'alert-circle';
    case 'disconnected':
      return 'phone-portrait-outline';
    default:
      return 'sync-outline';
  }
}

type ConnectionStatusProps = {
  /** When false, hide the banner (e.g. login screen). */
  visible?: boolean;
  compact?: boolean;
};

export function ConnectionStatus({ visible = true, compact = false }: ConnectionStatusProps) {
  const { colors } = useTheme();
  const { status, label, hint } = usePhoneConnection();
  const networkRecovery = useAppStore((s) => s.networkRecovery);
  const clearNetworkRecovery = useAppStore((s) => s.clearNetworkRecovery);
  const setOnline = useAppStore((s) => s.setOnline);
  const hasLiveCall = useCallingStore((s) => Boolean(s.activeCall || s.incomingCall));

  useEffect(() => {
    if (networkRecovery !== 'connected') return undefined;
    const timer = setTimeout(clearNetworkRecovery, RECOVERY_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [clearNetworkRecovery, networkRecovery]);

  if (!visible) return null;

  if (networkRecovery === 'connected') {
    return (
      <View
        style={[styles.banner, { backgroundColor: colors.successSoft, borderColor: colors.primary }]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.primary }]}>Connected</Text>
      </View>
    );
  }

  if (status === 'connected') return null;

  const tone = resolveBannerTone(status);
  const palette = {
    success: { bg: colors.successSoft, border: colors.primary, text: colors.primary },
    warning: { bg: colors.warningSoft, border: colors.warning, text: colors.warning },
    error: { bg: colors.errorSoft, border: colors.error, text: colors.error },
    neutral: { bg: colors.backgroundAlt, border: colors.border, text: colors.text },
  }[tone];

  const showSpinner = status === 'connecting' || status === 'registering' || status === 'reconnecting';
  const message = hasLiveCall && status === 'network_offline'
    ? 'Offline — your call may recover when the network returns.'
    : hint ?? label;

  return (
    <View
      style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${label}. ${message}`}
    >
      {showSpinner ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : (
        <Ionicons name={resolveIcon(status)} size={18} color={palette.text} />
      )}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: palette.text }]}>{label}</Text>
        {!compact && message ? (
          <Text style={[styles.subtitle, { color: palette.text }]} numberOfLines={2}>
            {message}
          </Text>
        ) : null}
      </View>
      {status === 'network_offline' ? (
        <Pressable
          onPress={() => NetInfo.fetch().then((s) => setOnline(Boolean(s.isConnected)))}
          accessibilityRole="button"
          accessibilityLabel="Retry network connection"
          hitSlop={8}
        >
          <Text style={[styles.action, { color: colors.primary }]}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...typography.caption,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
    opacity: 0.9,
  },
  action: {
    ...typography.caption,
    fontWeight: '700',
  },
});
