import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SettingsGroup } from '../../components/ui/SettingsRow';
import { SettingsStatusRow } from '../../components/settings/SettingsStatusRow';
import { getDeviceId } from '../../notifications/pushTokenService';
import { loadStoredSipProfile } from '../../sip/storage';
import { usePushRegistrationStore } from '../../notifications/pushTokenService';
import { usePhoneConnection } from '../../hooks/usePhoneConnection';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<YouStackParamList, 'SettingsDeviceInfo'>;

export function SettingsDeviceInfoScreen(_props: Props) {
  const { colors } = useTheme();
  const { label: registrationLabel } = usePhoneConnection();
  const pushStatus = usePushRegistrationStore((s) => s.status);
  const [deviceId, setDeviceId] = useState('—');
  const [sipUser, setSipUser] = useState('—');

  useEffect(() => {
    void getDeviceId().then(setDeviceId);
    void loadStoredSipProfile().then((profile) => {
      setSipUser(profile?.sipUsername || profile?.extension || '—');
    });
  }, []);

  const version = Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0';
  const build = Application.nativeBuildVersion || 'dev';
  const model = Constants.deviceName || Platform.OS;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        Information about this installation and telephony registration.
      </Text>

      <SettingsGroup>
        <SettingsStatusRow label="Device name" value={model} />
        <SettingsStatusRow label="Platform" value={Platform.OS === 'ios' ? 'iOS' : 'Android'} />
        <SettingsStatusRow label="Device ID" value={deviceId} />
        <SettingsStatusRow label="App version" value={version} />
        <SettingsStatusRow label="Build" value={build} />
        <SettingsStatusRow label="SIP user" value={sipUser} />
        <SettingsStatusRow label="Registration" value={registrationLabel} />
        <SettingsStatusRow label="Push status" value={pushStatus} />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { ...typography.body },
});
