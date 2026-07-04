import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricCapability = {
  available: boolean;
  enrolled: boolean;
  label: string;
};

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return { available: false, enrolled: false, label: 'Biometrics' };
  }

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const label = resolveBiometricLabel(types);

  return {
    available: enrolled,
    enrolled,
    label,
  };
}

function resolveBiometricLabel(
  types: LocalAuthentication.AuthenticationType[],
): string {
  const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

  if (Platform.OS === 'ios') {
    if (hasFace) return 'Face ID';
    if (hasFingerprint) return 'Touch ID';
    return 'Biometrics';
  }

  if (hasFingerprint) return 'Fingerprint';
  if (hasFace) return 'Face unlock';
  return 'Biometrics';
}

export type BiometricAuthResult =
  | { success: true }
  | { success: false; reason: 'cancelled' | 'failed' | 'unavailable' | 'lockout' };

export async function authenticateWithBiometric(
  promptMessage = 'Unlock VSP Phone',
): Promise<BiometricAuthResult> {
  const capability = await getBiometricCapability();
  if (!capability.available) {
    return { success: false, reason: 'unavailable' };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Use password',
    disableDeviceFallback: true,
    fallbackLabel: 'Use password',
  });

  if (result.success) {
    return { success: true };
  }

  if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel') {
    return { success: false, reason: 'cancelled' };
  }

  if (result.error === 'lockout') {
    return { success: false, reason: 'lockout' };
  }

  return { success: false, reason: 'failed' };
}
