import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TelnyxCallState } from '@telnyx/react-voice-commons-sdk';
import { Avatar, VspDialPad, VspIconButton } from '../../components';
import type { CallSessionSnapshot } from '../../store/callingStore';
import {
  hangupActiveCall,
  sendDtmf,
  toggleHold,
  toggleInCallKeypad,
  toggleMute,
  toggleSpeaker,
} from '../../calling/callingController';
import { useTheme } from '../../shared/theme';
import { formatCallDuration } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

type Props = {
  session: CallSessionSnapshot;
};

function callStatusLabel(state: TelnyxCallState, isIncoming: boolean, isHeld: boolean): string {
  if (isHeld || state === TelnyxCallState.HELD) return 'On hold';
  switch (state) {
    case TelnyxCallState.ACTIVE:
      return 'Connected';
    case TelnyxCallState.RINGING:
      return isIncoming ? 'Ringing…' : 'Calling…';
    case TelnyxCallState.CONNECTING:
      return isIncoming ? 'Connecting…' : 'Calling…';
    case TelnyxCallState.DROPPED:
      return 'Reconnecting…';
    case TelnyxCallState.FAILED:
      return 'Call failed';
    default:
      return isIncoming ? 'Incoming…' : 'Calling…';
  }
}

export const ActiveCallScreen = React.memo(function ActiveCallScreen({ session }: Props) {
  const { colors } = useTheme();
  const { identity, state, isMuted, isHeld, duration, showKeypad, lastDtmf, speakerOn, isIncoming } =
    session;
  const statusLabel = callStatusLabel(state, isIncoming, isHeld);
  const controlsEnabled = state === TelnyxCallState.ACTIVE || state === TelnyxCallState.HELD;
  const showTimer = controlsEnabled;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Avatar name={identity.name} size={88} />
        <Text style={[styles.name, { color: colors.text }]}>{identity.name}</Text>
        <Text style={[styles.number, { color: colors.textMuted }]}>{identity.number}</Text>
        <Text style={[styles.status, { color: colors.primary }]}>{statusLabel}</Text>
        {showTimer ? (
          <Text style={[styles.timer, { color: colors.text }]} accessibilityLabel="Call duration">
            {formatCallDuration(duration)}
          </Text>
        ) : null}
        {showKeypad && lastDtmf ? (
          <Text style={[styles.dtmfEcho, { color: colors.textMuted }]}>{lastDtmf}</Text>
        ) : null}
      </View>

      {showKeypad ? (
        <View style={styles.keypadWrap}>
          <VspDialPad onDigit={(digit) => void sendDtmf(digit)} variant="iphone" />
        </View>
      ) : (
        <View style={styles.spacer} />
      )}

      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <VspIconButton
            icon={speakerOn ? 'volume-high-outline' : 'volume-medium-outline'}
            label={speakerOn ? 'Speaker' : 'Speaker'}
            onPress={toggleSpeaker}
            disabled={!controlsEnabled}
          />
          <VspIconButton
            icon={isMuted ? 'mic-off-outline' : 'mic-outline'}
            label={isMuted ? 'Unmute' : 'Mute'}
            onPress={() => void toggleMute()}
            disabled={!controlsEnabled}
          />
          <VspIconButton
            icon="pause-outline"
            label={isHeld ? 'Resume' : 'Hold'}
            onPress={() => void toggleHold()}
            disabled={!controlsEnabled}
          />
          <VspIconButton
            icon="keypad-outline"
            label={showKeypad ? 'Hide' : 'Keypad'}
            onPress={toggleInCallKeypad}
            disabled={!controlsEnabled}
          />
        </View>

        <Pressable
          onPress={() => void hangupActiveCall()}
          style={styles.endCallButton}
          accessibilityRole="button"
          accessibilityLabel="End call"
        >
          <Ionicons name="call" size={32} color="#fff" style={styles.endCallIcon} />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxl,
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
  status: {
    ...typography.bodyMedium,
    marginTop: spacing.sm,
  },
  timer: {
    ...typography.display,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xs,
  },
  dtmfEcho: {
    ...typography.mono,
    letterSpacing: 4,
    marginTop: spacing.xs,
  },
  keypadWrap: {
    marginBottom: spacing.md,
  },
  spacer: {
    flex: 0,
  },
  controls: {
    alignItems: 'center',
    gap: spacing.xl,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 360,
  },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallIcon: {
    transform: [{ rotate: '135deg' }],
  },
});
