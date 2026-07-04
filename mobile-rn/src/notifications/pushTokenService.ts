import { Platform } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { create } from 'zustand';
import { logger, withRetry } from '../lib/logger';
import { useCallingStore } from '../store/callingStore';
import { getFriendlyErrorMessage } from '../utils/friendlyError';
import { getNativeVoipToken } from './nativeBridge';
import { postSoftphonePushToken } from '../calling/softphoneService';

export type PushRegistrationStatus =
  | 'idle'
  | 'registering'
  | 'registered'
  | 'unavailable'
  | 'error';

type PushState = {
  status: PushRegistrationStatus;
  tokenPreview: string | null;
  lastError: string | null;
  registeredAt: string | null;
  setStatus: (status: PushRegistrationStatus) => void;
  setRegistered: (tokenPreview: string) => void;
  setError: (message: string) => void;
  reset: () => void;
};

export const usePushRegistrationStore = create<PushState>((set) => ({
  status: 'idle',
  tokenPreview: null,
  lastError: null,
  registeredAt: null,
  setStatus: (status) => set({ status }),
  setRegistered: (tokenPreview) =>
    set({
      status: 'registered',
      tokenPreview,
      lastError: null,
      registeredAt: new Date().toISOString(),
    }),
  setError: (message) => set({ status: 'error', lastError: message }),
  reset: () =>
    set({ status: 'idle', tokenPreview: null, lastError: null, registeredAt: null }),
}));

let cachedToken: string | null = null;

export function getCachedPushToken() {
  return cachedToken;
}

function tokenPreview(token: string) {
  if (token.length <= 12) return token;
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

export async function getDeviceId(): Promise<string> {
  if (Platform.OS === 'android' && Application.getAndroidId) {
    return Application.getAndroidId();
  }
  if (Platform.OS === 'ios') {
    return Application.getIosIdForVendorAsync().then((id) => id || 'ios-unknown');
  }
  return Constants.sessionId || 'unknown-device';
}

async function fetchAndroidFcmToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const messaging = require('@react-native-firebase/messaging').default;
    await messaging().registerDeviceForRemoteMessages();
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED
      || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    if (!enabled) {
      logger.warn('push', 'Android notification permission denied');
    }
    return (await messaging().getToken())?.trim() || null;
  } catch (error) {
    logger.warn('push', 'Firebase messaging unavailable — add google-services.json and rebuild', error);
    return null;
  }
}

async function fetchIosVoipToken(maxAttempts = 12): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const token = await getNativeVoipToken();
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  logger.warn('push', 'VoIP token not available after waiting — verify PushKit AppDelegate setup');
  return null;
}

export async function resolvePushDeviceToken(): Promise<string | null> {
  if (Platform.OS === 'android') return fetchAndroidFcmToken();
  return fetchIosVoipToken();
}

export async function registerPushWithBackend(): Promise<string | null> {
  const store = usePushRegistrationStore.getState();
  store.setStatus('registering');

  const token = await resolvePushDeviceToken();
  if (!token) {
    store.setStatus('unavailable');
    return null;
  }

  const deviceId = await getDeviceId();
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  try {
    await withRetry(
      () =>
        postSoftphonePushToken({
          token,
          platform,
          deviceId,
          deviceName: `${Platform.OS} ${Application.nativeApplicationVersion || ''}`.trim(),
          appVersion: Application.nativeApplicationVersion || undefined,
        }),
      { label: 'push-register', attempts: 3 },
    );
    cachedToken = token;
    store.setRegistered(tokenPreview(token));
    logger.info('push', 'Device token registered with VSP backend');
    logger.telemetry('push_registration_success', { platform });
    useCallingStore.getState().requestPushTokenSync();
    return token;
  } catch (error) {
    const message = getFriendlyErrorMessage(error);
    store.setError(message);
    logger.error('push', message, error);
    logger.telemetry('push_registration_failed', { platform, message });
    return null;
  }
}

export function subscribeAndroidTokenRefresh(onRefresh: (token: string) => void) {
  if (Platform.OS !== 'android') return () => {};
  try {
    const messaging = require('@react-native-firebase/messaging').default;
    return messaging().onTokenRefresh((token: string) => {
      cachedToken = token;
      onRefresh(token);
    });
  } catch {
    return () => {};
  }
}

export async function getTelnyxPushNotificationToken(): Promise<string | undefined> {
  if (cachedToken) return cachedToken;
  const token = await resolvePushDeviceToken();
  if (token) cachedToken = token;
  return token || undefined;
}
