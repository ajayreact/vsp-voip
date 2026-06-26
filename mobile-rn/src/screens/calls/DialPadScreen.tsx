import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TelnyxConnectionState } from '@telnyx/react-voice-commons-sdk';
import { Button, VspDialDisplay, VspDialPad } from '../../components';
import { placeOutboundCall } from '../../calling/callingController';
import { connectionLabel, useCanPlaceCalls } from '../../calling/TelnyxCallingProvider';
import { useCallingStore } from '../../store/callingStore';
import { useTheme } from '../../shared/theme';
import { formatPhone } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

export function DialPadScreen() {
  const { colors } = useTheme();
  const [digits, setDigits] = useState('');
  const [placing, setPlacing] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  const connectionState = useCallingStore((s) => s.connectionState);
  const registrationError = useCallingStore((s) => s.registrationError);
  const isRegistering = useCallingStore((s) => s.isRegistering);
  const defaultCallerId = useCallingStore((s) => s.defaultCallerId);
  const retryRegistration = useCallingStore((s) => s.retryRegistration);
  const canPlace = useCanPlaceCalls();

  function append(d: string) {
    setDigits((prev) => prev + d);
    setCallError(null);
  }

  function backspace() {
    setDigits((prev) => prev.slice(0, -1));
  }

  async function handlePlaceCall() {
    if (!canPlace || digits.length < 3) return;
    setPlacing(true);
    setCallError(null);
    try {
      await placeOutboundCall(digits);
      setDigits('');
    } catch (error) {
      setCallError(error instanceof Error ? error.message : 'Unable to place call');
    } finally {
      setPlacing(false);
    }
  }

  const statusLabel = connectionLabel(connectionState);
  const statusTone = registrationError
    ? colors.error
    : connectionState === TelnyxConnectionState.CONNECTED
      ? colors.success
      : connectionState === TelnyxConnectionState.RECONNECTING
        ? colors.warning
        : colors.textMuted;

  const callerHint = defaultCallerId
    ? `Caller ID ${formatPhone(defaultCallerId)}`
    : 'Using tenant default caller ID';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.statusBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.statusRow}>
          {isRegistering ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          <Text style={[styles.statusText, { color: statusTone }]}>{statusLabel}</Text>
        </View>
        {registrationError ? (
          <View style={styles.errorRow}>
            <Text style={[styles.errorText, { color: colors.error }]}>{registrationError}</Text>
            <Button label="Retry" variant="ghost" onPress={retryRegistration} />
          </View>
        ) : null}
      </View>

      <VspDialDisplay
        value={digits ? formatPhone(digits) : ''}
        hint={canPlace ? callerHint : 'Registering with Telnyx…'}
      />
      <VspDialPad onDigit={append} />
      {callError ? (
        <Text style={[styles.callError, { color: colors.error }]} accessibilityLiveRegion="polite">
          {callError}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button label="Clear" variant="ghost" onPress={() => setDigits('')} disabled={!digits} />
        <Button label="Delete" variant="secondary" onPress={backspace} disabled={!digits} />
        <Button
          label={placing ? 'Calling…' : 'Place call'}
          onPress={handlePlaceCall}
          disabled={!canPlace || digits.length < 3 || placing}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  statusBar: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  errorRow: {
    gap: spacing.xs,
  },
  errorText: {
    ...typography.caption,
  },
  callError: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
});
