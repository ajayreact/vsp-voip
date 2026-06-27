import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ErrorScreen, VspMessageBlock } from '../../components';
import { FadeInView } from '../../components/ui/FadeInView';
import { SkeletonThread } from '../../components/ui/SkeletonLoader';
import { AttachmentPreviewModal } from '../../components/messaging/AttachmentPreviewModal';
import { MessageComposer } from '../../components/messaging/MessageComposer';
import { MessageDateSeparator, MessagingStateBanner } from '../../components/messaging/MessagingStates';
import { useConversationMessages } from '../../hooks/useConversationMessages';
import { useMessagingLines } from '../../hooks/useMessagingLines';
import { buildOptimisticMessage, useSendMessage } from '../../hooks/useSendMessage';
import { pickDocumentAttachments, pickMessageAttachments } from '../../messaging/attachmentPicker';
import {
  groupMessagesWithSeparators,
  isValidMessagingPeer,
  MAX_MMS_ATTACHMENTS,
  mergeMessagesById,
  normalizeDirection,
  normalizePeerNumber,
  type MessageListItem,
} from '../../messaging/format';
import type { MessageAttachment, PlatformMessage } from '../../messaging/types';
import { createOutboxId, useOutboxStore } from '../../messaging/outboxStore';
import { uploadMessageAttachment } from '../../messaging/messagingService';
import type { MessagesStackParamList } from '../../navigation/types';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../shared/theme';
import { LIST_ITEM_HEIGHT } from '../../lib/listConstants';
import { spacing } from '../../shared/theme';

type Props = NativeStackScreenProps<MessagesStackParamList, 'ConversationThread'>;

