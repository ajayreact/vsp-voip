import React, { useEffect } from 'react';
import {
  TelnyxVoiceApp,
  createTokenConfig,
  TelnyxConnectionState,
  TelnyxCallState,
  CallStateHelpers,
  TelnyxVoipClient,
  type Call,
} from '@telnyx/react-voice-commons-sdk';
import { useAuthStore } from '../store/authStore';
import { useCallingStore } from '../store/callingStore';
import {
  bindCallStreams,
  clearContactsCache,
  refreshCallSnapshot,
} from './callingController';
import { fetchSoftphoneConfig, fetchSoftphoneToken } from './softphoneService';
import {
  startSoftphonePresenceHeartbeat,
  stopSoftphonePresenceHeartbeat,
} from './softphonePresence';
import { getTelnyxVoipClient } from './telnyxVoip';
import { getTelnyxPushNotificationToken } from '../notifications/pushTokenService';
import { logger } from '../lib/logger';
import { friendlySipError } from '../sip/validation';

type Props = {
  children: React.ReactNode;
};

function TelnyxRegistrationBridge() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setConnectionState = useCallingStore((s) => s.setConnectionState);
  const setRegistrationError = useCallingStore((s) => s.setRegistrationError);
  const setIsRegistering = useCallingStore((s) => s.setIsRegistering);
  const setTenantNumbers = useCallingStore((s) => s.setTenantNumbers);
  const resetCalls = useCallingStore((s) => s.resetCalls);
  const registrationAttempt = useCallingStore((s) => s.registrationAttempt);
  const pushTokenSyncAttempt = useCallingStore((s) => s.pushTokenSyncAttempt);
  const activeCall = useCallingStore((s) => s.activeCall);
  const incomingCall = useCallingStore((s) => s.incomingCall);

  useEffect(() => {
    const client = getTelnyxVoipClient();
    const connectionSub = client.connectionState$.subscribe((state) => {
      setConnectionState(state);
      if (state === TelnyxConnectionState.CONNECTED && isAuthenticated) {
        startSoftphonePresenceHeartbeat();
      } else if (
        state === TelnyxConnectionState.DISCONNECTED
        || state === TelnyxConnectionState.ERROR
      ) {
        stopSoftphonePresenceHeartbeat();
      }
    });

    if (client.currentConnectionState === TelnyxConnectionState.CONNECTED && isAuthenticated) {
      startSoftphonePresenceHeartbeat();
    }

    const callsSub = client.calls$.subscribe((calls) => {
      const ringingIncoming = calls.find(
        (call) => call.isIncoming && call.currentState === TelnyxCallState.RINGING,
      );
      if (ringingIncoming) {
        void refreshCallSnapshot(ringingIncoming);
      }
    });

    const activeSub = client.activeCall$.subscribe((call) => {
      if (call) void refreshCallSnapshot(call);
    });

    return () => {
      connectionSub.unsubscribe();
      callsSub.unsubscribe();
      activeSub.unsubscribe();
      stopSoftphonePresenceHeartbeat();
    };
  }, [isAuthenticated, setConnectionState]);

  useEffect(() => {
    let disposed = false;
    const client = getTelnyxVoipClient();
    const callBindings = new Map<string, () => void>();

    const bindCalls = (calls: Call[]) => {
      const liveIds = new Set(calls.map((call) => call.callId));
      for (const [callId, unsubscribe] of callBindings.entries()) {
        if (!liveIds.has(callId)) {
          unsubscribe();
          callBindings.delete(callId);
        }
      }

      for (const call of calls) {
        if (callBindings.has(call.callId)) continue;
        if (CallStateHelpers.isTerminated(call.currentState)) continue;
        const unsubscribe = bindCallStreams(call);
        callBindings.set(call.callId, unsubscribe);
      }
    };

    const callsSub = client.calls$.subscribe(bindCalls);

    async function register() {
      if (!isAuthenticated) {
        clearContactsCache();
        resetCalls();
        stopSoftphonePresenceHeartbeat();
        await client.logout().catch(() => {});
        return;
      }

      const launchedFromPush = await TelnyxVoipClient.isLaunchedFromPushNotification();
      if (launchedFromPush) {
        logger.info('telnyx', 'Push-launched cold start — skipping manual login');
        return;
      }

      setIsRegistering(true);
      setRegistrationError(null);
      try {
        const [tokenRes, configRes, pushToken] = await Promise.all([
          fetchSoftphoneToken(),
          fetchSoftphoneConfig(),
          getTelnyxPushNotificationToken(),
        ]);
        if (disposed) return;

        const loginToken = tokenRes.loginToken?.trim();
        if (!loginToken) {
          throw new Error('Softphone token missing from server response.');
        }

        const numbers = (configRes.numbers ?? []).map((entry) => entry.number);
        const defaultCallerId = configRes.defaultCallerId || numbers[0] || '';
        setTenantNumbers(numbers, defaultCallerId);

        await client.loginWithToken(
          createTokenConfig(loginToken, {
            debug: __DEV__,
            pushNotificationDeviceToken: pushToken,
          }),
        );
        logger.telemetry('telnyx_registration_success', { hasPushToken: Boolean(pushToken) });
      } catch (error) {
        if (!disposed) {
          const message = friendlySipError(error);
          setRegistrationError(message);
          logger.error('telnyx', message, error);
          logger.telemetry('telnyx_registration_failed', { message });
        }
      } finally {
        if (!disposed) setIsRegistering(false);
      }
    }

    void register();

    return () => {
      disposed = true;
      callsSub.unsubscribe();
      callBindings.forEach((unsub) => unsub());
      callBindings.clear();
      stopSoftphonePresenceHeartbeat();
    };
  }, [isAuthenticated, registrationAttempt, resetCalls, setIsRegistering, setRegistrationError, setTenantNumbers]);

  useEffect(() => {
    if (!isAuthenticated || pushTokenSyncAttempt === 0) return;
    if (activeCall || incomingCall) return;

    let disposed = false;
    const client = getTelnyxVoipClient();

    async function syncPushToken() {
      try {
        const [tokenRes, pushToken] = await Promise.all([
          fetchSoftphoneToken(),
          getTelnyxPushNotificationToken(),
        ]);
        if (disposed || !pushToken) return;
        const loginToken = tokenRes.loginToken?.trim();
        if (!loginToken) return;
        await client.loginWithToken(
          createTokenConfig(loginToken, {
            debug: __DEV__,
            pushNotificationDeviceToken: pushToken,
          }),
        );
        logger.info('telnyx', 'Push token synchronized with Telnyx registration');
      } catch (error) {
        logger.warn('telnyx', 'Push token sync failed', error);
      }
    }

    void syncPushToken();
    return () => {
      disposed = true;
    };
  }, [isAuthenticated, pushTokenSyncAttempt, activeCall, incomingCall]);

  return null;
}

export function TelnyxCallingProvider({ children }: Props) {
  const voipClient = getTelnyxVoipClient();

  return (
    <TelnyxVoiceApp voipClient={voipClient} enableAutoReconnect debug={__DEV__}>
      <TelnyxRegistrationBridge />
      {children}
    </TelnyxVoiceApp>
  );
}

import { usePhoneConnection } from '../hooks/usePhoneConnection';

export function useCanPlaceCalls() {
  return usePhoneConnection().canPlaceCalls;
}

export function connectionLabel(state: TelnyxConnectionState) {
  switch (state) {
    case TelnyxConnectionState.CONNECTED:
      return 'Registered';
    case TelnyxConnectionState.CONNECTING:
      return 'Connecting…';
    case TelnyxConnectionState.RECONNECTING:
      return 'Reconnecting…';
    case TelnyxConnectionState.ERROR:
      return 'Registration error';
    default:
      return 'Offline';
  }
}
