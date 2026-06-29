import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import { RipplePressable } from '../ui/RipplePressable';
import { VspBadge } from './VspBadge';
import { useTheme } from '../../shared/theme';
import {
  attachmentUri,
  formatAttachmentSize,
  formatMessagingTime,
  formatPhoneDisplay,
  isFailedMessageStatus,
  resolveOutboundStatusLabel,
} from '../../messaging/format';
import type { MessageAttachment } from '../../messaging/types';
import { spacing, tokens, typography } from '../../shared/theme';

type VspConversationRowProps = {
  peerLabel: string;
  phoneNumber?: string;
  lineLabel?: string;
  preview: string;
  timestamp?: string;
  unreadCount?: number;
  deliveryStatus?: string;
  pinned?: boolean;
  archived?: boolean;
  onPress?: () => void;
};

export const VspConversationRow = memo(function VspConversationRow({
  peerLabel,
  phoneNumber,
  lineLabel,
  preview,
  timestamp,
  unreadCount = 0,
  deliveryStatus,
  pinned = false,
  archived = false,
  onPress,
}: VspConversationRowProps) {
  const { colors } = useTheme();

  return (
    <RipplePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${peerLabel}${unreadCount ? `, ${unreadCount} unread` : ''}`}
      style={[styles.row, { backgroundColor: colors.surface }]}
    >
      <View style={styles.avatarWrap}>
        <Avatar name={peerLabel} size={48} />
        {pinned ? (
          <View style={[styles.pinBadge, { backgroundColor: colors.primary }]}>
            <Ionicons name="pin" size={10} color="#fff" />
          </View>
        ) : null}
      </View>
      <View style={styles.content}>
        <View style={styles.topLine}>
          <Text style={[styles.peer, { color: colors.text }]} numberOfLines={1}>
            {peerLabel}
          </Text>
          <View style={styles.metaRight}>
            {archived ? (
              <Ionicons name="archive-outline" size={14} color={colors.textMuted} accessibilityLabel="Archived" />
            ) : null}
            {timestamp ? (
              <Text style={[styles.time, { color: colors.textMuted }]}>
                {formatMessagingTime(timestamp)}
              </Text>
            ) : null}
          </View>
        </View>
        {phoneNumber ? (
          <Text style={[styles.phone, { color: colors.textMuted }]} numberOfLines={1}>
            {phoneNumber}
          </Text>
        ) : null}
        {lineLabel ? (
          <Text style={[styles.line, { color: colors.primary }]} numberOfLines={1}>
            via {formatPhoneDisplay(lineLabel)}
          </Text>
        ) : null}
        <View style={styles.previewRow}>
          <Text
            style={[
              styles.preview,
              { color: unreadCount > 0 ? colors.text : colors.textMuted, fontWeight: unreadCount > 0 ? '600' : '400' },
            ]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {deliveryStatus ? (
            <Text style={[styles.delivery, { color: colors.textMuted }]} numberOfLines={1}>
              {deliveryStatus}
            </Text>
          ) : null}
        </View>
      </View>
      {unreadCount > 0 ? (
        <View style={[styles.unread, { backgroundColor: colors.primary }]}>
          <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </RipplePressable>
  );
});

type VspMessageBlockProps = {
  body: string;
  direction: 'inbound' | 'outbound';
  timestamp?: string;
  status?: string;
  messageType?: string;
  deliveryError?: string | null;
  readAt?: string | null;
  deliveredAt?: string | null;
  optimistic?: boolean;
  attachments?: MessageAttachment[];
  onAttachmentPress?: (attachment: MessageAttachment) => void;
  onLongPress?: () => void;
};

export const VspMessageBlock = memo(function VspMessageBlock({
  body,
  direction,
  timestamp,
  status,
  messageType,
  deliveryError,
  readAt,
  deliveredAt,
  optimistic,
  attachments,
  onAttachmentPress,
  onLongPress,
}: VspMessageBlockProps) {
  const { colors } = useTheme();
  const isOutbound = direction === 'outbound';
  const failed = isFailedMessageStatus(status);
  const statusLabel =
    direction === 'outbound'
      ? resolveOutboundStatusLabel({ status, optimistic, deliveredAt, readAt })
      : '';
  const readLabel = null;

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={280}
      style={[
        styles.block,
        isOutbound ? styles.blockOut : styles.blockIn,
        {
          backgroundColor: isOutbound ? colors.primarySoft : colors.surface,
          borderColor: failed ? colors.error : colors.border,
        },
      ]}
      accessibilityRole="text"
    >
      {body ? (
        <Text style={[styles.blockBody, { color: colors.text }]}>{body}</Text>
      ) : null}
      {attachments?.length ? (
        <View style={styles.attachmentList}>
          {attachments.map((item) => (
            <VspAttachmentChip
              key={item.id}
              name={item.fileName || 'Attachment'}
              mimeType={item.mimeType}
              uri={attachmentUri(item)}
              sizeBytes={item.sizeBytes}
              onPress={onAttachmentPress ? () => onAttachmentPress(item) : undefined}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.blockMeta}>
        {timestamp ? (
          <Text style={[styles.blockTime, { color: colors.textMuted }]}>
            {formatMessagingTime(timestamp)}
          </Text>
        ) : null}
        {statusLabel ? (
          <VspBadge label={statusLabel} tone={failed ? 'error' : 'muted'} />
        ) : null}
        {isOutbound && readLabel ? (
          <VspBadge label={readLabel} tone="muted" />
        ) : null}
      </View>
      {deliveryError ? (
        <Text style={[styles.deliveryError, { color: colors.error }]} accessibilityRole="alert">
          {deliveryError}
        </Text>
      ) : null}
    </Pressable>
  );
});

type VspAttachmentChipProps = {
  name: string;
  mimeType?: string;
  uri?: string;
  sizeBytes?: number;
  onPress?: () => void;
};

export const VspAttachmentChip = memo(function VspAttachmentChip({
  name,
  mimeType,
  uri,
  sizeBytes,
  onPress,
}: VspAttachmentChipProps) {
  const { colors } = useTheme();
  const isImage = mimeType?.startsWith('image/');

  return (
    <RipplePressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Attachment ${name}`}
      style={[styles.attachment, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
    >
      {isImage && uri ? (
        <Image source={{ uri }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.fileIcon, { backgroundColor: colors.primarySoft }]}>
          <Text style={{ color: colors.primary }}>{mimeType === 'application/pdf' ? 'PDF' : 'FILE'}</Text>
        </View>
      )}
      <View style={styles.fileMeta}>
        <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        {sizeBytes ? (
          <Text style={[styles.fileSize, { color: colors.textMuted }]}>
            {formatAttachmentSize(sizeBytes)}
          </Text>
        ) : null}
      </View>
    </RipplePressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 88,
  },
  avatarWrap: {
    position: 'relative',
  },
  pinBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  peer: {
    ...typography.bodyMedium,
    flex: 1,
  },
  phone: {
    ...typography.caption,
  },
  time: {
    ...typography.caption,
  },
  line: {
    ...typography.caption,
    fontWeight: '600',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: {
    ...typography.caption,
    flex: 1,
  },
  delivery: {
    ...typography.caption,
    fontSize: 10,
  },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  block: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginVertical: spacing.xs,
    maxWidth: '82%',
  },
  blockIn: {
    alignSelf: 'flex-start',
  },
  blockOut: {
    alignSelf: 'flex-end',
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  blockLabel: {
    ...typography.label,
    fontSize: 10,
  },
  blockBody: {
    ...typography.body,
  },
  attachmentList: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  blockMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  blockTime: {
    ...typography.caption,
  },
  deliveryError: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    maxWidth: 260,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.sm,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileMeta: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    ...typography.caption,
  },
  fileSize: {
    ...typography.caption,
    fontSize: 10,
  },
});
