export const AuthenticationType = {
  FINGERPRINT: 1,
  FACIAL_RECOGNITION: 2,
  IRIS: 3,
};

let authenticateResult: { success: boolean; error?: string } = { success: true };
let hasHardware = true;
let enrolled = true;
let supportedTypes = [AuthenticationType.FACIAL_RECOGNITION];

export function __setBiometricTestState(state: {
  authenticateResult?: { success: boolean; error?: string };
  hasHardware?: boolean;
  enrolled?: boolean;
  supportedTypes?: number[];
}): void {
  if (state.authenticateResult) authenticateResult = state.authenticateResult;
  if (state.hasHardware !== undefined) hasHardware = state.hasHardware;
  if (state.enrolled !== undefined) enrolled = state.enrolled;
  if (state.supportedTypes) supportedTypes = state.supportedTypes;
}

export function __resetBiometricTestState(): void {
  authenticateResult = { success: true };
  hasHardware = true;
  enrolled = true;
  supportedTypes = [AuthenticationType.FACIAL_RECOGNITION];
}

export async function hasHardwareAsync(): Promise<boolean> {
  return hasHardware;
}

export async function isEnrolledAsync(): Promise<boolean> {
  return enrolled;
}

export async function supportedAuthenticationTypesAsync(): Promise<number[]> {
  return supportedTypes;
}

export async function authenticateAsync(): Promise<{ success: boolean; error?: string }> {
  return authenticateResult;
}
