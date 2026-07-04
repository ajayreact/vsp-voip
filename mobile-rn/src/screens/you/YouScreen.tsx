import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../../components';
import { ConnectionBadge } from '../../components/ui/ConnectionBadge';
import { SettingsGroup, SettingsRow } from '../../components/ui/SettingsRow';
import { useAuth } from '../../hooks/useAuth';
import { useCallerProfile } from '../../hooks/useCallerProfile';
import { useLiveSettingsStatus } from '../../hooks/useLiveSettingsStatus';
import { useMyExtension } from '../../hooks/useMyExtension';
import { usePhoneConnection } from '../../hooks/usePhoneConnection';
import { useSettingsStore } from '../../store/settingsStore';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../shared/theme';
import { formatPhone } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<YouStackParamList, 'YouHome'>;

function SectionLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{children}</Text>;
}

export function YouScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const profile = useCallerProfile();
  const { extension } = useMyExtension();
  const live = useLiveSettingsStatus();
  const { canPlaceCalls } = usePhoneConnection();
  const unreadVm = useAppStore((s) => s.dashboardStats?.unreadVoicemailCount ?? 0);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const { colors } = useTheme();

  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  const businessDid = extension?.assignedDidNumber || profile.businessDid;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.profileHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Avatar name={user?.name || 'User'} size={72} />
        <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {user?.tenantName || user?.email}
        </Text>
        {extension?.extensionNumber ? (
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Ext {extension.extensionNumber}
            {businessDid ? ` · ${formatPhone(businessDid)}` : ''}
          </Text>
        ) : null}
        <ConnectionBadge connected={canPlaceCalls} label={profile.registrationLabel} />
      </View>

      <SectionLabel>Account</SectionLabel>
      <SettingsGroup>
        <SettingsRow title="Profile" subtitle="Name, email, role" icon="person-outline" onPress={() => navigation.navigate('Profile')} />
        <SettingsRow title="Company" subtitle={user?.tenantName || 'Organization'} icon="business-outline" onPress={() => navigation.navigate('Organization')} />
        <SettingsRow title="Extension" subtitle={extension?.extensionNumber ? `Ext ${extension.extensionNumber}` : 'Not assigned'} icon="git-network-outline" onPress={() => navigation.navigate('Extensions')} />
        <SettingsRow title="Business DID" subtitle={businessDid ? formatPhone(businessDid) : 'Not assigned'} icon="call-outline" onPress={() => navigation.navigate('Numbers')} />
      </SettingsGroup>

      <SectionLabel>Phone system</SectionLabel>
      <SettingsGroup>
        <SettingsRow title="SIP registration" subtitle={live.sipRegistration} icon="radio-outline" onPress={() => navigation.navigate('SettingsDiagnostics')} />
        <SettingsRow title="QR provisioning" subtitle="Scan to provision this device" icon="qr-code-outline" onPress={() => navigation.navigate('QrProvision')} />
        <SettingsRow title="SIP configuration" subtitle="Enterprise softphone settings" icon="settings-outline" onPress={() => navigation.navigate('SipConfiguration')} />
        <SettingsRow title="Devices" subtitle="Manage registered phones" icon="phone-portrait-outline" onPress={() => navigation.navigate('SettingsDevices')} />
        <SettingsRow title="Device information" subtitle="This installation" icon="hardware-chip-outline" onPress={() => navigation.navigate('SettingsDeviceInfo')} />
      </SettingsGroup>

      <SectionLabel>Calling</SectionLabel>
      <SettingsGroup>
        <SettingsRow title="Calling preferences" subtitle="Recording, DND, caller ID" icon="call-outline" onPress={() => navigation.navigate('SettingsCalling')} />
      </SettingsGroup>

      <SectionLabel>Voicemail</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          title="Voicemail inbox"
          subtitle={unreadVm > 0 ? `${unreadVm} unread` : 'Listen to messages'}
          icon="recording-outline"
          onPress={() => navigation.navigate('VoicemailList')}
        />
        <SettingsRow title="Voicemail settings" subtitle="Playback, notifications" icon="options-outline" onPress={() => navigation.navigate('SettingsVoicemail')} />
      </SettingsGroup>

      <SectionLabel>Messaging</SectionLabel>
      <SettingsGroup>
        <SettingsRow title="SMS settings" subtitle="Notifications and delivery" icon="chatbubble-ellipses-outline" onPress={() => navigation.navigate('SettingsMessaging')} />
      </SettingsGroup>

      <SectionLabel>Notifications</SectionLabel>
      <SettingsGroup>
        <SettingsRow title="Notification preferences" subtitle="Calls, messages, voicemail" icon="notifications-outline" onPress={() => navigation.navigate('Notifications')} />
      </SettingsGroup>

      <SectionLabel>Security</SectionLabel>
      <SettingsGroup>
        <SettingsRow title="Security & login" subtitle="Biometrics, sessions, password" icon="lock-closed-outline" onPress={() => navigation.navigate('SettingsSecurity')} />
      </SettingsGroup>

      <SectionLabel>Appearance</SectionLabel>
      <SettingsGroup>
        <SettingsRow title="Appearance" subtitle="Theme, font size, language" icon="color-palette-outline" onPress={() => navigation.navigate('Theme')} />
      </SettingsGroup>

      <SectionLabel>Diagnostics</SectionLabel>
      <SettingsGroup>
        <SettingsRow title="Diagnostics" subtitle={`Push: ${live.pushRegistration}`} icon="pulse-outline" onPress={() => navigation.navigate('SettingsDiagnostics')} />
      </SettingsGroup>

      <SectionLabel>Support</SectionLabel>
      <SettingsGroup>
        <SettingsRow title="Help & support" subtitle="Help center, legal, contact" icon="help-buoy-outline" onPress={() => navigation.navigate('SettingsSupport')} />
      </SettingsGroup>

      <View style={{ marginTop: spacing.lg, marginBottom: spacing.xxl }}>
        <SettingsGroup>
          <SettingsRow title="Log out" icon="log-out-outline" onPress={() => logout()} destructive showChevron={false} />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { ...typography.title },
  sub: { ...typography.body },
  meta: { ...typography.caption, fontWeight: '600' },
  groupLabel: {
    ...typography.label,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
});
