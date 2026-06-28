'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createInitialTelephonySnapshot,
  createTelephonyOrchestrator,
  primeTelephonyAudio,
  selectCallDirection,
  selectCallerNameHint,
  selectConnectionStatus,
  selectDisplayNumber,
  selectDurationSeconds,
  selectHasLiveCall,
  selectIncomingReceivedAt,
  selectInCallMediaReady,
  selectIsConnected,
  selectIsMuted,
  selectIsOnHold,
  selectReconnecting,
  selectShowIncomingOverlay,
  selectTelnyxReady,
  selectUiCallState,
  type TelephonySnapshot,
} from '@/lib/telephony';

export function useSoftphoneTelephony(getRemoteAudioElement: () => HTMLAudioElement | null) {
  const [snapshot, setSnapshot] = useState<TelephonySnapshot>(createInitialTelephonySnapshot);

  const orchestrator = useMemo(
    () =>
      createTelephonyOrchestrator({
        onSnapshotChange: (next) => setSnapshot({ ...next }),
        getRemoteAudioElement,
      }),
    [getRemoteAudioElement],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      orchestrator.tickTimer();
    }, 1000);
    return () => window.clearInterval(id);
  }, [orchestrator]);

  useEffect(() => {
    void orchestrator.syncRingback(null);
  }, [snapshot.callPhase, orchestrator]);

  const primeAudio = useCallback(async () => {
    await primeTelephonyAudio(getRemoteAudioElement());
  }, [getRemoteAudioElement]);

  return {
    orchestrator,
    snapshot,
    primeAudio,
    uiCallState: selectUiCallState(snapshot),
    durationSeconds: selectDurationSeconds(snapshot),
    isConnected: selectIsConnected(snapshot),
    isOnHold: selectIsOnHold(snapshot),
    isMuted: selectIsMuted(snapshot),
    hasLiveCall: selectHasLiveCall(snapshot),
    inCallMediaReady: selectInCallMediaReady(snapshot),
    callDirection: selectCallDirection(snapshot),
    displayNumber: selectDisplayNumber(snapshot),
    callerNameHint: selectCallerNameHint(snapshot),
    incomingReceivedAt: selectIncomingReceivedAt(snapshot),
    showIncomingOverlay: selectShowIncomingOverlay(snapshot),
    telnyxReady: selectTelnyxReady(snapshot),
    telnyxSocketConnected: snapshot.socketConnected,
    reconnecting: selectReconnecting(snapshot),
    connectionStatus: selectConnectionStatus(snapshot),
    reconnectAttempt: snapshot.reconnectAttempt,
    pendingInternal: snapshot.pendingInternal,
  };
}
