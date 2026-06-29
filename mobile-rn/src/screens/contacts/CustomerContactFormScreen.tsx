import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components';
import { useCustomerContactsStore } from '../../contacts/customerContactsStore';
import { useTheme } from '../../shared/theme';
import { spacing, tokens, typography } from '../../shared/theme';
import type { ContactsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ContactsStackParamList, 'CustomerContactForm'>;

export function CustomerContactFormScreen({ route, navigation }: Props) {
  const { customerId } = route.params;
  const { colors } = useTheme();
  const { items, hydrate, upsert } = useCustomerContactsStore();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void hydrate().finally(() => setReady(true));
  }, [hydrate]);

  useEffect(() => {
    if (!customerId) return;
    const existing = items.find((item) => item.id === customerId);
    if (!existing) return;
    setName(existing.name);
    setCompany(existing.company || '');
    setPhone(existing.phoneNumbers.join(', '));
    setEmail(existing.email || '');
    setNotes(existing.notes || '');
  }, [customerId, items]);

  if (!ready) return null;

  async function handleSave() {
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      const record = await upsert({
        id: customerId,
        name: name.trim(),
        company: company.trim() || undefined,
        phoneNumbers: phone.split(',').map((item) => item.trim()).filter(Boolean),
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      navigation.replace('CustomerContactDetail', { customerId: record.id });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>
        {customerId ? 'Edit customer' : 'New customer'}
      </Text>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Company" value={company} onChangeText={setCompany} />
      <Field label="Phone numbers" value={phone} onChangeText={setPhone} hint="Separate multiple numbers with commas" />
      <Field label="Email" value={email} onChangeText={setEmail} />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      <Button
        label={saving ? 'Saving…' : 'Save contact'}
        onPress={() => void handleSave()}
        disabled={saving || !name.trim() || !phone.trim()}
      />
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  hint,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  multiline?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholder={hint}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.title, marginBottom: spacing.sm },
  field: { gap: spacing.xs },
  label: { ...typography.caption, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
