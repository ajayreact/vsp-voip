import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState, SearchBar } from '../../components';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { MessageComposer } from '../../components/messaging/MessageComposer';
import { MessagingStateBanner } from '../../components/messaging/MessagingStates';
import { useMessagingContacts } from '../../hooks/useMessagingContacts';
import { useMessagingLines } from '../../hooks/useMessagingLines';
import { useSendMessage } from '../../hooks/useSendMessage';
import { pickDocumentAttachments, pickMessageAttachments } from '../../messaging/attachmentPicker';
import { filterContacts } from '../../contacts/contactsService';
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
import type { ContactEntry } from '../../api/types';
import { spacing, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<MessagesStackParamList, 'NewMessage'>;

function ContactPickRow({
  contact,
  onPress,
}: {
  contact: ContactEntry;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const number = contact.assignedDidNumber || contact.extensionNumber;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
    >
      <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>
        {contact.name}
      </Text>
      <Text style={[styles.contactMeta, { color: colors.textMuted }]} numberOfLines={1}>
        {number ? formatPhoneDisplay(number) : `Ext ${contact.extensionNumber}`}
      </Text>
    </Pressable>
  );
}

export function NewMessageScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const { data: setup, isLoading } = useMessagingLines();
  const { data: contacts = [], isLoading: contactsLoading } = useMessagingContacts();
  const sendMutation = useSendMessage();

  const [contactQuery, setContactQuery] = useState('');
  const [peer, setPeer] = useState(route.params?.peerNumber || '');
  const [fromLine, setFromLine] = useState('');
  const [draft, setDraft] = useState(route.params?.draft || '');
  const [peerError, setPeerError] = useState('');
  const [sendError, setSendError] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (route.params?.peerNumber) setPeer(route.params.peerNumber);
    if (route.params?.draft) setDraft(route.params.draft);
  }, [route.params?.draft, route.params?.peerNumber]);

  useEffect(() => {
    if (setup?.defaultLine) setFromLine(setup.defaultLine);
  }, [setup?.defaultLine]);

  const filteredContacts = useMemo(
    () => filterContacts(contacts, contactQuery).slice(0, 12),
    [contactQuery, contacts],
  );

  const previewText = useMemo(() => {
    const body = draft.trim();
    if (!body) return 'Your SMS preview will appear here.';
    return body.length > 160 ? `${body.slice(0, 160)}…` : body;
  }, [draft]);

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

  const selectContact = useCallback((contact: ContactEntry) => {
    const number = contact.assignedDidNumber || contact.extensionNumber;
    if (number) {
      setPeer(number);
      setPeerError('');
    }
  }, []);

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

  if (isLoading || contactsLoading) return <SkeletonList rows={3} />;

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

        <SearchBar
          value={contactQuery}
          onChangeText={setContactQuery}
          placeholder="Search contacts"
          accessibilityLabel="Search contacts for new message"
        />

        {filteredContacts.length ? (
          <View style={styles.contactListWrap}>
            <FlashList
              data={filteredContacts}
              scrollEnabled={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ContactPickRow contact={item} onPress={() => selectContact(item)} />
              )}
            />
          </View>
        ) : null}

        <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.previewLabel, { color: colors.textMuted }]}>SMS preview</Text>
          <Text style={[styles.previewBody, { color: colors.text }]}>{previewText}</Text>
        </View>

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
  contactListWrap: {
    maxHeight: 220,
  },
  contactRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  contactName: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  contactMeta: {
    ...typography.caption,
  },
  previewCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
  previewLabel: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewBody: {
    ...typography.body,
  },
});