export function ConversationThreadScreen({ route, navigation }: Props) {
  const { conversationId, peerLabel, lineLabel, peerNumber } = route.params;
  const { colors } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const listRef = useRef<React.ComponentRef<typeof FlashList<MessageListItem>>>(null);
  const [draft, setDraft] = useState('');
  const [fromLine, setFromLine] = useState(lineLabel || '');
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sendError, setSendError] = useState('');
  const [optimisticMessages, setOptimisticMessages] = useState<PlatformMessage[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<MessageAttachment | null>(null);

  const {
    messages: serverMessages,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useConversationMessages(conversationId);
  const { data: setup } = useMessagingLines();
  const sendMutation = useSendMessage();

  useEffect(() => {
    navigation.setOptions({
      title: lineLabel ? `${peerLabel} · Line ${lineLabel}` : peerLabel,
    });
  }, [conversationId, lineLabel, navigation, peerLabel]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('Attachments', { conversationId })}
          accessibilityRole="button"
          accessibilityLabel="View attachments"
          style={styles.headerAction}
        >
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Files</Text>
        </Pressable>
      ),
    });
  }, [colors.primary, conversationId, navigation]);

  useEffect(() => {
    if (lineLabel) setFromLine(lineLabel);
    else if (setup?.defaultLine) setFromLine(setup.defaultLine);
  }, [lineLabel, setup?.defaultLine]);

  useEffect(() => {
    return useOutboxStore.subscribe((state, prevState) => {
      const removedIds = prevState.items
        .filter((item) => !state.items.some((entry) => entry.id === item.id))
        .map((item) => item.id);
      if (!removedIds.length) return;
      setOptimisticMessages((prev) =>
        prev.filter((message) => !message._outboxId || !removedIds.includes(message._outboxId)),
      );
    });
  }, []);

  const messages = useMemo(
    () => mergeMessagesById([...serverMessages, ...optimisticMessages]),
    [optimisticMessages, serverMessages],
  );

  const listItems = useMemo(() => groupMessagesWithSeparators(messages), [messages]);

  useEffect(() => {
    if (!optimisticMessages.length) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [optimisticMessages.length]);

  const handleLoadOlder = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleAttachMedia = useCallback(async () => {
    if (!isOnline) {
      setSendError('Reconnect to attach files.');
      return;
    }
    setSendError('');
    const remaining = MAX_MMS_ATTACHMENTS - pendingAttachments.length;
    const picked = await pickMessageAttachments(remaining);
    if (!picked.ok) {
      setSendError(picked.error);
      return;
    }
    if (!picked.files.length) return;
    setUploading(true);
    try {
      const uploaded: MessageAttachment[] = [];
      for (const file of picked.files) {
        uploaded.push(await uploadMessageAttachment(file));
      }
      setPendingAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Attachment upload failed');
    } finally {
      setUploading(false);
    }
  }, [isOnline, pendingAttachments.length]);

  const handleAttachDocument = useCallback(async () => {
    if (!isOnline) {
      setSendError('Reconnect to attach files.');
      return;
    }
    setSendError('');
    const remaining = MAX_MMS_ATTACHMENTS - pendingAttachments.length;
    const picked = await pickDocumentAttachments(remaining);
    if (!picked.ok) {
      setSendError(picked.error);
      return;
    }
    if (!picked.files.length) return;
    setUploading(true);
    try {
      const uploaded: MessageAttachment[] = [];
      for (const file of picked.files) {
        uploaded.push(await uploadMessageAttachment(file));
      }
      setPendingAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Attachment upload failed');
    } finally {
      setUploading(false);
    }
  }, [isOnline, pendingAttachments.length]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    const to = peerNumber || peerLabel;
    const line = fromLine;
    if (!to || !line || (!text && !pendingAttachments.length)) return;
    if (!isValidMessagingPeer(to)) {
      setSendError('Enter a valid recipient phone number.');
      return;
    }

    setSendError('');
    const normalizedTo = normalizePeerNumber(to);
    const outboxId = createOutboxId();
    const optimistic = buildOptimisticMessage({
      conversationId,
      from: line,
      to: normalizedTo,
      text,
      attachments: pendingAttachments,
      outboxId,
    });
    setOptimisticMessages((prev) => [...prev, optimistic]);
    setDraft('');
    const attachmentsToSend = pendingAttachments;
    setPendingAttachments([]);

    if (!isOnline) {
      useOutboxStore.getState().enqueue({
        id: outboxId,
        from: line,
        to: normalizedTo,
        text,
        attachmentIds: attachmentsToSend.map((item) => item.id),
        attachments: attachmentsToSend,
        conversationId,
        lastError: 'Queued offline',
      });
      return;
    }

    sendMutation.mutate(
      {
        from: line,
        to: normalizedTo,
        text,
        conversationId,
        uploadedAttachments: attachmentsToSend,
        outboxId,
      },
      {
        onSuccess: () => {
          setOptimisticMessages((prev) => prev.filter((item) => item.id !== optimistic.id));
        },
        onError: (err) => {
          setOptimisticMessages((prev) =>
            prev.map((item) =>
              item.id === optimistic.id
                ? { ...item, status: 'failed', deliveryError: err instanceof Error ? err.message : 'Send failed' }
                : item,
            ),
          );
        },
      },
    );
  }, [
    conversationId,
    draft,
    fromLine,
    isOnline,
    peerLabel,
    peerNumber,
    pendingAttachments,
    sendMutation,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: MessageListItem }) => {
      if (item.type === 'separator') {
        return <MessageDateSeparator label={item.label} />;
      }
      const message = item.message;
      return (
        <VspMessageBlock
          body={message.body || (message.attachments?.length ? '' : '(empty)')}
          direction={normalizeDirection(message.direction)}
          timestamp={message.createdAt}
          status={message.status}
          messageType={message.messageType}
          deliveryError={message.deliveryError}
          readAt={message.readAt}
          deliveredAt={message.deliveredAt}
          optimistic={message._optimistic}
          attachments={message.attachments}
          onAttachmentPress={setPreviewAttachment}
        />
      );
    },
    [],
  );

  const getItemType = useCallback((item: MessageListItem) => item.type, []);

  const overrideThreadLayout = useCallback(
    (layout: { span?: number; size?: number }, item: MessageListItem) => {
      if (item.type === 'separator') {
        layout.size = LIST_ITEM_HEIGHT.separator;
      }
    },
    [],
  );

  const maintainPosition = useMemo(
    () => ({
      startRenderingFromBottom: true,
      autoscrollToBottomThreshold: 0.15,
      animateAutoScrollToBottom: true,
    }),
    [],
  );

  if (isLoading && !messages.length) {
    return <SkeletonThread />;
  }

  if (error && !messages.length) {
    return (
      <ErrorScreen
        message={error instanceof Error ? error.message : 'Failed to load thread'}
        onRetry={() => refetch()}
      />
    );
  }

  const lines = setup?.lines ?? [];
  const sending = sendMutation.isPending || uploading;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      {sendError ? (
        <MessagingStateBanner
          tone="error"
          message={sendError}
          onDismiss={() => setSendError('')}
        />
      ) : null}

      <FadeInView style={styles.listWrap}>
      <FlashList
        ref={listRef}
        data={listItems}
        keyExtractor={(item) => item.key}
        getItemType={getItemType}
        overrideItemLayout={overrideThreadLayout}
        maintainVisibleContentPosition={maintainPosition}
        drawDistance={LIST_ITEM_HEIGHT.message * 6}
        removeClippedSubviews
        contentContainerStyle={styles.list}
        onStartReached={handleLoadOlder}
        onStartReachedThreshold={0.2}
        ListHeaderComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : null
        }
        renderItem={renderItem}
      />
      </FadeInView>

      <MessageComposer
        lines={lines}
        fromLine={fromLine}
        onFromLineChange={setFromLine}
        draft={draft}
        onDraftChange={setDraft}
        pendingAttachments={pendingAttachments}
        onRemoveAttachment={(id) => {
          Alert.alert('Remove attachment?', 'This file will not be sent.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => setPendingAttachments((prev) => prev.filter((item) => item.id !== id)),
            },
          ]);
        }}
        onAttachMedia={handleAttachMedia}
        onAttachDocument={handleAttachDocument}
        onSend={handleSend}
        sending={sending}
        disabled={!draft.trim() && !pendingAttachments.length}
        offline={!isOnline}
      />

      <AttachmentPreviewModal
        attachment={previewAttachment || { id: 'preview', fileName: 'Attachment' }}
        visible={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listWrap: { flex: 1 },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  loader: {
    paddingVertical: spacing.md,
  },
  headerAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
