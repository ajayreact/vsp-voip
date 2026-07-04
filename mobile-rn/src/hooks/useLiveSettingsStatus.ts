import { useMemo } from 'react';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { useAppStore } from '../store/appStore';
import { usePushRegistrationStore } from '../notifications/pushTokenService';
import {
  getPhoneConnectionLabel,
  usePhoneConnection,
} from './usePhoneConnection';
import { env, getApiEnvironmentLabel } from '../shared/config/env';
import type { LiveSettingsStatus } from '../settings/types';

export function useLiveSettingsStatus(audioRouteLabel = 'Phone'): LiveSettingsStatus {
  const isOnline = useAppStore((s) => s.isOnline);
  const { status } = usePhoneConnection();
  const pushStatus = usePushRegistrationStore((s) => s.status);
  const pushPreview = usePushRegistrationStore((s) => s.tokenPreview);

  return useMemo(
    (): LiveSettingsStatus => ({
      sipRegistration: getPhoneConnectionLabel(status),
      pushRegistration:
        pushStatus === 'registered'
          ? pushPreview
            ? `Registered (${pushPreview})`
            : 'Registered'
          : pushStatus,
      audioRoute: audioRouteLabel,
      network: isOnline ? 'Online' : 'Offline',
      appVersion: Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0',
      buildNumber: Application.nativeBuildVersion || 'dev',
      apiEnvironment: `${getApiEnvironmentLabel()} · ${env.apiBaseUrl}`,
    }),
    [audioRouteLabel, isOnline, pushPreview, pushStatus, status],
  );
}
