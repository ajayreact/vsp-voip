import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {

  ActivityIndicator,

  Alert,

  KeyboardAvoidingView,

  NativeScrollEvent,

  NativeSyntheticEvent,

  Platform,

  Pressable,

  StyleSheet,

  Text,

  View,

} from 'react-native';

import { FlashList } from '@shopify/flash-list';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useQueryClient } from '@tanstack/react-query';

import { ErrorScreen, SearchBar, VspMessageBlock } from '../../components';
import { AiSummaryCard } from '../../components/ai/AiSummaryCard';

import { ConversationThreadHeader } from '../../components/messaging/ConversationThreadHeader';

import { FadeInView } from '../../components/ui/FadeInView';

import { SkeletonThread } from '../../components/ui/SkeletonLoader';

import { AttachmentPreviewModal } from '../../components/messaging/AttachmentPreviewModal';

import { MessageComposer } from '../../components/messaging/MessageComposer';

import {

  MessageDateSeparator,

  MessagingStateBanner,

  NewMessagesBanner,

} from '../../components/messaging/MessagingStates';

import { useConversationMessages } from '../../hooks/useConversationMessages';

import { useMessagingContacts } from '../../hooks/useMessagingContacts';

import { useMessagingLines } from '../../hooks/useMessagingLines';

import { useThreadBackgroundSync } from '../../hooks/useThreadBackgroundSync';

import { buildOptimisticMessage, useSendMessage } from '../../hooks/useSendMessage';

import { pickDocumentAttachments, pickMessageAttachments } from '../../messaging/attachmentPicker';

import {

  groupMessagesWithSeparators,

  isValidMessagingPeer,

  MAX_MMS_ATTACHMENTS,

  normalizeDirection,

  normalizePeerNumber,

  type MessageListItem,

} from '../../messaging/format';

import type { MessageAttachment, PlatformMessage } from '../../messaging/types';

import { createOutboxId, useOutboxStore } from '../../messaging/outboxStore';

import { showMessageActions } from '../../messaging/messageActions';

import {

  conversationFromOutboundMessage,

  patchThreadMessage,

  upsertConversationSummary,

  upsertThreadMessage,

} from '../../messaging/messagingQueryCache';

import { useMessagingUiStore } from '../../messaging/messagingUiStore';

import { syncThreadOnOpen } from '../../messaging/syncThreadOnOpen';

import { useMessagePreferencesStore } from '../../messaging/messagePreferencesStore';

import { findContactByNumber } from '../../contacts/contactLookup';

import { uploadMessageAttachment } from '../../messaging/messagingService';

import type { MessagesStackParamList } from '../../navigation/types';

import { useAppStore } from '../../store/appStore';

import { useTheme } from '../../shared/theme';

import { LIST_ITEM_HEIGHT } from '../../lib/listConstants';

import { spacing } from '../../shared/theme';



type Props = NativeStackScreenProps<MessagesStackParamList, 'ConversationThread'>;



const SCROLL_BOTTOM_THRESHOLD = 96;



