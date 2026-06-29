import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { AiStackParamList } from '../../navigation/types';
import { VspBadge, VspChip, VspHero, VspPanel } from '../../components/vsp';
import {
  formatAssistantForCopy,
  queryAssistant,
  streamAssistant,
  type AssistantResponse,
} from '../../ai/assistantService';
import { sanitizeAiUserMessage, VSP_AI_BRANDING } from '../../ai/vspAiBranding';
import { useAssistantSuggestions } from '../../hooks/useAssistantSuggestions';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: AssistantResponse;
  loading?: boolean;
  error?: string;
};

export function AssistantScreen() {
  const route = useRoute<RouteProp<AiStackParamList, 'AssistantHome'>>();
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { suggestions: sharedSuggestions } = useAssistantSuggestions();
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const handledInitialRef = useRef<string | null>(null);

  useEffect(() => {
    setSuggestions(sharedSuggestions);
  }, [sharedSuggestions]);


  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateLastAssistant = useCallback((patch: Partial<ChatMessage>) => {
    setMessages((prev) => {
      const next = [...prev];
      const idx = next.length - 1;
      if (idx >= 0 && next[idx].role === 'assistant') {
        next[idx] = { ...next[idx], ...patch };
      }
      return next;
    });
  }, []);

  const submitQuestion = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || streaming) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    appendMessage({ id: `${Date.now()}-u`, role: 'user', text: trimmed });
    appendMessage({ id: `${Date.now()}-a`, role: 'assistant', text: '', loading: true });
    setInput('');
    setStreaming(true);

    try {
      let streamed = '';
      await streamAssistant(trimmed, {
        signal: abortRef.current.signal,
        onChunk: (chunk) => {
          if (chunk.type === 'delta' && chunk.content) {
            streamed += chunk.content;
            updateLastAssistant({ text: streamed, loading: true });
          }
          if (chunk.type === 'done') {
            const response = chunk as AssistantResponse;
            updateLastAssistant({
              text: response.summary || streamed,
              response: response as AssistantResponse,
              loading: false,
            });
          }
          if (chunk.type === 'error') {
            updateLastAssistant({ error: sanitizeAiUserMessage(chunk.message), loading: false });
          }
        },
      });
    } catch {
      try {
        const response = await queryAssistant(trimmed);
        updateLastAssistant({ text: response.summary, response, loading: false });
      } catch (err) {
        updateLastAssistant({
          error: sanitizeAiUserMessage(err instanceof Error ? err.message : VSP_AI_BRANDING.unavailable),
          loading: false,
        });
      }
    } finally {
      setStreaming(false);
    }
  }, [appendMessage, streaming, updateLastAssistant]);

  useEffect(() => {
    const initial = route.params?.initialQuestion?.trim();
    if (!initial || handledInitialRef.current === initial) return;
    handledInitialRef.current = initial;
    void submitQuestion(initial);
  }, [route.params?.initialQuestion, submitQuestion]);

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={[styles.messageBlock, item.role === 'user' ? styles.userBlock : styles.assistantBlock]}>
      {item.role === 'assistant' ? (
        <View style={styles.aiHeader}>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
          <VspBadge label={VSP_AI_BRANDING.badgeLabel} tone="primary" />
        </View>
      ) : null}
      {item.loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.textMuted }}>{VSP_AI_BRANDING.thinking}</Text>
        </View>
      ) : null}
      {item.error ? <Text style={{ color: colors.error }}>{item.error}</Text> : null}
      {item.text ? (
        <Text style={[styles.messageText, { color: colors.text }]}>{item.text}</Text>
      ) : null}
      {item.response?.insights?.length ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {VSP_AI_BRANDING.insightsHeading}
          </Text>
          {item.response.insights.map((insight) => (
            <Text key={insight} style={[styles.sectionBullet, { color: colors.text }]}>
              • {insight}
            </Text>
          ))}
        </View>
      ) : null}
      {item.response?.suggestedActions?.length ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {VSP_AI_BRANDING.recommendedBy}
          </Text>
          {item.response.suggestedActions.map((action) => (
            <Text key={action} style={[styles.sectionBullet, { color: colors.text }]}>
              • {action}
            </Text>
          ))}
        </View>
      ) : null}
      {item.response?.followUps?.length ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {VSP_AI_BRANDING.followUpsHeading}
          </Text>
          {item.response.followUps.map((followUp) => (
            <Text key={followUp} style={[styles.sectionBullet, { color: colors.text }]}>
              • {followUp}
            </Text>
          ))}
        </View>
      ) : null}
      {item.response?.results?.length ? (
        <VspPanel style={styles.resultsPanel}>
          {item.response.results.slice(0, 5).map((result) => (
            <View key={`${result.type}-${result.id}`} style={styles.resultRow}>
              <Text style={[styles.resultTitle, { color: colors.text }]}>{result.title}</Text>
              <Text style={[styles.resultSub, { color: colors.textMuted }]} numberOfLines={2}>
                {result.subtitle}
              </Text>
            </View>
          ))}
        </VspPanel>
      ) : null}
      {item.response ? (
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => void Clipboard.setStringAsync(formatAssistantForCopy(item.response!))}
            style={styles.actionBtn}
          >
            <Ionicons name="copy-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary }}>Copy</Text>
          </Pressable>
          <Pressable
            onPress={() => void Share.share({ message: formatAssistantForCopy(item.response!) })}
            style={styles.actionBtn}
          >
            <Ionicons name="share-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary }}>Share</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <VspHero
        eyebrow={VSP_AI_BRANDING.heroEyebrow}
        title={VSP_AI_BRANDING.heroTitle}
        subtitle={VSP_AI_BRANDING.heroSubtitle}
      />
      <Text style={[styles.poweredBy, { color: colors.textMuted }]}>{VSP_AI_BRANDING.poweredBy}</Text>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            suggestions.length ? (
              <View style={styles.suggestions}>
                {suggestions.map((prompt) => (
                  <VspChip key={prompt} label={prompt} onPress={() => void submitQuestion(prompt)} />
                ))}
              </View>
            ) : null
          }
        />
        <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={VSP_AI_BRANDING.askPlaceholder}
            accessibilityLabel={VSP_AI_BRANDING.searchLabel}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            editable={!streaming}
            onSubmitEditing={() => void submitQuestion(input)}
          />
          <Pressable
            style={[styles.sendBtn, { backgroundColor: colors.primary }]}
            onPress={() => void submitQuestion(input)}
            disabled={streaming || !input.trim()}
          >
            <Ionicons name="arrow-up" size={20} color={colors.accentText} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  listContent: { padding: spacing.md, gap: spacing.md },
  poweredBy: { ...typography.caption, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  messageBlock: { gap: spacing.sm },
  userBlock: { alignSelf: 'flex-end', maxWidth: '90%' },
  assistantBlock: { alignSelf: 'stretch' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  messageText: { ...typography.body },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resultsPanel: { marginTop: spacing.xs },
  resultRow: { marginBottom: spacing.sm },
  resultTitle: { ...typography.bodyMedium },
  resultSub: { ...typography.caption },
  section: { gap: 4, marginTop: spacing.xs },
  sectionTitle: { ...typography.caption, fontWeight: '600', textTransform: 'uppercase' },
  sectionBullet: { ...typography.bodySmall },
  actionRow: { flexDirection: 'row', gap: spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
