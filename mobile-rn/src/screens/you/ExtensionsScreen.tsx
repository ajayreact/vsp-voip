import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../../components';
import { SettingsGroup, SettingsRow } from '../../components/ui/SettingsRow';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

export function ExtensionsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<YouStackParamList>>();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.lead, { color: colors.textMuted }]}>
        Configure desk phone and softphone SIP settings for Telnyx. TLS on port 5061 is recommended for enterprise deployments.
      </Text>

      <SettingsGroup>
        <SettingsRow
          title="SIP Configuration"
          subtitle="Account, server, codecs, security"
          icon="call-outline"
          onPress={() => navigation.navigate('SipConfiguration')}
        />
      </SettingsGroup>

      <View style={styles.actions}>
        <Button
          label="Open contacts directory"
          variant="secondary"
          onPress={() => navigation.getParent()?.navigate('Contacts')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  lead: { ...typography.body },
  actions: { marginTop: spacing.md },
});
