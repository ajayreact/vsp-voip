import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components';
import { SettingsGroup } from '../../components/ui/SettingsRow';
import { SettingsStatusRow } from '../../components/settings/SettingsStatusRow';
import { FriendlyError } from '../../components/ui/FriendlyError';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { formatDiagnosticsReport } from '../../settings/diagnosticsFormat';
import { useSettingsDiagnostics } from '../../hooks/useSettingsDiagnostics';
import { useLiveSettingsStatus } from '../../hooks/useLiveSettingsStatus';
import { useMyExtension } from '../../hooks/useMyExtension';
import { useAuth } from '../../hooks/useAuth';
import { getDeviceId } from '../../notifications/pushTokenService';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<YouStackParamList, 'SettingsDiagnostics'>;

export function SettingsDiagnosticsScreen(_props: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const live = useLiveSettingsStatus();
  const { extension } = useMyExtension();
  const { data, isLoading, error, refetch, isRefetching } = useSettingsDiagnostics();
  const [deviceId, setDeviceId] = useState('—');

  useEffect(() => {
    void getDeviceId().then((id) => setDeviceId(id));
  }, []);

  const copyDiagnostics = useCallback(async () => {
    const report = formatDiagnosticsReport({
      status: live,
      diagnostics: data,
      userEmail: user?.email,
      tenantName: user?.tenantName || undefined,
      extensionNumber: extension?.extensionNumber,
    });
    await Clipboard.setStringAsync(
      `${report}\n\nDevice ID: ${deviceId}\nPlatform: ${Platform.OS}`,
    );
    setTimeout(() => {
      void Clipboard.setStringAsync('');
    }, 60_000);
    Alert.alert('Copied', 'Diagnostics copied to clipboard. It will clear automatically in one minute.');
  }, [data, deviceId, extension?.extensionNumber, live, user?.email, user?.tenantName]);

  if (isLoading && !data) return <SkeletonList rows={8} />;

  const sipTone =
    live.sipRegistration === 'Connected'
      ? 'success'
      : live.network === 'Offline'
        ? 'error'
        : 'warning';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {error ? (
        <FriendlyError
          title="Server diagnostics unavailable"
          message={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      ) : null}

      <Text style={[styles.intro, { color: colors.textMuted }]}>
        Live client and server health for troubleshooting with your IT team.
      </Text>

      <SettingsGroup>
        <SettingsStatusRow label="SIP registration" value={live.sipRegistration} tone={sipTone} />
        <SettingsStatusRow label="Push registration" value={live.pushRegistration} />
        <SettingsStatusRow label="Network" value={live.network} tone={live.network === 'Online' ? 'success' : 'error'} />
        <SettingsStatusRow label="Audio route" value={live.audioRoute} />
        <SettingsStatusRow label="App version" value={live.appVersion} />
        <SettingsStatusRow label="Build" value={live.buildNumber} />
        <SettingsStatusRow label="API environment" value={live.apiEnvironment} />
        <SettingsStatusRow label="Device ID" value={deviceId} />
      </SettingsGroup>

      {data ? (
        <SettingsGroup>
          <SettingsStatusRow
            label="Outbound ready"
            value={data.outboundReady ? 'Yes' : 'No'}
            tone={data.outboundReady ? 'success' : 'warning'}
          />
          <SettingsStatusRow
            label="Inbound ready"
            value={data.inboundRouting?.ready ? 'Yes' : 'No'}
            tone={data.inboundRouting?.ready ? 'success' : 'warning'}
          />
          <SettingsStatusRow label="SIP username" value={data.inboundRouting?.sipUsername || '—'} />
          <SettingsStatusRow
            label="Registered devices"
            value={String(data.push?.userDevices?.count ?? 0)}
          />
          {data.fix ? <SettingsStatusRow label="Suggested fix" value={data.fix} tone="warning" /> : null}
        </SettingsGroup>
      ) : null}

      <View style={styles.actions}>
        <Button label="Copy diagnostics" variant="primary" onPress={() => void copyDiagnostics()} />
        <Button
          label={isRefetching ? 'Refreshing…' : 'Refresh'}
          variant="secondary"
          onPress={() => refetch()}
          disabled={isRefetching}
        />
      </View>

      <Text style={[styles.note, { color: colors.textMuted }]}>
        Export logs will be available in a future update. Use Copy diagnostics when contacting support.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { ...typography.body },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  note: { ...typography.caption, textAlign: 'center' },
});
