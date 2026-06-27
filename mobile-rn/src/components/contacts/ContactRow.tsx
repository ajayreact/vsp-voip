import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ContactEntry } from '../../api/types';
import { Avatar } from '../Avatar';
import { RipplePressable } from '../ui/RipplePressable';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = {
  item: ContactEntry;
  isFavorite: boolean;
  onPress: (contactId: string) => void;
};

function ContactRowComponent({ item, isFavorite, onPress }: Props) {
  const { colors } = useTheme();

  return (
    <RipplePressable
      onPress={() => onPress(item.id)}
      style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
    >
      <Avatar name={item.name} online={item.isOnline} size={44} />
      <Text style={[styles.line, { color: colors.text }]} numberOfLines={1}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {'  '}
          Ext {item.extensionNumber}
          {item.department ? `  ${item.department}` : ''}
        </Text>
      </Text>
      <View
        style={[
          styles.presence,
          { backgroundColor: item.isOnline ? '#34C759' : colors.border },
        ]}
      />
      {isFavorite ? (
        <Ionicons name="star" size={16} color={colors.warning} />
      ) : null}
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
    minHeight: 52,
  },
  line: {
    flex: 1,
    minWidth: 0,
    ...typography.body,
  },
  name: {
    fontWeight: '600',
  },
  meta: {
    fontWeight: '400',
    fontSize: 14,
  },
  presence: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
