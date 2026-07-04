import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Avatar, ErrorScreen } from '../../components';
import { ContactPresenceBadge } from '../../components/contacts/ContactPresenceBadge';
import { FadeInView } from '../../components/ui/FadeInView';
import { SkeletonContactDetail } from '../../components/ui/SkeletonLoader';
import { callUnifiedContact, messageUnifiedContact } from '../../contacts/contactActions';
import { companyContactFromEntry } from '../../contacts/contactPresence';
import { mapExtensionToContact } from '../../contacts/contactsService';
import { useAuth } from '../../hooks/useAuth';
import { useContactDetail } from '../../hooks/useContacts';
import { useConversations } from '../../hooks/useConversations';
import { usePhoneConnection } from '../../hooks/usePhoneConnection';
import { formatPhoneDisplay } from '../../messaging/format';
import type { ContactsStackParamList, MainTabParamList } from '../../navigation/types';
import { CustomerTimelineSection } from '../../components/intelligence';
import { useCustomerTimeline } from '../../hooks/useCustomerTimeline';
import { useCallingStore } from '../../store/callingStore';
import { useFavoritesStore } from '../../store/favoritesStore';
import { useTheme } from '../../shared/theme';
import { spacing, tokens, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<ContactsStackParamList, 'ContactDetail'>;

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.quickAction, disabled && styles.quickActionDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={[styles.quickLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function ContactDetailScreen({ route, navigation }: Props) {
  const { contactId } = route.params;
  const { colors } = useTheme();
  const { user } = useAuth();
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const { isFavoriteContact, toggleFavoriteContact, hydrate } = useFavoritesStore();
  const { data: extension, isLoading, error, refetch } = useContactDetail(contactId);
  const { data: conversations = [] } = useConversations();
  const { canPlaceCalls } = usePhoneConnection();
  const activeCall = useCallingStore((s) => s.activeCall);
  const incomingCall = useCallingStore((s) => s.incomingCall);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const activePeers = useMemo(() => {
    const peers: string[] = [];
    if (activeCall?.identity.number) peers.push(activeCall.identity.number);
    if (incomingCall?.identity.number) peers.push(incomingCall.identity.number);
    return peers;
  }, [activeCall?.identity.number, incomingCall?.identity.number]);

  const contact = useMemo(() => {
    if (!extension) return null;
    const entry = mapExtensionToContact(extension);
    return companyContactFromEntry(entry, extension, activePeers);
  }, [activePeers, extension]);

  const contactPhones = useMemo(() => {
    if (!contact) return [] as string[];
    return [contact.assignedDidNumber, contact.extensionNumber].filter(Boolean) as string[];
  }, [contact]);

  const timeline = useCustomerTimeline(contactPhones, contact?.name || '');

  const handleShare = useCallback(async () => {
    if (!contact) return;
    const lines = [
      contact.name,
      contact.department,
      contact.extensionNumber ? `Ext ${contact.extensionNumber}` : null,
      contact.assignedDidNumber ? formatPhoneDisplay(contact.assignedDidNumber) : null,
      contact.email,
    ].filter(Boolean);
    await Share.share({ message: lines.join('\n') });
  }, [contact]);

  if (isLoading) return <SkeletonContactDetail />;
  if (error || !extension || !contact) {
    return (
      <ErrorScreen
        message={error instanceof Error ? error.message : 'Contact not found'}
        onRetry={() => refetch()}
      />
    );
  }

  const favorite = isFavoriteContact(contact);
  const phoneDisplay = contact.assignedDidNumber
    ? formatPhoneDisplay(contact.assignedDidNumber)
    : `Ext ${contact.extensionNumber}`;

  return (
    <FadeInView style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Avatar name={contact.name} size={104} online={contact.presence === 'online'} />
          <Text style={[styles.name, { color: colors.text }]}>{contact.name}</Text>
          {contact.jobTitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{contact.jobTitle}</Text>
          ) : null}
          {contact.department ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{contact.department}</Text>
          ) : null}
          <Text style={[styles.phone, { color: colors.textMuted }]}>{phoneDisplay}</Text>
          <ContactPresenceBadge presence={contact.presence} />
        </View>

        <View style={styles.quickActions}>
          <QuickAction
            icon="call-outline"
            label="Call"
            onPress={() => void callUnifiedContact(contact, canPlaceCalls)}
            disabled={!canPlaceCalls}
          />
          <QuickAction
            icon="chatbubble-outline"
            label="Message"
            onPress={() => messageUnifiedContact(contact, conversations, tabNavigation)}
          />
          <QuickAction
            icon={favorite ? 'star' : 'star-outline'}
            label={favorite ? 'Starred' : 'Favorite'}
            onPress={() => void toggleFavoriteContact(contact)}
          />
          <QuickAction icon="share-outline" label="Share" onPress={() => void handleShare()} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <DetailRow label="Extension" value={contact.extensionNumber || '—'} />
          <DetailRow label="Department" value={contact.department || '—'} />
          <DetailRow label="Business DID" value={contact.assignedDidNumber ? formatPhoneDisplay(contact.assignedDidNumber) : '—'} />
          <DetailRow label="Mobile available" value={contact.mobileAvailable ? 'Yes' : 'No'} />
          <DetailRow label="Desk phone" value={contact.deskPhoneAvailable ? 'Available' : 'Not assigned'} />
          <DetailRow label="Organization" value={user?.tenantName || '—'} />
          <DetailRow label="Email" value={contact.email || '—'} />
        </View>

        <CustomerTimelineSection timeline={timeline} />
      </ScrollView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  heroCard: {
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: tokens.radius.xl,
    padding: spacing.xl,
    ...tokens.shadow.card,
  },
  name: { ...typography.title },
  subtitle: { ...typography.bodyMedium, textAlign: 'center' },
  phone: { ...typography.body },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
  },
  quickAction: { alignItems: 'center', gap: spacing.xs, minWidth: 72 },
  quickActionDisabled: { opacity: 0.45 },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { ...typography.caption, fontWeight: '600' },
  card: {
    borderRadius: tokens.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...tokens.shadow.card,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  detailLabel: { ...typography.body, flex: 1 },
  detailValue: { ...typography.body, fontWeight: '600', flex: 1, textAlign: 'right' },
  futureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  futureChip: {
    borderWidth: 1,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    opacity: 0.65,
  },
  futureLabel: { ...typography.caption, fontWeight: '600' },
  sectionTitle: { ...typography.subtitle, paddingVertical: spacing.sm },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentMeta: { ...typography.caption },
  recentTime: { ...typography.caption },
});
