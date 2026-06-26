import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TelnyxCallState } from '@telnyx/react-voice-commons-sdk';
import {
  Avatar,
  VspActionBar,
  VspBadge,
  VspDialPad,
  VspHero,
  VspIconButton,
} from '../../components';
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

function stateBadge(state: TelnyxCallState, isHeld: boolean) {
  if (isHeld || state === TelnyxCallState.HELD) return { label: 'On hold', tone: 'warning' as const };
  switch (state) {
    case TelnyxCallState.ACTIVE:
      return { label: 'Connected', tone: 'success' as const };
    case TelnyxCallState.RINGING:
      return { label: 'Ringing…', tone: 'primary' as const };
    case TelnyxCallState.CONNECTING:
      return { label: 'Connecting…', tone: 'primary' as const };
    case TelnyxCallState.DROPPED:
      return { label: 'Reconnecting…', tone: 'warning' as const };
    default:
      return { label: 'In call', tone: 'primary' as const };
  }
}

export function ActiveCallScreen({ session }: Props) {
  const { colors } = useTheme();
  const { identity, state, isMuted, isHeld, duration, showKeypad, lastDtmf, speakerOn } = session;
  const badge = stateBadge(state, isHeld);
  const controlsEnabled = state === TelnyxCallState.ACTIVE || state === TelnyxCallState.HELD;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <VspHero
        eyebrow={session.isIncoming ? 'Incoming call' : 'Outbound call'}
        title={identity.name}
        subtitle={identity.number}
        trailing={<Avatar name={identity.name} size={64} online={state === TelnyxCallState.ACTIVE} />}
      />

      <View style={styles.center}>
        <VspBadge label={badge.label} tone={badge.tone} />
        <Text style={[styles.timer, { color: colors.text }]} accessibilityLabel="Call duration">
          {formatCallDuration(duration)}
        </Text>
        <Text style={[styles.quality, { color: colors.textMuted }]}>Telnyx WebRTC</Text>
        {showKeypad && lastDtmf ? (
          <Text style={[styles.dtmfEcho, { color: colors.textMuted }]}>{lastDtmf}</Text>
        ) : null}
      </View>

      {showKeypad ? (
        <View style={styles.keypadWrap}>
          <VspDialPad onDigit={(digit) => void sendDtmf(digit)} />
        </View>
      ) : null}

      <VspActionBar>
        <VspIconButton
          icon={isMuted ? 'mic-off-outline' : 'mic-outline'}
          label={isMuted ? 'Unmute' : 'Mute'}
          onPress={() => void toggleMute()}
          disabled={!controlsEnabled}
        />
        <VspIconButton
          icon={speakerOn ? 'volume-high-outline' : 'volume-medium-outline'}
          label={speakerOn ? 'Earpiece' : 'Speaker'}
          onPress={toggleSpeaker}
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
        <VspIconButton
          icon="call-outline"
          label="End"
          variant="danger"
          size="lg"
          onPress={() => void hangupActiveCall()}
        />
      </VspActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  timer: {
    ...typography.display,
    fontVariant: ['tabular-nums'],
  },
  quality: {
    ...typography.caption,
  },
  dtmfEcho: {
    ...typography.mono,
    letterSpacing: 4,
  },
  keypadWrap: {
    marginBottom: spacing.sm,
  },
});
