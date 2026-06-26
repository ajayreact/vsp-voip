import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.desc, { color: colors.textMuted }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
      />
    </View>
  );
}

export function NotificationsScreen() {
  const { colors } = useTheme();
  const prefs = useSettingsStore((s) => s.notificationPrefs);
  const setNotificationPrefs = useSettingsStore((s) => s.setNotificationPrefs);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        Notification delivery requires push setup in a future phase. Preferences are saved locally now.
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ToggleRow
          label="Push notifications"
          description="Enable mobile alerts"
          value={prefs.pushEnabled}
          onValueChange={(pushEnabled) => setNotificationPrefs({ pushEnabled })}
        />
        <ToggleRow
          label="Incoming calls"
          description="Alert for inbound calls"
          value={prefs.callAlerts}
          onValueChange={(callAlerts) => setNotificationPrefs({ callAlerts })}
        />
        <ToggleRow
          label="Messages"
          description="Alert for new SMS/MMS"
          value={prefs.messageAlerts}
          onValueChange={(messageAlerts) => setNotificationPrefs({ messageAlerts })}
        />
        <ToggleRow
          label="Voicemail"
          description="Alert for new voicemail"
          value={prefs.voicemailAlerts}
          onValueChange={(voicemailAlerts) => setNotificationPrefs({ voicemailAlerts })}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: {
    ...typography.body,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  rowText: { flex: 1 },
  label: { ...typography.body, fontWeight: '600' },
  desc: { ...typography.caption, marginTop: 2 },
});
