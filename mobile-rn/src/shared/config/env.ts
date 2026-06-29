import Constants from 'expo-constants';
import { resolveApiEnvironmentLabel } from './apiEnvironment';

export { resolveApiEnvironmentLabel, isTrustedProvisionHost } from './apiEnvironment';

type ExtraConfig = {
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

function isReleaseBuild(): boolean {
  return typeof __DEV__ !== 'undefined' ? !__DEV__ : process.env.NODE_ENV === 'production';
}

function resolveApiBaseUrl(): string {
  const raw = (extra.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000').replace(
    /\/$/,
    '',
  );

  if (isReleaseBuild() && /localhost|127\.0\.0\.1/i.test(raw)) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL must be configured for release builds. Rebuild with a production API URL.',
    );
  }

  return raw;
}

export const env = {
  apiBaseUrl: resolveApiBaseUrl(),
};

/** Returns a friendly label for the configured API environment. */
export function getApiEnvironmentLabel(): string {
  return resolveApiEnvironmentLabel(env.apiBaseUrl);
}
