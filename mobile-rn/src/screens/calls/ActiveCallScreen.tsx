import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { TelnyxCallState } from '@telnyx/react-voice-commons-sdk';
import { VspDialPad, VspActionBar } from '../../components';
import {
  AudioRouteChip,
  AudioRoutePicker,
  CallCallerCard,
  CallControlButton,
  useAvailableAudioRoutes,
} from '../../components/calls';
import type { CallSessionSnapshot } from '../../store/callingStore';
import {
  getCallStatusLabel,
  getConnectionQualityLabel,
  resolveCallPhase,
} from '../../calling/callDisplay';
import {
  hangupActiveCall,
  sendDtmf,
  toggleHold,
  toggleInCallKeypad,
  toggleMute,
  toggleSpeaker,
} from '../../calling/callingController';
import { useAudioRoute } from '../../hooks/useAudioRoute';
import { useTheme } from '../../shared/theme';
import { formatCallDuration } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

type Props = {
  session: CallSessionSnapshot;
};

function controlsEnabled(state: TelnyxCallState) {
  return state === TelnyxCallState.ACTIVE || state === TelnyxCallState.HELD;
}

export const ActiveCallScreen = React.memo(function ActiveCallScreen({ session }: Props) {
  const { colors } = useTheme();
  const { identity, state, isMuted, isHeld, duration, showKeypad, lastDtmf, speakerOn, isIncoming } =
    session;

  const phase = resolveCallPhase(state, isIncoming, isHeld);
  const statusLabel = getCallStatusLabel(phase);
  const qualityLabel = getConnectionQualityLabel(phase);
  const enabled = controlsEnabled(state);
  const showTimer = phase === 'connected' || phase === 'held';
  const { route, label: audioRouteLabel, detectedRoutes } = useAudioRoute(speakerOn);
  const availableRoutes = useAvailableAudioRoutes(route, detectedRoutes);
  const [routePickerVisible, setRoutePickerVisible] = useState(false);

  const durationLabel = useMemo(
    () => (showTimer ? formatCallDuration(duration) : undefined),
    [duration, showTimer],
  );

  const handleTransfer = () => {
    Alert.alert('Transfer', 'Call transfer will be available in a future update.');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <CallCallerCard
          identity={identity}
          statusLabel={statusLabel}
          qualityLabel={qualityLabel}
          durationLabel={durationLabel}
        />
        <AudioRouteChip
          label={audioRouteLabel}
          route={route}
          onPress={enabled ? () => setRoutePickerVisible(true) : undefined}
        />
        {showKeypad && lastDtmf ? (
          <Text style={[styles.dtmfEcho, { color: colors.textMuted }]}>{lastDtmf}</Text>
        ) : null}
      </View>

      {showKeypad ? (
        <View style={styles.keypadWrap}>
          <VspDialPad onDigit={(digit) => void sendDtmf(digit)} variant="default" />
        </View>
      ) : (
        <View style={styles.spacer} />
      )}

      <VspActionBar style={styles.actionBar}>
        <CallControlButton
          icon={speakerOn ? 'volume-high-outline' : 'volume-medium-outline'}
          label="Speaker"
          active={speakerOn}
          onPress={toggleSpeaker}
          disabled={!enabled}
        />
        <CallControlButton
          icon={isMuted ? 'mic-off-outline' : 'mic-outline'}
          label={isMuted ? 'Unmute' : 'Mute'}
          active={isMuted}
          onPress={() => void toggleMute()}
          disabled={!enabled}
        />
        <CallControlButton
          icon="pause-outline"
          label={isHeld ? 'Resume' : 'Hold'}
          active={isHeld}
          onPress={() => void toggleHold()}
          disabled={!enabled}
        />
        <CallControlButton
          icon="keypad-outline"
          label={showKeypad ? 'Hide' : 'Keypad'}
          active={showKeypad}
          onPress={toggleInCallKeypad}
          disabled={!enabled}
        />
      </VspActionBar>

      <View style={styles.secondaryRow}>
        <CallControlButton
          icon="swap-horizontal-outline"
          label="Transfer"
          onPress={handleTransfer}
          disabled={!enabled}
        />
        <CallControlButton
          icon="person-add-outline"
          label="Add call"
          disabled
        />
        <CallControlButton
          icon="recording-outline"
          label="Record"
          disabled
        />
      </View>

      <View style={styles.endWrap}>
        <CallControlButton
          icon="close"
          label="End"
          variant="danger"
          size="lg"
          onPress={() => void hangupActiveCall()}
        />
      </View>

      <AudioRoutePicker
        visible={routePickerVisible}
        currentRoute={route}
        availableRoutes={availableRoutes}
        onClose={() => setRoutePickerVisible(false)}
        onRouteSelected={() => {}}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  dtmfEcho: {
    ...typography.mono,
    letterSpacing: 4,
    textAlign: 'center',
  },
  keypadWrap: {
    marginBottom: spacing.sm,
  },
  spacer: {
    flex: 0,
  },
  actionBar: {
    marginHorizontal: 0,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
  },
  endWrap: {
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
});
