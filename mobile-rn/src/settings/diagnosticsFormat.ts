import type { ExtensionRecord } from '../api/types';
import type { LiveSettingsStatus, SoftphoneDiagnostics } from './types';

export function resolveMyExtension(
  extensions: ExtensionRecord[],
  userId: string | undefined,
): ExtensionRecord | undefined {
  if (!userId) return undefined;
  return extensions.find((ext) => ext.userId === userId || ext.user?.id === userId);
}

export function formatDiagnosticsReport(params: {
  status: LiveSettingsStatus;
  diagnostics?: SoftphoneDiagnostics | null;
  userEmail?: string;
  tenantName?: string;
  extensionNumber?: string;
}): string {
  const lines = [
    'VSP Phone Diagnostics',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Account',
    `Email: ${params.userEmail || '—'}`,
    `Organization: ${params.tenantName || '—'}`,
    `Extension: ${params.extensionNumber || '—'}`,
    '',
    'Client',
    `App version: ${params.status.appVersion}`,
    `Build: ${params.status.buildNumber}`,
    `API: ${params.status.apiEnvironment}`,
    `Network: ${params.status.network}`,
    `SIP registration: ${params.status.sipRegistration}`,
    `Push registration: ${params.status.pushRegistration}`,
    `Audio route: ${params.status.audioRoute}`,
  ];

  const remote = params.diagnostics;
  if (remote) {
    lines.push(
      '',
      'Server diagnostics',
      `Outbound ready: ${remote.outboundReady ? 'yes' : 'no'}`,
      `Inbound ready: ${remote.inboundRouting?.ready ? 'yes' : 'no'}`,
      `SIP username: ${remote.inboundRouting?.sipUsername || '—'}`,
      `Registered devices: ${remote.push?.userDevices?.count ?? 0}`,
    );
    if (remote.fix) {
      lines.push(`Suggested fix: ${remote.fix}`);
    }
  }

  return lines.join('\n');
}

export function formatPlatformLabel(platform: string): string {
  const key = platform.toLowerCase();
  if (key.includes('ios')) return 'iOS';
  if (key.includes('android')) return 'Android';
  return platform;
}
