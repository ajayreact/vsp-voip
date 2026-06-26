import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../Avatar';
import { VspBadge } from './VspBadge';
import { useTheme } from '../../shared/theme';
import { formatRelativeTime } from '../../utils/format';
import { spacing, tokens, typography } from '../../shared/theme';

type VspConversationRowProps = {
  peerLabel: string;
  lineLabel?: string;
  preview: string;
  timestamp?: string;
  unreadCount?: number;
  onPress?: () => void;
};

/**
 * Enterprise conversation row — card-style with left accent bar, not chat-app bubbles list.
 */
export function VspConversationRow({
  peerLabel,
  lineLabel,
  preview,
  timestamp,
  unreadCount = 0,
  onPress,
}: VspConversationRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.backgroundAlt : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: colors.primary }]} />
      <Avatar name={peerLabel} size={44} />
      <View style={styles.content}>
        <View style={styles.topLine}>
          <Text style={[styles.peer, { color: colors.text }]} numberOfLines={1}>
            {peerLabel}
          </Text>
          {timestamp ? (
            <Text style={[styles.time, { color: colors.textMuted }]}>
              {formatRelativeTime(timestamp)}
            </Text>
          ) : null}
        </View>
        {lineLabel ? (
          <Text style={[styles.line, { color: colors.textMuted }]} numberOfLines={1}>
            Line {lineLabel}
          </Text>
        ) : null}
        <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={2}>
          {preview}
        </Text>
      </View>
      {unreadCount > 0 ? (
        <View style={[styles.unread, { backgroundColor: colors.primary }]}>
          <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

type VspMessageBlockProps = {
  body: string;
  direction: 'inbound' | 'outbound';
  timestamp?: string;
  status?: string;
};

/**
 * Flat message blocks with directional accent — not consumer chat bubbles.
 */
export function VspMessageBlock({ body, direction, timestamp, status }: VspMessageBlockProps) {
  const { colors } = useTheme();
  const isOutbound = direction === 'outbound';

  return (
    <View
      style={[
        styles.block,
        isOutbound ? styles.blockOut : styles.blockIn,
        {
          backgroundColor: isOutbound ? colors.primarySoft : colors.surface,
          borderColor: isOutbound ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.blockLabel, { color: colors.textMuted }]}>
        {isOutbound ? 'Sent' : 'Received'}
      </Text>
      <Text style={[styles.blockBody, { color: colors.text }]}>{body}</Text>
      <View style={styles.blockMeta}>
        {timestamp ? (
          <Text style={[styles.blockTime, { color: colors.textMuted }]}>
            {formatRelativeTime(timestamp)}
          </Text>
        ) : null}
        {status ? <VspBadge label={status} tone="muted" /> : null}
      </View>
    </View>
  );
}

type VspAttachmentChipProps = {
  name: string;
  mimeType?: string;
  uri?: string;
  onPress?: () => void;
};

export function VspAttachmentChip({ name, mimeType, uri, onPress }: VspAttachmentChipProps) {
  const { colors } = useTheme();
  const isImage = mimeType?.startsWith('image/');

  return (
    <Pressable
      onPress={onPress}
      style={[styles.attachment, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
    >
      {isImage && uri ? (
        <Image source={{ uri }} style={styles.thumb} />
      ) : (
        <View style={[styles.fileIcon, { backgroundColor: colors.primarySoft }]}>
          <Text style={{ color: colors.primary }}>📎</Text>
        </View>
      )}
      <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  peer: {
    ...typography.bodyMedium,
    flex: 1,
  },
  time: {
    ...typography.caption,
  },
  line: {
    ...typography.caption,
  },
  preview: {
    ...typography.caption,
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
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginVertical: spacing.xs,
    maxWidth: '92%',
  },
  blockIn: {
    alignSelf: 'flex-start',
  },
  blockOut: {
    alignSelf: 'flex-end',
  },
  blockLabel: {
    ...typography.label,
    fontSize: 10,
    marginBottom: spacing.xs,
  },
  blockBody: {
    ...typography.body,
  },
  blockMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  blockTime: {
    ...typography.caption,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    maxWidth: 220,
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
  fileName: {
    ...typography.caption,
    flex: 1,
  },
});
