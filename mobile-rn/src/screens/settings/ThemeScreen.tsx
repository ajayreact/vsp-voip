import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeMode } from '../../shared/theme';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

const options: { mode: ThemeMode; label: string; description: string }[] = [
  { mode: 'dark', label: 'Dark', description: 'VSP default — slate and indigo' },
  { mode: 'light', label: 'Light', description: 'Bright surfaces for daylight use' },
  { mode: 'system', label: 'System', description: 'Follow device appearance' },
];

export function ThemeScreen() {
  const { colors } = useTheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        Choose how VSP Phone looks on this device.
      </Text>
      {options.map((option) => {
        const selected = themeMode === option.mode;
        return (
          <Pressable
            key={option.mode}
            onPress={() => setThemeMode(option.mode)}
            style={[
              styles.option,
              {
                backgroundColor: selected ? `${colors.primary}18` : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
          >
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
              <Text style={[styles.optionDesc, { color: colors.textMuted }]}>{option.description}</Text>
            </View>
            {selected ? <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  intro: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { ...typography.body, fontWeight: '600' },
  optionDesc: { ...typography.caption },
});
