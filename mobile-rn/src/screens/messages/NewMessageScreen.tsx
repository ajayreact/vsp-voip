import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, TextField, VspPanel } from '../../components';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

/** Compose UI — send wiring completes in messaging phase */
export function NewMessageScreen() {
  const { colors } = useTheme();
  const [to, setTo] = useState('');
  const [from, setFrom] = useState('');
  const [body, setBody] = useState('');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <VspPanel>
        <Text style={[styles.heading, { color: colors.text }]}>New message</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Send from an assigned organization line to an external number.
        </Text>
        <TextField label="To" value={to} onChangeText={setTo} keyboardType="phone-pad" placeholder="+1…" />
        <TextField label="From (your line)" value={from} onChangeText={setFrom} keyboardType="phone-pad" />
        <TextField
          label="Message"
          value={body}
          onChangeText={setBody}
          multiline
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
        <Button label="Send message" disabled={!to || !from || !body.trim()} onPress={() => {}} />
      </VspPanel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  heading: {
    ...typography.subtitle,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
});
