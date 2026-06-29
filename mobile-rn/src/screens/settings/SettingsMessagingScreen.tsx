import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SettingsGroup } from '../../components/ui/SettingsRow';
import { SettingsToggleRow } from '../../components/settings/SettingsToggleRow';
import { SettingsRow } from '../../components/ui/SettingsRow';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<YouStackParamList, 'SettingsMessaging'>;

export function SettingsMessagingScreen(_props: Props) {
  const { colors } = useTheme();
  const messageAlerts = useSettingsStore((s) => s.notificationPrefs.messageAlerts);
  const setNotificationPrefs = useSettingsStore((s) => s.setNotificationPrefs);
  const clientPrefs = useSettingsStore((s) => s.clientPrefs);
  const setClientPrefs = useSettingsStore((s) => s.setClientPrefs);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        SMS notification and delivery preferences on this device.
      </Text>

      <SettingsGroup>
        <SettingsToggleRow
          label="SMS notifications"
          description="Alert for new text messages"
          value={messageAlerts}
          onValueChange={(messageAlerts) => setNotificationPrefs({ messageAlerts })}
        />
        <SettingsToggleRow
          label="Delivery reports"
          description="Show delivery status when supported"
          value={clientPrefs.messagingDeliveryReports}
          onValueChange={(messagingDeliveryReports) => setClientPrefs({ messagingDeliveryReports })}
          last
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          title="Message signature"
          subtitle="Coming soon — compose signature for outbound SMS"
          icon="create-outline"
          showChevron={false}
        />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { ...typography.body },
});
