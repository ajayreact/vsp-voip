import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { VspPanel } from '../../components';
import { SettingsGroup } from '../../components/ui/SettingsRow';
import { SettingsStatusRow } from '../../components/settings/SettingsStatusRow';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { useMyExtension } from '../../hooks/useMyExtension';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';
import type { YouStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<YouStackParamList, 'SettingsCalling'>;

export function SettingsCallingScreen(_props: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { extension, isLoading } = useMyExtension();
  const isAdmin = user?.role === 'TENANT_ADMIN' || user?.role === 'SUPER_ADMIN';

  if (isLoading) return <SkeletonList rows={5} />;

  const features = extension?.features;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        Calling preferences assigned to your extension. Changes require an administrator unless noted.
      </Text>

      <SettingsGroup>
        <SettingsStatusRow
          label="Call recording"
          value={features?.callRecordingEnabled ? 'Enabled' : 'Disabled'}
        />
        <SettingsStatusRow label="Caller ID" value={extension?.assignedDidNumber || '—'} />
        <SettingsStatusRow label="DND" value={features?.doNotDisturb ? 'On' : 'Off'} />
        <SettingsStatusRow label="Voicemail" value={features?.voicemailEnabled ? 'Enabled' : 'Disabled'} />
        <SettingsStatusRow label="Extension" value={extension?.extensionNumber || '—'} />
      </SettingsGroup>

      <VspPanel>
        <Text style={[styles.noteTitle, { color: colors.text }]}>Call forwarding & business hours</Text>
        <Text style={[styles.noteBody, { color: colors.textMuted }]}>
          {isAdmin
            ? 'Configure forwarding and business hours in the VSP web portal under Phone System.'
            : 'Contact your administrator to update call forwarding, business hours, or recording policies.'}
        </Text>
      </VspPanel>

      <VspPanel>
        <Text style={[styles.noteTitle, { color: colors.text }]}>Missing self-service API</Text>
        <Text style={[styles.noteBody, { color: colors.textMuted }]}>
          PATCH /api/tenant/extensions/:id/business requires TENANT_ADMIN. A mobile self-service endpoint would
          allow users to toggle DND and forwarding without admin role.
        </Text>
      </VspPanel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { ...typography.body },
  noteTitle: { ...typography.bodyMedium, fontWeight: '700', marginBottom: spacing.xs },
  noteBody: { ...typography.body },
});
