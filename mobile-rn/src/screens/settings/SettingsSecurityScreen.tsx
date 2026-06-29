import React, { useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SettingsGroup, SettingsRow } from '../../components/ui/SettingsRow';
import { SettingsToggleRow } from '../../components/settings/SettingsToggleRow';
import { authenticateWithBiometric } from '../../auth/biometricAuth';
import { saveAuthPreferences } from '../../auth/authPreferences';
import { useAuth } from '../../hooks/useAuth';
import { useAuthPreferences } from '../../hooks/useAuthPreferences';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<YouStackParamList, 'SettingsSecurity'>;

export function SettingsSecurityScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { logout } = useAuth();
  const { prefs, biometricLabel, biometricAvailable, updatePrefs } = useAuthPreferences();

  const toggleBiometric = useCallback(async (enabled: boolean) => {
    if (enabled) {
      const result = await authenticateWithBiometric(`Enable ${biometricLabel}`);
      if (!result.success) {
        Alert.alert(`${biometricLabel} unavailable`, 'Could not enable biometric unlock.');
        return;
      }
      await saveAuthPreferences({ biometricEnabled: true, biometricPrompted: true });
      await updatePrefs({ biometricEnabled: true, biometricPrompted: true });
      return;
    }
    await updatePrefs({ biometricEnabled: false });
  }, [biometricLabel, updatePrefs]);

  const toggleRememberMe = useCallback(
    async (rememberMe: boolean) => {
      await updatePrefs({ rememberMe });
    },
    [updatePrefs],
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        Protect access to your account on this device.
      </Text>

      <SettingsGroup>
        <SettingsToggleRow
          label={`${biometricLabel} login`}
          description={
            biometricAvailable
              ? 'Unlock the app with biometrics after sign-in'
              : 'Biometrics not available on this device'
          }
          value={Boolean(prefs?.biometricEnabled)}
          onValueChange={(value) => void toggleBiometric(value)}
          disabled={!biometricAvailable}
        />
        <SettingsToggleRow
          label="Remember me"
          description="Keep your session on this device after closing the app"
          value={prefs?.rememberMe ?? true}
          onValueChange={(value) => void toggleRememberMe(value)}
          last
        />
      </SettingsGroup>

      <Text style={[styles.section, { color: colors.textMuted }]}>Session</Text>
      <SettingsGroup>
        <SettingsRow
          title="Session timeout"
          subtitle="Managed by server refresh tokens"
          icon="time-outline"
          showChevron={false}
        />
        <SettingsRow
          title="Active devices"
          subtitle="View and remove signed-in phones"
          icon="phone-portrait-outline"
          onPress={() => navigation.navigate('SettingsDevices')}
        />
        <SettingsRow
          title="Change password"
          subtitle="Requires administrator or web portal"
          icon="key-outline"
          onPress={() => navigation.navigate('SettingsChangePassword')}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow title="Log out" icon="log-out-outline" destructive showChevron={false} onPress={() => logout()} />
      </SettingsGroup>

      {!prefs?.biometricEnabled && biometricAvailable ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Tip: enable {biometricLabel} for faster unlock after the first sign-in.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  intro: { ...typography.body, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  section: { ...typography.label, marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
  hint: { ...typography.caption, paddingHorizontal: spacing.lg, marginTop: spacing.md },
});
