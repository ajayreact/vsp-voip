import React, { memo, useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RipplePressable } from '../ui/RipplePressable';
import { VspChip, VspPanel } from '../vsp';
import { VSP_AI_BRANDING } from '../../ai/vspAiBranding';
import { useAssistantSuggestions } from '../../hooks/useAssistantSuggestions';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type AskVspWidgetProps = {
  onSubmit: (question: string) => void;
};

export const AskVspWidget = memo(function AskVspWidget({ onSubmit }: AskVspWidgetProps) {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const { suggestions } = useAssistantSuggestions();

  const submit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setInput('');
  }, [input, onSubmit]);

  return (
    <VspPanel>
      <View style={styles.header}>
        <Ionicons name="search-outline" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>{VSP_AI_BRANDING.searchLabel}</Text>
      </View>
      <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={VSP_AI_BRANDING.askPlaceholder}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }]}
          returnKeyType="search"
          onSubmitEditing={submit}
          accessibilityLabel={VSP_AI_BRANDING.searchLabel}
          accessibilityHint="Ask a question about your communications"
        />
        <RipplePressable
          onPress={submit}
          disabled={!input.trim()}
          style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Submit question"
        >
          <Ionicons name="arrow-forward" size={18} color={colors.accentText} />
        </RipplePressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.prompts}
        accessibilityRole="list"
      >
        {suggestions.map((prompt) => (
          <VspChip key={prompt} label={prompt} onPress={() => onSubmit(prompt)} />
        ))}
      </ScrollView>
    </VspPanel>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  title: { ...typography.subtitle, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 24,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    minHeight: 48,
  },
  input: { flex: 1, ...typography.body, paddingVertical: spacing.sm },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prompts: { gap: spacing.xs, marginTop: spacing.sm, paddingRight: spacing.md },
});
