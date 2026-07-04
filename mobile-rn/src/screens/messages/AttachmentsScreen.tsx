import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState, ErrorScreen, VspAttachmentChip } from '../../components';
import { SkeletonAttachmentsGrid } from '../../components/ui/SkeletonLoader';
import { useConversationMessages } from '../../hooks/useConversationMessages';
import { attachmentUri } from '../../messaging/format';
import type { MessageAttachment } from '../../messaging/types';
import type { MessagesStackParamList } from '../../navigation/types';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Attachments'>;

export function AttachmentsScreen({ route }: Props) {
  const { conversationId } = route.params;
  const { colors } = useTheme();
  const { messages, isLoading, error, refetch } = useConversationMessages(conversationId ?? null);

  const attachments = useMemo(() => {
    const items: MessageAttachment[] = [];
    const seen = new Set<string>();
    for (const message of messages) {
      for (const attachment of message.attachments ?? []) {
        if (seen.has(attachment.id)) continue;
        seen.add(attachment.id);
        items.push(attachment);
      }
    }
    return items.reverse();
  }, [messages]);

  if (!conversationId) {
    return (
      <EmptyState
        icon="📎"
        title="No conversation selected"
        message="Open a conversation to browse shared attachments."
      />
    );
  }

  if (isLoading && !attachments.length) {
    return <SkeletonAttachmentsGrid />;
  }

  if (error && !attachments.length) {
    return (
      <ErrorScreen
        message={error instanceof Error ? error.message : 'Failed to load attachments'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        Shared attachments
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Images, documents, and media exchanged in this conversation.
      </Text>
      <FlashList
        data={attachments}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <EmptyState
            icon="📎"
            title="No attachments"
            message="Files shared in this thread will appear here."
          />
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <VspAttachmentChip
              name={item.fileName || 'Attachment'}
              mimeType={item.mimeType}
              uri={attachmentUri(item)}
              sizeBytes={item.sizeBytes}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  title: {
    ...typography.subtitle,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  grid: {
    paddingBottom: spacing.xl,
  },
  cell: {
    flex: 1,
    padding: spacing.xs,
  },
});
