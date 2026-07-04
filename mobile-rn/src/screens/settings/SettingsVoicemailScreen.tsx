import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SettingsGroup } from '../../components/ui/SettingsRow';
import { SettingsToggleRow } from '../../components/settings/SettingsToggleRow';
import { SettingsRow } from '../../components/ui/SettingsRow';
import { useSettingsStore, type VoicemailPlaybackSpeed } from '../../store/settingsStore';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<YouStackParamList, 'SettingsVoicemail'>;

const SPEEDS: { value: VoicemailPlaybackSpeed; label: string }[] = [
  { value: '0.75', label: '0.75×' },
  { value: '1', label: '1×' },
  { value: '1.25', label: '1.25×' },
  { value: '1.5', label: '1.5×' },
];

export function SettingsVoicemailScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const clientPrefs = useSettingsStore((s) => s.clientPrefs);
  const setClientPrefs = useSettingsStore((s) => s.setClientPrefs);
  const voicemailAlerts = useSettingsStore((s) => s.notificationPrefs.voicemailAlerts);
  const setNotificationPrefs = useSettingsStore((s) => s.setNotificationPrefs);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        Voicemail playback and notification preferences on this device.
      </Text>

      <Text style={[styles.section, { color: colors.textMuted }]}>Playback speed</Text>
      <View style={[styles.speedRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {SPEEDS.map((speed) => {
          const selected = clientPrefs.voicemailPlaybackSpeed === speed.value;
          return (
            <Pressable
              key={speed.value}
              onPress={() => setClientPrefs({ voicemailPlaybackSpeed: speed.value })}
              style={[
                styles.speedChip,
                {
                  backgroundColor: selected ? colors.primary : colors.backgroundAlt,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '700' }}>{speed.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <SettingsGroup>
        <SettingsToggleRow
          label="Auto-download recordings"
          description="Cache voicemail audio when opened"
          value={clientPrefs.voicemailAutoDownload}
          onValueChange={(voicemailAutoDownload) => setClientPrefs({ voicemailAutoDownload })}
        />
        <SettingsToggleRow
          label="Voicemail notifications"
          description="Alert when new voicemail arrives"
          value={voicemailAlerts}
          onValueChange={(voicemailAlerts) => setNotificationPrefs({ voicemailAlerts })}
          last
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          title="Greeting"
          subtitle="Managed by your phone system administrator"
          icon="mic-outline"
          showChevron={false}
        />
        <SettingsRow
          title="Open voicemail"
          subtitle="Listen to messages"
          icon="recording-outline"
          onPress={() => navigation.navigate('VoicemailList')}
        />
      </SettingsGroup>

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        VSP Call Insight, VSP Voicemail Insight, and transcripts appear on voicemail detail screens.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { ...typography.body },
  section: { ...typography.label },
  speedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  speedChip: {
    minWidth: 64,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  hint: { ...typography.caption },
});
