import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState } from '../../components';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { MessageComposer } from '../../components/messaging/MessageComposer';
import { MessagingStateBanner } from '../../components/messaging/MessagingStates';
import { useMessagingLines } from '../../hooks/useMessagingLines';
import { useSendMessage } from '../../hooks/useSendMessage';
import { pickDocumentAttachments, pickMessageAttachments } from '../../messaging/attachmentPicker';
import {
  formatPhoneDisplay,
  isValidMessagingPeer,
  MAX_MMS_ATTACHMENTS,
  normalizePeerNumber,
} from '../../messaging/format';
import { uploadMessageAttachment } from '../../messaging/messagingService';
import type { MessageAttachment } from '../../messaging/types';
import { createOutboxId, useOutboxStore } from '../../messaging/outboxStore';
import type { MessagesStackParamList } from '../../navigation/types';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../shared/theme';
import { spacing } from '../../shared/theme';

type Props = NativeStackScreenProps<MessagesStackParamList, 'NewMessage'>;

export function NewMessageScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const { data: setup, isLoading } = useMessagingLines();
  const sendMutation = useSendMessage();

  const [peer, setPeer] = useState(route.params?.peerNumber || '');
  const [fromLine, setFromLine] = useState('');
  const [draft, setDraft] = useState('');
  const [peerError, setPeerError] = useState('');
  const [sendError, setSendError] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (route.params?.peerNumber) {
      setPeer(route.params.peerNumber);
    }
  }, [route.params?.peerNumber]);

  useEffect(() => {
    if (setup?.defaultLine) setFromLine(setup.defaultLine);
  }, [setup?.defaultLine]);

  const uploadPicked = useCallback(async (files: Awaited<ReturnType<typeof pickMessageAttachments>>) => {
    if (!files.ok) {
      setSendError(files.error);
      return;
    }
    if (!files.files.length) return;
    setUploading(true);
    try {
      const uploaded: MessageAttachment[] = [];
      for (const file of files.files) {
        uploaded.push(await uploadMessageAttachment(file));
      }
      setPendingAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Attachment upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleAttachMedia = useCallback(async () => {
    if (!isOnline) {
      setSendError('Reconnect to attach files.');
      return;
    }
    setSendError('');
    const remaining = MAX_MMS_ATTACHMENTS - pendingAttachments.length;
    await uploadPicked(await pickMessageAttachments(remaining));
  }, [isOnline, pendingAttachments.length, uploadPicked]);

  const handleAttachDocument = useCallback(async () => {
    if (!isOnline) {
      setSendError('Reconnect to attach files.');
      return;
    }
    setSendError('');
    const remaining = MAX_MMS_ATTACHMENTS - pendingAttachments.length;
    await uploadPicked(await pickDocumentAttachments(remaining));
  }, [isOnline, pendingAttachments.length, uploadPicked]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!peer.trim() || !fromLine || (!text && !pendingAttachments.length)) return;
    if (!isValidMessagingPeer(peer)) {
      setPeerError('Enter a valid recipient phone number.');
      return;
    }
    setPeerError('');
    setSendError('');
    const normalizedTo = normalizePeerNumber(peer);

    if (!isOnline) {
      useOutboxStore.getState().enqueue({
        id: createOutboxId(),
        from: fromLine,
        to: normalizedTo,
        text,
        attachmentIds: pendingAttachments.map((item) => item.id),
        attachments: pendingAttachments,
        lastError: 'Queued offline',
      });
      setDraft('');
      setPendingAttachments([]);
      setPeer('');
      navigation.goBack();
      return;
    }

    sendMutation.mutate(
      {
        from: fromLine,
        to: normalizedTo,
        text,
        uploadedAttachments: pendingAttachments,
      },
      {
        onSuccess: (res) => {
          setDraft('');
          setPendingAttachments([]);
          setPeer('');
          navigation.replace('ConversationThread', {
            conversationId: res.message.conversationId,
            peerLabel: formatPhoneDisplay(normalizedTo),
            lineLabel: fromLine,
            peerNumber: normalizedTo,
          });
        },
        onError: (err) => {
          setSendError(err instanceof Error ? err.message : 'Send failed');
        },
      },
    );
  }, [draft, fromLine, isOnline, navigation, peer, pendingAttachments, sendMutation]);

  if (isLoading) return <SkeletonList rows={3} />;

  if (setup && !setup.lines.length) {
    return (
      <EmptyState
        icon="💬"
        title="No messaging lines"
        message="Assign at least one business number before sending messages."
      />
    );
  }

  const sending = sendMutation.isPending || uploading;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {sendError ? (
          <MessagingStateBanner tone="error" message={sendError} onDismiss={() => setSendError('')} />
        ) : null}
        <MessageComposer
          lines={setup?.lines ?? []}
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
          disabled={!peer.trim() || (!draft.trim() && !pendingAttachments.length)}
          offline={!isOnline}
          peer={peer}
          onPeerChange={(value) => {
            setPeer(value);
            setPeerError('');
          }}
          showPeerField
          peerError={peerError}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
});
