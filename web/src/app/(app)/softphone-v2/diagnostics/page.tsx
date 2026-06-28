'use client';

import { WebRtcDiagnosticsPanel } from '@/components/webrtc-diagnostics-panel';
import { TenantOnlyGate } from '@/components/tenant-only-gate';
import { BrowserCallingDisabledPanel } from '@/components/browser-calling-disabled';
import { isBrowserCallingEnabled } from '@/lib/softphone-config';

export default function SoftphoneV2DiagnosticsPage() {
  if (!isBrowserCallingEnabled()) {
    return <BrowserCallingDisabledPanel />;
  }

  return (
    <TenantOnlyGate featureName="WebRTC Diagnostics">
      <WebRtcDiagnosticsPanel backHref="/softphone-v2" backLabel="Back to Softphone" />
    </TenantOnlyGate>
  );
}
