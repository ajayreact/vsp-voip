import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { VspPanel } from '../../components';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<YouStackParamList, 'SettingsChangePassword'>;

export function SettingsChangePasswordScreen(_props: Props) {
  const { colors } = useTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <VspPanel>
        <Text style={[styles.title, { color: colors.text }]}>Change password</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          VSP Phone does not expose an authenticated change-password API. Password updates are handled through:
        </Text>
        <Text style={[styles.listItem, { color: colors.text }]}>• Your organization administrator</Text>
        <Text style={[styles.listItem, { color: colors.text }]}>• The web portal forgot-password flow</Text>
      </VspPanel>

      <VspPanel>
        <Text style={[styles.subtitle, { color: colors.text }]}>Missing backend capability</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Recommended enhancement: POST /api/auth/change-password with current and new password for signed-in users.
        </Text>
      </VspPanel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  title: { ...typography.title, marginBottom: spacing.sm },
  subtitle: { ...typography.bodyMedium, fontWeight: '700', marginBottom: spacing.xs },
  body: { ...typography.body },
  listItem: { ...typography.body, marginTop: spacing.xs },
});
