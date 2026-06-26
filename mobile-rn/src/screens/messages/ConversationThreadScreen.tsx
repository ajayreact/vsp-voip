import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MessageRecord } from '../../api/types';
import { Button, ErrorScreen, LoadingScreen, VspAttachmentChip, VspMessageBlock } from '../../components';
import { listConversationMessages, markConversationRead } from '../../messaging';
import type { MessagesStackParamList } from '../../navigation/types';
import { useTheme } from '../../shared/theme';
import { spacing } from '../../shared/theme';

type Props = NativeStackScreenProps<MessagesStackParamList, 'ConversationThread'>;

function normalizeDirection(d?: string): 'inbound' | 'outbound' {
  return d?.toUpperCase() === 'OUTBOUND' || d === 'outbound' ? 'outbound' : 'inbound';
}

export function ConversationThreadScreen({ route, navigation }: Props) {
  const { conversationId, peerLabel, lineLabel } = route.params;
  const { colors } = useTheme();
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listConversationMessages(conversationId);
      setMessages(data.slice().reverse());
      await markConversationRead(conversationId).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    navigation.setOptions({
      title: lineLabel ? `${peerLabel} · Line ${lineLabel}` : peerLabel,
    });
    load();
  }, [conversationId, lineLabel, load, navigation, peerLabel]);

  if (loading) return <LoadingScreen message="Loading thread…" />;
  if (error) return <ErrorScreen message={error} onRetry={load} />;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View>
            <VspMessageBlock
              body={item.body || '(attachment)'}
              direction={normalizeDirection(item.direction)}
              timestamp={item.createdAt}
              status={item.status}
            />
            {item.attachments?.map((att) => (
              <VspAttachmentChip
                key={att.id}
                name={att.fileName || 'Attachment'}
                mimeType={att.mimeType}
                uri={att.url}
              />
            ))}
          </View>
        )}
      />
      <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Button
          label="Attach"
          variant="ghost"
          onPress={() => navigation.navigate('Attachments', { conversationId })}
        />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundAlt }]}
          multiline
        />
        <Button
          label="Send"
          onPress={() => setDraft('')}
          disabled={!draft.trim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    padding: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 120,
    minHeight: 44,
  },
});
