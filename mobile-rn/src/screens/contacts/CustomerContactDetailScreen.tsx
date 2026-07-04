import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Avatar, Button, ErrorScreen } from '../../components';
import { ContactPresenceBadge } from '../../components/contacts/ContactPresenceBadge';
import { FadeInView } from '../../components/ui/FadeInView';
import { callUnifiedContact, messageUnifiedContact } from '../../contacts/contactActions';
import { customerContactFromRecord } from '../../contacts/contactPresence';
import { useCustomerContactsStore } from '../../contacts/customerContactsStore';
import { formatPhoneDisplay } from '../../messaging/format';
import { CustomerTimelineSection } from '../../components/intelligence';
import { useCustomerTimeline } from '../../hooks/useCustomerTimeline';
import { useConversations } from '../../hooks/useConversations';
import { usePhoneConnection } from '../../hooks/usePhoneConnection';
import type { ContactsStackParamList, MainTabParamList } from '../../navigation/types';
import { useFavoritesStore } from '../../store/favoritesStore';
import { useTheme } from '../../shared/theme';
import { spacing, tokens, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<ContactsStackParamList, 'CustomerContactDetail'>;

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export function CustomerContactDetailScreen({ route, navigation }: Props) {
  const { customerId } = route.params;
  const { colors } = useTheme();
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const { items, hydrate, remove } = useCustomerContactsStore();
  const { isFavoriteContact, toggleFavoriteContact, hydrate: hydrateFavorites } = useFavoritesStore();
  const { data: conversations = [] } = useConversations();
  const { canPlaceCalls } = usePhoneConnection();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.all([hydrate(), hydrateFavorites()]).finally(() => setReady(true));
  }, [hydrate, hydrateFavorites]);

  const record = items.find((item) => item.id === customerId);
  const contact = record ? customerContactFromRecord(record) : null;

  if (!ready) return null;
  if (!contact) {
    return <ErrorScreen message="Customer contact not found" onRetry={() => navigation.goBack()} />;
  }

  const favorite = isFavoriteContact(contact);
  const timeline = useCustomerTimeline(contact.phoneNumbers, contact.name);

  async function handleShare() {
    const lines = [
      contact!.name,
      contact!.company,
      ...contact!.phoneNumbers.map((number) => formatPhoneDisplay(number)),
      contact!.email,
    ].filter(Boolean);
    await Share.share({ message: lines.join('\n') });
  }

  return (
    <FadeInView style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Avatar name={contact.name} size={96} />
          <Text style={[styles.name, { color: colors.text }]}>{contact.name}</Text>
          {contact.company ? (
            <Text style={[styles.company, { color: colors.textMuted }]}>{contact.company}</Text>
          ) : null}
          <ContactPresenceBadge presence={contact.presence} />
        </View>

        <View style={styles.quickActions}>
          <QuickAction icon="call-outline" label="Call" onPress={() => void callUnifiedContact(contact, canPlaceCalls)} />
          <QuickAction icon="chatbubble-outline" label="Message" onPress={() => messageUnifiedContact(contact, conversations, tabNavigation)} />
          <QuickAction icon="share-outline" label="Share" onPress={() => void handleShare()} />
          <QuickAction
            icon={favorite ? 'star' : 'star-outline'}
            label={favorite ? 'Starred' : 'Favorite'}
            onPress={() => void toggleFavoriteContact(contact)}
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {contact.phoneNumbers.map((number, index) => (
            <DetailRow key={number} label={index === 0 ? 'Phone' : `Phone ${index + 1}`} value={formatPhoneDisplay(number)} />
          ))}
          <DetailRow label="Email" value={contact.email || '—'} />
          <DetailRow label="Notes" value={contact.notes || '—'} />
          <DetailRow
            label="Last contact"
            value={contact.lastContactAt ? new Date(contact.lastContactAt).toLocaleString() : '—'}
          />
        </View>

        <CustomerTimelineSection timeline={timeline} />

        <Button
          label="Edit contact"
          onPress={() => navigation.navigate('CustomerContactForm', { customerId })}
        />
        <Button
          label="Delete contact"
          variant="ghost"
          onPress={() => {
            Alert.alert('Delete contact?', 'This customer contact will be removed from this device.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  void remove(customerId).then(() => navigation.goBack());
                },
              },
            ]);
          }}
        />
      </ScrollView>
    </FadeInView>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.quickAction} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={[styles.quickLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
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
  company: { ...typography.bodyMedium },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
  },
  quickAction: { alignItems: 'center', gap: spacing.xs, minWidth: 72 },
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
});
