import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ContactEntry } from '../../api/types';
import { Avatar } from '../Avatar';
import { RipplePressable } from '../ui/RipplePressable';
import { useTheme } from '../../shared/theme';
import { spacing, typography, tokens } from '../../shared/theme';

type Props = {
  item: ContactEntry;
  isFavorite: boolean;
  onPress: (contactId: string) => void;
};

function ContactRowComponent({ item, isFavorite, onPress }: Props) {
  const { colors } = useTheme();
  const subtitle = [
    `Ext ${item.extensionNumber}`,
    item.department,
  ].filter(Boolean).join(' · ');

  return (
    <RipplePressable
      onPress={() => onPress(item.id)}
      style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${subtitle}${item.isOnline ? ', online' : ', offline'}`}
    >
      <View style={styles.avatarWrap}>
        <Avatar name={item.name} online={item.isOnline} size={48} />
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          {isFavorite ? (
            <Ionicons
              name="star"
              size={14}
              color={colors.warning}
              accessibilityLabel="Favorite"
            />
          ) : null}
        </View>
        <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.presenceDot,
              { backgroundColor: item.isOnline ? '#34C759' : colors.border },
            ]}
          />
          <Text style={[styles.statusText, { color: colors.textMuted }]}>
            {item.isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </RipplePressable>
  );
}

export const ContactRow = memo(ContactRowComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 68,
  },
  avatarWrap: {
    ...tokens.shadow.card,
    borderRadius: 999,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.bodyMedium,
    fontWeight: '600',
    flex: 1,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 13,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.caption,
    fontSize: 12,
  },
});
