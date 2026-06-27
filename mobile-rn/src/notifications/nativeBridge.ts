import { NativeModules, Platform } from 'react-native';

type VoicePnBridge = {
  getVoipToken?: () => Promise<string | null>;
  getPendingPushAction?: () => Promise<{ action?: string | null; metadata?: string | null }>;
  clearPendingPushAction?: () => Promise<boolean>;
};

const bridge = NativeModules.VoicePnBridge as VoicePnBridge | undefined;

export async function getNativeVoipToken(): Promise<string | null> {
  if (Platform.OS !== 'ios' || !bridge?.getVoipToken) return null;
  try {
    const token = await bridge.getVoipToken();
    return token?.trim() || null;
  } catch {
    return null;
  }
}

export async function getPendingNativePushAction() {
  if (!bridge?.getPendingPushAction) return null;
  try {
    return await bridge.getPendingPushAction();
  } catch {
    return null;
  }
}

export async function clearPendingNativePushAction() {
  if (!bridge?.clearPendingPushAction) return;
  try {
    await bridge.clearPendingPushAction();
  } catch {
    // ignore
  }
}
