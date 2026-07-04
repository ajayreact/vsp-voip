export function resolveApiEnvironmentLabel(apiBaseUrl: string): string {
  if (/localhost|127\.0\.0\.1/i.test(apiBaseUrl)) return 'Development';
  if (/staging|preview|uat/i.test(apiBaseUrl)) return 'Staging';
  return 'Production';
}

export function isTrustedProvisionHost(
  url: string,
  configuredApiBaseUrl: string,
  devMode = typeof __DEV__ !== 'undefined' && __DEV__,
): boolean {
  try {
    const configured = new URL(configuredApiBaseUrl);
    const target = new URL(url);
    if (target.origin === configured.origin) return true;
    if (target.hostname === 'api.vspphone.com') return true;
    if (devMode) {
      return target.hostname === 'localhost' || target.hostname === '127.0.0.1';
    }
    return false;
  } catch {
    return false;
  }
}
