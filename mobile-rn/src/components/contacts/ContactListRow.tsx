import React, { memo, useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import type { UnifiedContact } from '../../contacts/types';
import { primaryDialNumber } from '../../contacts/types';
import { Avatar } from '../Avatar';
import { RipplePressable } from '../ui/RipplePressable';
import { ContactPresenceBadge } from './ContactPresenceBadge';
import { formatPhoneDisplay } from '../../messaging/format';
import { useTheme } from '../../shared/theme';
import { spacing, typography, tokens } from '../../shared/theme';

type Props = {
  contact: UnifiedContact;
  isFavorite: boolean;
  onPress: (contact: UnifiedContact) => void;
  onCall?: (contact: UnifiedContact) => void;
  onMessage?: (contact: UnifiedContact) => void;
  onFavorite?: (contact: UnifiedContact) => void;
};

function SwipeAction({
  label,
  icon,
  tone,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'primary' | 'success' | 'warning';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const background =
    tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.action, { backgroundColor: background }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function ContactListRowComponent({
  contact,
  isFavorite,
  onPress,
  onCall,
  onMessage,
  onFavorite,
}: Props) {
  const { colors } = useTheme();
  const swipeRef = useRef<Swipeable>(null);
  const dial = primaryDialNumber(contact);

  const subtitle =
    contact.kind === 'company'
      ? [
          contact.extensionNumber ? `Ext ${contact.extensionNumber}` : null,
          contact.department,
          contact.assignedDidNumber ? formatPhoneDisplay(contact.assignedDidNumber) : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : [contact.company, contact.phoneNumbers[0] ? formatPhoneDisplay(contact.phoneNumbers[0]) : null]
          .filter(Boolean)
          .join(' · ');

  const closeSwipe = useCallback(() => {
    swipeRef.current?.close();
  }, []);

  const renderRightActions = useCallback(
    () => (
      <View style={styles.actions}>
        {onFavorite ? (
          <SwipeAction
            label={isFavorite ? 'Unstar' : 'Favorite'}
            icon={isFavorite ? 'star' : 'star-outline'}
            tone="warning"
            onPress={() => {
              closeSwipe();
              onFavorite(contact);
            }}
          />
        ) : null}
        {onMessage && dial ? (
          <SwipeAction
            label="Message"
            icon="chatbubble-outline"
            tone="primary"
            onPress={() => {
              closeSwipe();
              onMessage(contact);
            }}
          />
        ) : null}
        {onCall && dial ? (
          <SwipeAction
            label="Call"
            icon="call-outline"
            tone="success"
            onPress={() => {
              closeSwipe();
              onCall(contact);
            }}
          />
        ) : null}
      </View>
    ),
    [closeSwipe, contact, dial, isFavorite, onCall, onFavorite, onMessage],
  );

  const row = (
    <RipplePressable
      onPress={() => onPress(contact)}
      style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${contact.name}, ${subtitle}`}
    >
      <View style={styles.avatarWrap}>
        <Avatar
          name={contact.name}
          online={contact.presence === 'online'}
          size={52}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {contact.name}
          </Text>
          {isFavorite ? (
            <Ionicons name="star" size={14} color={colors.warning} accessibilityLabel="Favorite" />
          ) : null}
        </View>
        <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
        <View style={styles.metaRow}>
          <ContactPresenceBadge presence={contact.presence} />
          {contact.kind === 'company' && contact.mobileAvailable ? (
            <Text style={[styles.meta, { color: colors.primary }]}>Mobile</Text>
          ) : null}
          {contact.kind === 'company' && contact.deskPhoneAvailable ? (
            <Text style={[styles.meta, { color: colors.textMuted }]}>Desk</Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </RipplePressable>
  );

  if (!onCall && !onMessage && !onFavorite) return row;

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      {row}
    </Swipeable>
  );
}

export const ContactListRow = memo(ContactListRowComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 76,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  meta: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  action: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  actionLabel: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
});
