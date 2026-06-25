'use client';

import { WebRtcDiagnosticsPanel } from '@/components/webrtc-diagnostics-panel';
import { TenantOnlyGate } from '@/components/tenant-only-gate';

export default function SoftphoneV2DiagnosticsPage() {
  return (
    <TenantOnlyGate featureName="WebRTC Diagnostics">
      <WebRtcDiagnosticsPanel backHref="/softphone-v2" backLabel="Back to Softphone" />
    </TenantOnlyGate>
  );
}
