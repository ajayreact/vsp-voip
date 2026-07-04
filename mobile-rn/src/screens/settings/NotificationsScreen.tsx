import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SettingsGroup } from '../../components/ui/SettingsRow';
import { SettingsToggleRow } from '../../components/settings/SettingsToggleRow';
import { SettingsStatusRow } from '../../components/settings/SettingsStatusRow';
import { useSettingsStore } from '../../store/settingsStore';
import { usePushRegistrationStore } from '../../notifications';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<YouStackParamList, 'Notifications'>;

export function NotificationsScreen(_props: Props) {
  const { colors } = useTheme();
  const prefs = useSettingsStore((s) => s.notificationPrefs);
  const setNotificationPrefs = useSettingsStore((s) => s.setNotificationPrefs);
  const pushStatus = usePushRegistrationStore((s) => s.status);
  const pushError = usePushRegistrationStore((s) => s.lastError);
  const pushPreview = usePushRegistrationStore((s) => s.tokenPreview);

  const pushStatusLabel = {
    idle: 'Initializing…',
    registering: 'Registering…',
    registered: pushPreview ? `Registered (${pushPreview})` : 'Registered',
    unavailable: 'Unavailable — rebuild with Firebase / VoIP credentials',
    error: pushError || 'Registration failed',
  }[pushStatus];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        Choose which alerts this device should show and play.
      </Text>

      <SettingsGroup>
        <SettingsStatusRow label="Push delivery" value={pushStatusLabel} />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsToggleRow
          label="Push notifications"
          description="Master switch for mobile alerts"
          value={prefs.pushEnabled}
          onValueChange={(pushEnabled) => setNotificationPrefs({ pushEnabled })}
        />
        <SettingsToggleRow
          label="Incoming calls"
          description="Alert for inbound calls"
          value={prefs.callAlerts}
          onValueChange={(callAlerts) => setNotificationPrefs({ callAlerts })}
        />
        <SettingsToggleRow
          label="Messages"
          description="Alert for new SMS/MMS"
          value={prefs.messageAlerts}
          onValueChange={(messageAlerts) => setNotificationPrefs({ messageAlerts })}
        />
        <SettingsToggleRow
          label="Voicemail"
          description="Alert for new voicemail"
          value={prefs.voicemailAlerts}
          onValueChange={(voicemailAlerts) => setNotificationPrefs({ voicemailAlerts })}
        />
        <SettingsToggleRow
          label="System"
          description="Registration and system notices"
          value={prefs.systemAlerts}
          onValueChange={(systemAlerts) => setNotificationPrefs({ systemAlerts })}
          last
        />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  intro: { ...typography.body, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
});
