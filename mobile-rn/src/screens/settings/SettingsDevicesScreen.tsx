import React, { useCallback, useEffect, useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Button, EmptyState } from '../../components';
import { SettingsGroup } from '../../components/ui/SettingsRow';
import { FriendlyError } from '../../components/ui/FriendlyError';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { formatPlatformLabel } from '../../settings/diagnosticsFormat';
import type { SoftphoneDevice } from '../../settings/types';
import { useSoftphoneDevices, useRemoveSoftphoneDevice } from '../../hooks/useSoftphoneDevices';
import { getDeviceId, registerPushWithBackend } from '../../notifications/pushTokenService';
import { useCallingStore } from '../../store/callingStore';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../shared/theme';
import { formatRelativeTime } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<YouStackParamList, 'SettingsDevices'>;

export function SettingsDevicesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { logout } = useAuth();
  const { data: devices = [], isLoading, error, refetch, isRefetching } = useSoftphoneDevices();
  const removeDevice = useRemoveSoftphoneDevice();
  const [currentDeviceId, setCurrentDeviceId] = React.useState<string | null>(null);

  useEffect(() => {
    void getDeviceId().then(setCurrentDeviceId);
  }, []);

  const sorted = useMemo(
    () =>
      [...devices].sort(
        (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
      ),
    [devices],
  );

  const currentDevice = useMemo(
    () => sorted.find((device) => device.deviceId === currentDeviceId),
    [currentDeviceId, sorted],
  );

  const otherDevices = useMemo(
    () => sorted.filter((device) => device.deviceId !== currentDeviceId),
    [currentDeviceId, sorted],
  );

  const refreshRegistration = useCallback(async () => {
    await registerPushWithBackend();
    useCallingStore.getState().bumpPushTokenSync();
    await refetch();
    Alert.alert(
      'Registration refreshed',
      'Push registration was updated. SIP status reflects your live connection.',
    );
  }, [refetch]);

  const confirmRemove = useCallback(
    (device: SoftphoneDevice, isCurrent: boolean) => {
      const label = device.deviceName || formatPlatformLabel(device.platform);
      Alert.alert(
        isCurrent ? 'Log out this device?' : 'Remove device',
        isCurrent ? 'This will sign you out on this phone.' : `Remove ${label} from your account?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: isCurrent ? 'Log out' : 'Remove',
            style: 'destructive',
            onPress: () => {
              void removeDevice.mutateAsync(device.deviceId).then(() => {
                if (isCurrent) void logout();
              });
            },
          },
        ],
      );
    },
    [logout, removeDevice],
  );

  if (isLoading) return <SkeletonList rows={4} />;
  if (error) {
    return (
      <FriendlyError
        title="Couldn't load devices"
        message={error instanceof Error ? error.message : 'Unknown error'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        Devices registered for push and softphone delivery on your account.
      </Text>

      <View style={styles.actions}>
        <Button label="Refresh registration" variant="secondary" onPress={() => void refreshRegistration()} />
        <Button
          label="Re-provision with QR"
          variant="secondary"
          onPress={() => navigation.navigate('QrProvision')}
        />
      </View>

      <Text style={[styles.section, { color: colors.textMuted }]}>This device</Text>
      <SettingsGroup>
        {currentDevice ? (
          <DeviceCard
            device={currentDevice}
            isCurrent
            onAction={() => confirmRemove(currentDevice, true)}
          />
        ) : (
          <View style={styles.emptyCurrent}>
            <Text style={{ color: colors.textMuted }}>This device is not registered yet.</Text>
          </View>
        )}
      </SettingsGroup>

      <Text style={[styles.section, { color: colors.textMuted }]}>Other devices</Text>
      {otherDevices.length === 0 ? (
        <EmptyState icon="📱" title="No other devices" message="Other signed-in phones will appear here." />
      ) : (
        <SettingsGroup>
          {otherDevices.map((device) => (
            <DeviceCard
              key={device.deviceId}
              device={device}
              onAction={() => confirmRemove(device, false)}
            />
          ))}
        </SettingsGroup>
      )}

      {isRefetching ? (
        <Text style={[styles.syncNote, { color: colors.textMuted }]}>Updating device list…</Text>
      ) : null}
    </ScrollView>
  );
}

function DeviceCard({
  device,
  isCurrent,
  onAction,
}: {
  device: SoftphoneDevice;
  isCurrent?: boolean;
  onAction: () => void;
}) {
  const { colors } = useTheme();
  const name = device.deviceName || formatPlatformLabel(device.platform);
  return (
    <View style={[styles.card, { borderBottomColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.deviceIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.deviceName, { color: colors.text }]}>
            {name}
            {isCurrent ? ' · Current' : ''}
          </Text>
          <Text style={[styles.deviceMeta, { color: colors.textMuted }]}>
            {formatPlatformLabel(device.platform)} · Last active {formatRelativeTime(device.lastSeenAt)}
          </Text>
          <Text style={[styles.deviceMeta, { color: colors.textMuted }]}>
            App {device.appVersion || '—'} · Push registered
          </Text>
        </View>
      </View>
      <Pressable onPress={onAction} style={styles.actionBtn}>
        <Text style={[styles.actionLabel, { color: colors.error }]}>
          {isCurrent ? 'Log out this device' : 'Remove device'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { ...typography.body },
  actions: { gap: spacing.sm },
  section: { ...typography.label, marginTop: spacing.sm },
  emptyCurrent: { padding: spacing.lg },
  syncNote: { ...typography.caption, textAlign: 'center' },
  card: {
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  deviceName: { ...typography.bodyMedium, fontWeight: '700' },
  deviceMeta: { ...typography.caption },
  actionBtn: { minHeight: 44, justifyContent: 'center' },
  actionLabel: { ...typography.bodyMedium, fontWeight: '600' },
});
