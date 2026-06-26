import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ExtensionRecord } from '../../api/types';
import { Avatar, Button, ErrorScreen, LoadingScreen } from '../../components';
import { fetchContactDetail, mapExtensionToContact } from '../../contacts';
import type { ContactsStackParamList } from '../../navigation/types';
import { useFavoritesStore } from '../../store/favoritesStore';
import { useTheme } from '../../shared/theme';
import { formatPhone, roleLabel } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<ContactsStackParamList, 'ContactDetail'>;

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export function ContactDetailScreen({ route }: Props) {
  const { contactId } = route.params;
  const { colors } = useTheme();
  const { isFavorite, toggleFavorite, hydrate } = useFavoritesStore();
  const [extension, setExtension] = useState<ExtensionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContactDetail(contactId);
      setExtension(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    hydrate();
    load();
  }, [hydrate, load]);

  if (loading) return <LoadingScreen message="Loading contact…" />;
  if (error || !extension) {
    return <ErrorScreen message={error || 'Contact not found'} onRetry={load} />;
  }

  const contact = mapExtensionToContact(extension);
  const favorite = isFavorite(contact.id);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Avatar name={contact.name} size={72} online={contact.isOnline} />
        <Text style={[styles.name, { color: colors.text }]}>{contact.name}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Extension {contact.extensionNumber}
          {contact.department ? ` · ${contact.department}` : ''}
        </Text>
        <Button
          label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          variant={favorite ? 'secondary' : 'primary'}
          onPress={() => toggleFavorite(contact.id)}
          style={styles.favButton}
        />
        <Text style={[styles.comingSoon, { color: colors.textMuted }]}>
          Call and message actions will be enabled in upcoming phases.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <DetailRow label="Status" value={extension.status} />
        <DetailRow label="Email" value={contact.email || '—'} />
        <DetailRow
          label="Direct number"
          value={contact.assignedDidNumber ? formatPhone(contact.assignedDidNumber) : '—'}
        />
        <DetailRow label="Online" value={contact.isOnline ? 'Yes' : 'No'} />
        {extension.user ? (
          <DetailRow label="Linked user" value={`${extension.user.name} (${roleLabel('TENANT_USER')})`} />
        ) : null}
        {extension.features ? (
          <>
            <DetailRow label="Voicemail" value={extension.features.voicemailEnabled ? 'Enabled' : 'Disabled'} />
            <DetailRow label="Do not disturb" value={extension.features.doNotDisturb ? 'On' : 'Off'} />
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: { ...typography.title, marginTop: spacing.sm },
  subtitle: { ...typography.body, textAlign: 'center' },
  favButton: { marginTop: spacing.sm, alignSelf: 'stretch' },
  comingSoon: { ...typography.caption, textAlign: 'center', marginTop: spacing.xs },
  detailRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  detailLabel: { ...typography.body, flex: 1 },
  detailValue: { ...typography.body, fontWeight: '600', flex: 1, textAlign: 'right' },
});
