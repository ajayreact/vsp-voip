import React, { useEffect } from 'react';
import {
  TelnyxVoiceApp,
  createTokenConfig,
  canMakeCalls,
  TelnyxConnectionState,
  TelnyxCallState,
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
import { getTelnyxVoipClient } from './telnyxVoip';

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

  useEffect(() => {
    const client = getTelnyxVoipClient();
    const connectionSub = client.connectionState$.subscribe(setConnectionState);
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
    };
  }, [setConnectionState]);

  useEffect(() => {
    let disposed = false;
    const client = getTelnyxVoipClient();
    const callBindings = new Map<string, () => void>();

    const bindCalls = (calls: Call[]) => {
      for (const call of calls) {
        if (callBindings.has(call.callId)) continue;
        const ownNumbers = useCallingStore.getState().tenantNumbers;
        const unsubscribe = bindCallStreams(call, ownNumbers);
        callBindings.set(call.callId, unsubscribe);
      }
    };

    const callsSub = client.calls$.subscribe(bindCalls);

    async function register() {
      if (!isAuthenticated) {
        clearContactsCache();
        resetCalls();
        await client.logout().catch(() => {});
        return;
      }

      setIsRegistering(true);
      setRegistrationError(null);
      try {
        const [tokenRes, configRes] = await Promise.all([
          fetchSoftphoneToken(),
          fetchSoftphoneConfig(),
        ]);
        if (disposed) return;

        const loginToken = tokenRes.loginToken?.trim();
        if (!loginToken) {
          throw new Error('Softphone token missing from server response.');
        }

        const numbers = (configRes.numbers ?? []).map((entry) => entry.number);
        const defaultCallerId = configRes.defaultCallerId || numbers[0] || '';
        setTenantNumbers(numbers, defaultCallerId);

        await client.loginWithToken(createTokenConfig(loginToken, { debug: __DEV__ }));
      } catch (error) {
        if (!disposed) {
          setRegistrationError(error instanceof Error ? error.message : 'Telnyx registration failed');
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
    };
  }, [isAuthenticated, registrationAttempt, resetCalls, setIsRegistering, setRegistrationError, setTenantNumbers]);

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

export function useCanPlaceCalls() {
  const connectionState = useCallingStore((s) => s.connectionState);
  return canMakeCalls(connectionState);
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
