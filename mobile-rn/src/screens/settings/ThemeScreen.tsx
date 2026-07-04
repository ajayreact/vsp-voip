import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SettingsGroup } from '../../components/ui/SettingsRow';
import { useSettingsStore, type FontSizePreference } from '../../store/settingsStore';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<YouStackParamList, 'Theme'>;

const FONT_OPTIONS: { value: FontSizePreference; label: string; sample: number }[] = [
  { value: 'default', label: 'Default', sample: 16 },
  { value: 'large', label: 'Large', sample: 18 },
  { value: 'extraLarge', label: 'Extra large', sample: 20 },
];

export function ThemeScreen(_props: Props) {
  const { colors } = useTheme();
  const clientPrefs = useSettingsStore((s) => s.clientPrefs);
  const setClientPrefs = useSettingsStore((s) => s.setClientPrefs);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Appearance</Text>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        VSP Phone uses a light enterprise theme with high-contrast typography.
      </Text>

      <Text style={[styles.section, { color: colors.textMuted }]}>Theme</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Light</Text>
        <Text style={[styles.cardSub, { color: colors.textMuted }]}>Professional light theme (default)</Text>
      </View>

      <Text style={[styles.section, { color: colors.textMuted }]}>Font size</Text>
      <SettingsGroup>
        {FONT_OPTIONS.map((option, index) => {
          const selected = clientPrefs.fontSize === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setClientPrefs({ fontSize: option.value })}
              style={[
                styles.fontRow,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: index === FONT_OPTIONS.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                },
              ]}
            >
              <Text style={[styles.fontLabel, { color: colors.text, fontSize: option.sample }]}>
                {option.label}
              </Text>
              {selected ? (
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Selected</Text>
              ) : null}
            </Pressable>
          );
        })}
      </SettingsGroup>

      <Text style={[styles.section, { color: colors.textMuted }]}>Language</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>English</Text>
        <Text style={[styles.cardSub, { color: colors.textMuted }]}>Additional languages coming soon</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.title },
  intro: { ...typography.body },
  section: { ...typography.label, marginTop: spacing.sm },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardTitle: { ...typography.bodyMedium, fontWeight: '700' },
  cardSub: { ...typography.caption },
  fontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  fontLabel: { ...typography.bodyMedium, fontWeight: '600' },
});
