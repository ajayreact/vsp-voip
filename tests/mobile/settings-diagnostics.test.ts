import { describe, expect, it } from 'vitest';
import {
  formatDiagnosticsReport,
  formatPlatformLabel,
  resolveMyExtension,
} from '../../mobile-rn/src/settings/diagnosticsFormat';
import type { ExtensionRecord } from '../../mobile-rn/src/api/types';
import type { LiveSettingsStatus } from '../../mobile-rn/src/settings/types';

const liveStatus: LiveSettingsStatus = {
  sipRegistration: 'Connected',
  pushRegistration: 'Registered',
  audioRoute: 'Phone',
  network: 'Online',
  appVersion: '1.0.0',
  buildNumber: '100',
  apiEnvironment: 'https://api.example.com',
};

describe('settings diagnostics format', () => {
  it('resolves extension for current user', () => {
    const extensions = [
      { id: 'ext-1', userId: 'user-1', extensionNumber: '101' },
      { id: 'ext-2', userId: 'user-2', extensionNumber: '102' },
    ] as ExtensionRecord[];

    expect(resolveMyExtension(extensions, 'user-1')?.id).toBe('ext-1');
  });

  it('formats platform labels', () => {
    expect(formatPlatformLabel('ios')).toBe('iOS');
    expect(formatPlatformLabel('android')).toBe('Android');
  });

  it('builds clipboard diagnostics report', () => {
    const report = formatDiagnosticsReport({
      status: liveStatus,
      diagnostics: { outboundReady: true, inboundRouting: { ready: true, sipUsername: 'u1' } },
      userEmail: 'user@example.com',
      extensionNumber: '101',
    });

    expect(report).toContain('SIP registration: Connected');
    expect(report).toContain('user@example.com');
    expect(report).toContain('Outbound ready: yes');
  });
});
