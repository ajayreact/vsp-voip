import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ContactEntry } from '../../api/types';
import { Avatar } from '../Avatar';
import { conversationDisplayName, displayNameForPeer } from '../../messaging/conversationDisplay';
import { formatPhoneDisplay } from '../../messaging/format';
import { useTheme } from '../../shared/theme';
import { spacing, tokens, typography } from '../../shared/theme';

type ConversationThreadHeaderProps = {
  peerNumber: string;
  lineNumber: string;
  contact?: ContactEntry;
};

export const ConversationThreadHeader = memo(function ConversationThreadHeader({
  peerNumber,
  lineNumber,
  contact,
}: ConversationThreadHeaderProps) {
  const { colors } = useTheme();
  const title = displayNameForPeer(peerNumber, contact);
  const phone = formatPhoneDisplay(peerNumber);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Avatar name={title} size={52} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
          {phone}
        </Text>
        <View style={styles.lineRow}>
          <Ionicons name="business-outline" size={14} color={colors.primary} />
          <Text style={[styles.line, { color: colors.textMuted }]} numberOfLines={1}>
            Business line {formatPhoneDisplay(lineNumber)}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: tokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...tokens.shadow.card,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  line: {
    ...typography.caption,
    flex: 1,
  },
});
