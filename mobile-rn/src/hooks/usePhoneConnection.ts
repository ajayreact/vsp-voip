import { useMemo } from 'react';
import { canMakeCalls, VspConnectionState } from '../calling/vspTelephonyState';
import { useAppStore } from '../store/appStore';
import { useCallingStore } from '../store/callingStore';

export type PhoneConnectionStatus =
  | 'network_offline'
  | 'connecting'
  | 'registering'
  | 'reconnecting'
  | 'disconnected'
  | 'auth_failed'
  | 'connected';

type ResolveParams = {
  isOnline: boolean;
  connectionState: VspConnectionState;
  isRegistering: boolean;
  registrationError: string | null;
};

export function resolvePhoneConnectionStatus({
  isOnline,
  connectionState,
  isRegistering,
  registrationError,
}: ResolveParams): PhoneConnectionStatus {
  if (!isOnline) return 'network_offline';
  if (registrationError) return 'auth_failed';
  if (isRegistering) return 'registering';

  switch (connectionState) {
    case VspConnectionState.CONNECTED:
      return 'connected';
    case VspConnectionState.CONNECTING:
      return 'connecting';
    case VspConnectionState.RECONNECTING:
      return 'reconnecting';
    case VspConnectionState.ERROR:
      return 'auth_failed';
    default:
      return 'disconnected';
  }
}

const STATUS_LABELS: Record<PhoneConnectionStatus, string> = {
  network_offline: 'Network offline',
  connecting: 'Connecting…',
  registering: 'Registering…',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
  auth_failed: 'Authentication failed',
  connected: 'Connected',
};

const STATUS_HINTS: Partial<Record<PhoneConnectionStatus, string>> = {
  network_offline: 'Check your internet connection.',
  connecting: 'Setting up your phone line.',
  registering: 'Signing in to the phone service.',
  reconnecting: 'Restoring your phone connection.',
  disconnected: 'Waiting for phone service.',
  auth_failed: 'Sign out and sign in again if this continues.',
};

export function getPhoneConnectionLabel(status: PhoneConnectionStatus): string {
  return STATUS_LABELS[status];
}

export function getPhoneConnectionHint(status: PhoneConnectionStatus): string | undefined {
  return STATUS_HINTS[status];
}

export function usePhoneConnection() {
  const isOnline = useAppStore((s) => s.isOnline);
  const connectionState = useCallingStore((s) => s.connectionState);
  const isRegistering = useCallingStore((s) => s.isRegistering);
  const registrationError = useCallingStore((s) => s.registrationError);

  const status = useMemo(
    () => resolvePhoneConnectionStatus({
      isOnline,
      connectionState,
      isRegistering,
      registrationError,
    }),
    [connectionState, isOnline, isRegistering, registrationError],
  );

  const canPlaceCalls = status === 'connected' && canMakeCalls(connectionState);

  return {
    status,
    canPlaceCalls,
    label: getPhoneConnectionLabel(status),
    hint: getPhoneConnectionHint(status),
    isOnline,
    connectionState,
    isRegistering,
    registrationError,
  };
}
