import React from 'react';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SettingsGroup, SettingsRow } from '../../components/ui/SettingsRow';
import { env } from '../../shared/config/env';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<YouStackParamList, 'SettingsSupport'>;

const SUPPORT_EMAIL = 'support@vspphone.com';

export function SettingsSupportScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const portalBase = env.apiBaseUrl.replace(/\/api\/?$/, '');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        Help, legal, and contact options for your organization.
      </Text>

      <SettingsGroup>
        <SettingsRow
          title="Help center"
          subtitle="Product documentation"
          icon="help-circle-outline"
          onPress={() => void Linking.openURL(`${portalBase}/help`).catch(() => {})}
        />
        <SettingsRow
          title="Privacy policy"
          icon="shield-outline"
          onPress={() => void Linking.openURL(`${portalBase}/privacy`).catch(() => {})}
        />
        <SettingsRow
          title="Terms of service"
          icon="document-text-outline"
          onPress={() => void Linking.openURL(`${portalBase}/terms`).catch(() => {})}
        />
        <SettingsRow
          title="Contact support"
          subtitle={SUPPORT_EMAIL}
          icon="mail-outline"
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
        />
        <SettingsRow
          title="About VSP Phone"
          icon="information-circle-outline"
          onPress={() => navigation.navigate('About')}
        />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.md, paddingBottom: spacing.xxl },
  intro: { ...typography.body, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
});
