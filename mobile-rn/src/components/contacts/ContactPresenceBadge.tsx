import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ContactPresence } from '../../contacts/types';
import { getPresenceLabel } from '../../contacts/contactPresence';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

const PRESENCE_COLORS: Record<ContactPresence, string> = {
  online: '#34C759',
  offline: '#A0A0A8',
  on_call: '#FF9500',
  dnd: '#FF3B30',
  unknown: '#A0A0A8',
};

type Props = {
  presence: ContactPresence;
  compact?: boolean;
};

export const ContactPresenceBadge = memo(function ContactPresenceBadge({ presence, compact }: Props) {
  const { colors } = useTheme();
  const tone = PRESENCE_COLORS[presence];

  return (
    <View style={styles.wrap}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      {!compact ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>{getPresenceLabel(presence)}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...typography.caption,
    fontSize: 12,
  },
});
