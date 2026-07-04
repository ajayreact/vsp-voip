import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TelnyxConnectionState } from '@telnyx/react-voice-commons-sdk';
import { useCallingStore } from '../../store/callingStore';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import { friendlySipError } from '../../sip/validation';
import type { SipConnectionSnapshot, SipProfile, SipTransport } from '../../sip/types';

type Props = {
  profile: SipProfile;
  registrationExpiryAt: number | null;
  lastRegistrationAt: number | null;
  roundTripLatencyMs: number | null;
};

function mapConnectionState(state: TelnyxConnectionState): SipConnectionSnapshot['status'] {
  switch (state) {
    case TelnyxConnectionState.CONNECTED:
      return 'registered';
    case TelnyxConnectionState.CONNECTING:
    case TelnyxConnectionState.RECONNECTING:
      return 'connecting';
    default:
      return 'not_registered';
  }
}

function statusMeta(status: SipConnectionSnapshot['status']) {
  switch (status) {
    case 'registered':
      return { emoji: '🟢', label: 'Registered', tone: 'success' as const };
    case 'connecting':
      return { emoji: '🟡', label: 'Connecting', tone: 'warning' as const };
    default:
      return { emoji: '🔴', label: 'Not Registered', tone: 'error' as const };
  }
}

function formatCountdown(expiryAt: number | null): string {
  if (!expiryAt) return '—';
  const remaining = Math.max(0, Math.floor((expiryAt - Date.now()) / 1000));
  if (remaining <= 0) return 'Expired';
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return `${mins}m ${secs}s`;
}

function formatTime(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function StatusRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export function SipConnectionStatus({
  profile,
  registrationExpiryAt,
  lastRegistrationAt,
  roundTripLatencyMs,
}: Props) {
  const { colors } = useTheme();
  const connectionState = useCallingStore((s) => s.connectionState);
  const registrationError = useCallingStore((s) => s.registrationError);
  const [, tick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const status = mapConnectionState(connectionState);
  const meta = statusMeta(status);
  const selectedCodec = profile.codecs.find((c) => c.enabled)?.label ?? '—';
  const toneColor = meta.tone === 'success'
    ? colors.primary
    : meta.tone === 'warning'
      ? colors.warning
      : colors.error;

  return (
    <View style={[styles.card, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
      <View style={styles.statusRow}>
        <Text style={styles.emoji}>{meta.emoji}</Text>
        <Text style={[styles.statusLabel, { color: toneColor }]}>{meta.label}</Text>
      </View>
      {registrationError && status !== 'registered' ? (
        <Text style={[styles.error, { color: colors.error }]}>
          {friendlySipError(registrationError)}
        </Text>
      ) : null}
      <StatusRow label="Registered Server" value={status === 'registered' ? profile.sipServer : '—'} />
      <StatusRow label="Public IP" value="—" />
      <StatusRow label="Transport" value={profile.transport as SipTransport} />
      <StatusRow label="Selected Codec" value={selectedCodec} />
      <StatusRow label="Registration Expiry" value={formatCountdown(registrationExpiryAt)} />
      <StatusRow label="Last Registration" value={formatTime(lastRegistrationAt)} />
      <StatusRow
        label="Round Trip Latency"
        value={roundTripLatencyMs != null ? `${roundTripLatencyMs} ms` : '—'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  emoji: { fontSize: 18 },
  statusLabel: { ...typography.subtitle },
  error: { ...typography.caption, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  rowLabel: { ...typography.caption, flex: 1 },
  rowValue: { ...typography.caption, fontWeight: '600', flex: 1, textAlign: 'right' },
});
