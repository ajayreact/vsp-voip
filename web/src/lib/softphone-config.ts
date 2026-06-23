/**
 * Softphone v2 rollout flag.
 *
 * Set NEXT_PUBLIC_SOFTPHONE_V2_ENABLED=true at web build time (or SOFTPHONE_V2_ENABLED
 * in deploy scripts — see deploy/deploy-web.sh).
 */
export function isSoftphoneV2Enabled(): boolean {
  const explicit = process.env.NEXT_PUBLIC_SOFTPHONE_V2_ENABLED;
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  // Default: v2 is the production softphone.
  return true;
}

export function getSoftphoneHref(): '/softphone-v2' | '/softphone' {
  return isSoftphoneV2Enabled() ? '/softphone-v2' : '/softphone';
}

export function isSoftphoneRoute(pathname: string): boolean {
  return (
    pathname === '/softphone'
    || pathname.startsWith('/softphone/')
    || pathname === '/softphone-v2'
    || pathname.startsWith('/softphone-v2/')
  );
}
