import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../../components';
import { SettingsGroup, SettingsRow } from '../../components/ui/SettingsRow';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<YouStackParamList, 'YouHome'>;

export function YouScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const unreadVm = useAppStore((s) => s.dashboardStats?.unreadVoicemailCount ?? 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.profileHeader, { backgroundColor: colors.surface }]}>
        <Avatar name={user?.name || 'User'} size={72} />
        <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {user?.tenantName || user?.email}
        </Text>
      </View>

      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>Account</Text>
      <SettingsGroup>
        <SettingsRow title="Profile" subtitle="Your account details" icon="person-outline" onPress={() => navigation.navigate('Profile')} />
        <SettingsRow title="Organization" subtitle="Company settings" icon="business-outline" onPress={() => navigation.navigate('Organization')} />
        <SettingsRow title="Extensions" subtitle="Directory & extensions" icon="git-network-outline" onPress={() => navigation.navigate('Extensions')} />
        <SettingsRow title="SIP Configuration" subtitle="Enterprise softphone settings" icon="settings-outline" onPress={() => navigation.navigate('SipConfiguration')} />
        <SettingsRow title="Numbers" subtitle="Phone numbers" icon="call-outline" onPress={() => navigation.navigate('Numbers')} />
      </SettingsGroup>

      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>Preferences</Text>
      <SettingsGroup>
        <SettingsRow title="Notifications" subtitle="Alerts & push settings" icon="notifications-outline" onPress={() => navigation.navigate('Notifications')} />
        <SettingsRow
          title="Voicemail"
          subtitle={unreadVm > 0 ? `${unreadVm} unread` : 'Listen to messages'}
          icon="recording-outline"
          onPress={() => navigation.navigate('VoicemailList')}
        />
        <SettingsRow title="About" subtitle="Version & support" icon="information-circle-outline" onPress={() => navigation.navigate('About')} />
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
    borderBottomColor: '#E5E7EB',
  },
  name: { ...typography.title },
  sub: { ...typography.body },
  groupLabel: { ...typography.label, marginHorizontal: spacing.lg, marginBottom: spacing.sm, marginTop: spacing.md },
});