export function ConversationThreadScreen({ route, navigation }: Props) {

  const { conversationId, peerLabel, lineLabel, peerNumber } = route.params;

  const { colors } = useTheme();

  const queryClient = useQueryClient();

  const isOnline = useAppStore((s) => s.isOnline);

  const listRef = useRef<React.ComponentRef<typeof FlashList<MessageListItem>>>(null);

  const [draft, setDraft] = useState('');

  const [fromLine, setFromLine] = useState(lineLabel || '');

  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);

  const [uploading, setUploading] = useState(false);

  const [sendError, setSendError] = useState('');

  const [previewAttachment, setPreviewAttachment] = useState<MessageAttachment | null>(null);

  const [threadSearch, setThreadSearch] = useState('');

  const hiddenMessageIds = useMessagePreferencesStore((s) => s.hiddenMessageIds);

  const newMessagesBelow = useMessagingUiStore((s) => s.newMessagesBelow);

  const setAtBottom = useMessagingUiStore((s) => s.setAtBottom);

  const clearNewMessagesBelow = useMessagingUiStore((s) => s.clearNewMessagesBelow);



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

  const { data: contacts = [] } = useMessagingContacts();

  const sendMutation = useSendMessage();



  useThreadBackgroundSync(conversationId);



  const contact = useMemo(

    () => (peerNumber ? findContactByNumber(contacts, peerNumber) : undefined),

    [contacts, peerNumber],

  );



  useEffect(() => {

    navigation.setOptions({

      title: peerLabel,

    });

  }, [conversationId, navigation, peerLabel]);



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

    void syncThreadOnOpen(queryClient, conversationId);

  }, [conversationId, queryClient]);



  useEffect(() => {

    return useOutboxStore.subscribe((state, prevState) => {

      for (const item of state.items) {

        const prev = prevState.items.find((entry) => entry.id === item.id);

        if (prev && prev.lastError !== item.lastError && item.lastError) {

          const cached = serverMessages.find((message) => message._outboxId === item.id);

          if (cached) {

            patchThreadMessage(queryClient, conversationId, cached.id, {

              status: 'failed',

              deliveryError: item.lastError,

              _optimistic: false,

            });

          }

        }

      }

    });

  }, [conversationId, queryClient, serverMessages]);



  const messages = useMemo(() => {

    const visible = serverMessages.filter((message) => !hiddenMessageIds.includes(message.id));

    if (!threadSearch.trim()) return visible;

    const q = threadSearch.trim().toLowerCase();

    return visible.filter((message) => (message.body || '').toLowerCase().includes(q));

  }, [hiddenMessageIds, serverMessages, threadSearch]);



  const listItems = useMemo(() => groupMessagesWithSeparators(messages), [messages]);



  const scrollToLatest = useCallback((animated = true) => {

    listRef.current?.scrollToEnd({ animated });

  }, []);



  const handleScroll = useCallback(

    (event: NativeSyntheticEvent<NativeScrollEvent>) => {

      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

      const distanceFromBottom =

        contentSize.height - layoutMeasurement.height - contentOffset.y;

      const atBottom = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;

      setAtBottom(atBottom);

      if (atBottom) {

        clearNewMessagesBelow();

      }

    },

    [clearNewMessagesBelow, setAtBottom],

  );



  const handleJumpToNewMessages = useCallback(() => {

    clearNewMessagesBelow();

    scrollToLatest(true);

  }, [clearNewMessagesBelow, scrollToLatest]);



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



  const handleRetryMessage = useCallback(

    (message: PlatformMessage) => {

      patchThreadMessage(queryClient, conversationId, message.id, {

        status: 'sending',

        deliveryError: null,

        _optimistic: true,

      });



      sendMutation.mutate({

        from: message.from || fromLine,

        to: message.to || peerNumber || peerLabel,

        text: message.body || '',

        conversationId,

        uploadedAttachments: message.attachments,

        outboxId: message._outboxId,

        optimisticId: message.id,

      });

    },

    [conversationId, fromLine, peerLabel, peerNumber, queryClient, sendMutation],

  );



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



    upsertThreadMessage(queryClient, conversationId, optimistic);

    upsertConversationSummary(

      queryClient,

      conversationFromOutboundMessage(optimistic, normalizedTo, line),

    );



    setDraft('');

    const attachmentsToSend = pendingAttachments;

    setPendingAttachments([]);

    requestAnimationFrame(() => scrollToLatest(true));



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



    sendMutation.mutate({

      from: line,

      to: normalizedTo,

      text,

      conversationId,

      uploadedAttachments: attachmentsToSend,

      outboxId,

      optimisticId: optimistic.id,

    });

  }, [

    conversationId,

    draft,

    fromLine,

    isOnline,

    peerLabel,

    peerNumber,

    pendingAttachments,

    queryClient,

    scrollToLatest,

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

          onLongPress={() =>

            showMessageActions({

              message,

              peerNumber: peerNumber || peerLabel,

              lineNumber: fromLine,

              navigation,

              onRetryOptimistic: () => handleRetryMessage(message),

            })

          }

        />

      );

    },

    [fromLine, handleRetryMessage, navigation, peerLabel, peerNumber],

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

      {peerNumber && fromLine ? (

        <ConversationThreadHeader peerNumber={peerNumber} lineNumber={fromLine} contact={contact} />

      ) : null}

      <View style={styles.threadSearchWrap}>

        <SearchBar

          value={threadSearch}

          onChangeText={setThreadSearch}

          placeholder="Search in conversation"

          accessibilityLabel="Search messages in conversation"

        />

      </View>

      <View style={styles.listContainer}>

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

          onScroll={handleScroll}

          scrollEventThrottle={16}

          ListHeaderComponent={

            <View>

              {isFetchingNextPage ? (

                <ActivityIndicator style={styles.loader} color={colors.primary} />

              ) : null}

              <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>

                <AiSummaryCard entityType="conversation" entityId={conversationId} />

              </View>

            </View>

          }

          renderItem={renderItem}

        />

        <NewMessagesBanner count={newMessagesBelow} onPress={handleJumpToNewMessages} />

      </View>

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

  listContainer: {

    flex: 1,

    position: 'relative',

  },

  threadSearchWrap: {

    paddingHorizontal: spacing.lg,

    paddingBottom: spacing.sm,

  },

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


