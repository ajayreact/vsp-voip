import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../Button';
import { VspAttachmentChip } from '../vsp/VspMessaging';
import { useTheme } from '../../shared/theme';
import { MAX_MMS_ATTACHMENTS, MAX_SMS_LENGTH } from '../../messaging/format';
import type { MessageAttachment, MessagingLine } from '../../messaging/types';
import { spacing, typography } from '../../shared/theme';

type Props = {
  lines: MessagingLine[];
  fromLine: string;
  onFromLineChange: (value: string) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  pendingAttachments: MessageAttachment[];
  onRemoveAttachment: (id: string) => void;
  onAttachMedia: () => void;
  onAttachDocument: () => void;
  onSend: () => void;
  sending: boolean;
  disabled: boolean;
  offline: boolean;
  peer?: string;
  onPeerChange?: (value: string) => void;
  showPeerField?: boolean;
  peerError?: string;
};

export function MessageComposer({
  lines,
  fromLine,
  onFromLineChange,
  draft,
  onDraftChange,
  pendingAttachments,
  onRemoveAttachment,
  onAttachMedia,
  onAttachDocument,
  onSend,
  sending,
  disabled,
  offline,
  peer,
  onPeerChange,
  showPeerField,
  peerError,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {offline ? (
        <Text style={[styles.offline, { color: colors.warning }]} accessibilityLiveRegion="polite">
          Offline — messages queue until connectivity returns.
        </Text>
      ) : null}

      {showPeerField ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Recipient</Text>
          <TextInput
            value={peer}
            onChangeText={onPeerChange}
            placeholder="+1 client mobile number"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.backgroundAlt, borderColor: peerError ? colors.error : colors.border },
            ]}
            accessibilityLabel="Recipient phone number"
          />
          {peerError ? <Text style={[styles.error, { color: colors.error }]}>{peerError}</Text> : null}
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Business line</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.lineRow}>
            {lines.map((line) => {
              const active = line.number === fromLine;
              return (
                <Pressable
                  key={line.id}
                  onPress={() => onFromLineChange(line.number)}
                  style={[
                    styles.lineChip,
                    {
                      backgroundColor: active ? colors.primarySoft : colors.backgroundAlt,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? colors.primary : colors.text }}>{line.number}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {pendingAttachments.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachRow}>
          {pendingAttachments.map((item) => (
            <Pressable key={item.id} onLongPress={() => onRemoveAttachment(item.id)}>
              <VspAttachmentChip
                name={item.fileName || 'Attachment'}
                mimeType={item.mimeType}
                uri={item.publicUrl || item.url}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <TextInput
        value={draft}
        onChangeText={onDraftChange}
        placeholder="Type your message…"
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={MAX_SMS_LENGTH}
        style={[styles.compose, { color: colors.text, backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
        accessibilityLabel="Message text"
      />

      <View style={styles.toolbar}>
        <View style={styles.leftTools}>
          <Button
            label="Photo"
            variant="ghost"
            onPress={onAttachMedia}
            disabled={offline || pendingAttachments.length >= MAX_MMS_ATTACHMENTS}
          />
          <Button
            label="File"
            variant="ghost"
            onPress={onAttachDocument}
            disabled={offline || pendingAttachments.length >= MAX_MMS_ATTACHMENTS}
          />
          <Text style={[styles.counter, { color: colors.textMuted }]}>
            {draft.length}/{MAX_SMS_LENGTH}
          </Text>
        </View>
        <Pressable
          onPress={onSend}
          disabled={disabled || sending}
          style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: disabled || sending ? 0.5 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={offline ? 'Queue message' : 'Send message'}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendLabel}>Send</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  offline: { ...typography.caption, fontWeight: '600' },
  field: { gap: spacing.xs },
  label: { ...typography.caption, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  error: { ...typography.caption },
  lineRow: { flexDirection: 'row', gap: spacing.sm },
  lineChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  attachRow: { maxHeight: 56 },
  compose: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 88,
    maxHeight: 160,
    textAlignVertical: 'top',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  counter: { ...typography.caption },
  sendBtn: {
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 72,
    alignItems: 'center',
  },
  sendLabel: { ...typography.bodyMedium, color: '#fff', fontWeight: '700' },
});
