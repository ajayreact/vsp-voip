import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CallLogEntry, ExtensionRecord } from '../../api/types';
import { Avatar, ErrorScreen } from '../../components';
import { FadeInView } from '../../components/ui/FadeInView';
import { SkeletonContactDetail } from '../../components/ui/SkeletonLoader';
import { getFriendlyCallError, placeOutboundCall } from '../../calling/callingController';
import { usePhoneConnection } from '../../hooks/usePhoneConnection';
import { fetchContactDetail, mapExtensionToContact } from '../../contacts';
import { useAuth } from '../../hooks/useAuth';
import { useConversations } from '../../hooks/useConversations';
import { useRecentCalls } from '../../hooks/useRecentCalls';
import { findConversationByPeer } from '../../messaging/conversationLookup';
import { formatMessagingTime, formatPhoneDisplay } from '../../messaging/format';
import type { ContactsStackParamList, MainTabParamList } from '../../navigation/types';
import { useFavoritesStore } from '../../store/favoritesStore';
import { useTheme } from '../../shared/theme';
import { formatPhone, formatRelativeTime } from '../../utils/format';
import { spacing, typography } from '../../shared/theme';

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
  const { isFavorite, toggleFavorite, hydrate } = useFavoritesStore();
  const { data: recentCalls = [] } = useRecentCalls();
  const { data: conversations = [] } = useConversations();
  const [extension, setExtension] = useState<ExtensionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const { canPlaceCalls } = usePhoneConnection();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContactDetail(contactId);
      setExtension(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    hydrate();
    load();
  }, [hydrate, load]);

  const contact = extension ? mapExtensionToContact(extension) : null;
  const dialNumber = contact?.assignedDidNumber || contact?.extensionNumber || '';
  const phoneDisplay = contact?.assignedDidNumber
    ? formatPhone(contact.assignedDidNumber)
    : contact
      ? `Ext ${contact.extensionNumber}`
      : '—';

  const relatedCalls = useMemo(() => {
    if (!contact) return [] as CallLogEntry[];
    const ext = contact.extensionNumber.replace(/\D/g, '');
    const did = (contact.assignedDidNumber || '').replace(/\D/g, '');
    return recentCalls
      .filter((call) => {
        const peer = call.direction === 'inbound' ? call.from : call.to;
        const key = peer.replace(/\D/g, '');
        return key === ext || key === did || (key.length >= 10 && did.length >= 10 && key.slice(-10) === did.slice(-10));
      })
      .slice(0, 5);
  }, [contact, recentCalls]);

  const messagingPeer = contact?.assignedDidNumber || contact?.extensionNumber || '';
  const relatedConversation = useMemo(
    () => (messagingPeer ? findConversationByPeer(conversations, messagingPeer) : undefined),
    [conversations, messagingPeer],
  );

  async function handleCall() {
    if (!dialNumber) return;
    if (!canPlaceCalls) {
      Alert.alert(
        'Unable to place call',
        'The phone is not connected. Please wait while we reconnect.',
      );
      return;
    }
    setCalling(true);
    try {
      await placeOutboundCall(dialNumber);
    } catch (err) {
      Alert.alert('Unable to place call', getFriendlyCallError(err));
    } finally {
      setCalling(false);
    }
  }

  function handleMessage() {
    if (!contact) return;
    const peerNumber = contact.assignedDidNumber || contact.extensionNumber;
    const existing = findConversationByPeer(conversations, peerNumber);
    if (existing) {
      tabNavigation?.navigate('Text', {
        screen: 'ConversationThread',
        params: {
          conversationId: existing.id,
          peerLabel: formatPhoneDisplay(existing.peer),
          lineLabel: existing.line,
          peerNumber: existing.peer,
        },
      });
      return;
    }
    tabNavigation?.navigate('Text', {
      screen: 'NewMessage',
      params: {
        peerNumber,
        peerLabel: contact.name,
      },
    });
  }

  function openRecentConversation() {
    if (!relatedConversation || !contact) return;
    tabNavigation?.navigate('Text', {
      screen: 'ConversationThread',
      params: {
        conversationId: relatedConversation.id,
        peerLabel: formatPhoneDisplay(relatedConversation.peer),
        lineLabel: relatedConversation.line,
        peerNumber: relatedConversation.peer,
      },
    });
  }

  if (loading) return <SkeletonContactDetail />;
  if (error || !extension || !contact) {
    return <ErrorScreen message={error || 'Contact not found'} onRetry={load} />;
  }

  const favorite = isFavorite(contact.id);
  const sipOnline = Boolean(extension.registration?.isLive);

  return (
    <FadeInView style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Avatar name={contact.name} size={96} online={contact.isOnline} />
          <Text style={[styles.name, { color: colors.text }]}>{contact.name}</Text>
          <Text style={[styles.phone, { color: colors.textMuted }]}>{phoneDisplay}</Text>
          {contact.department ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{contact.department}</Text>
          ) : null}
        </View>

        <View style={styles.quickActions}>
          <QuickAction icon="chatbubble-outline" label="Message" onPress={handleMessage} />
          <QuickAction
            icon="call-outline"
            label="Audio"
            onPress={() => void handleCall()}
            disabled={calling || !dialNumber || !canPlaceCalls}
          />
          <QuickAction icon="videocam-outline" label="Video" onPress={() => {}} disabled />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <DetailRow label="Extension" value={contact.extensionNumber} />
          <DetailRow label="Department" value={contact.department || '—'} />
          <DetailRow label="Organization" value={user?.tenantName || '—'} />
          <DetailRow label="Email" value={contact.email || '—'} />
          <DetailRow label="SIP Status" value={sipOnline ? 'Registered' : 'Offline'} />
          <DetailRow
            label="Assigned devices"
            value={sipOnline ? 'Softphone (online)' : 'No active softphone'}
          />
        </View>

        <Pressable
          onPress={() => toggleFavorite(contact.id)}
          style={[styles.favoriteRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons
            name={favorite ? 'star' : 'star-outline'}
            size={22}
            color={favorite ? colors.warning : colors.textMuted}
          />
          <Text style={[styles.favoriteLabel, { color: colors.text }]}>
            {favorite ? 'Remove from favorites' : 'Add to favorites'}
          </Text>
        </Pressable>

        {relatedCalls.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Calls</Text>
            {relatedCalls.map((call) => (
              <View key={call.id} style={[styles.recentRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.recentMeta, { color: colors.text }]}>
                  {call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} · {call.status}
                </Text>
                <Text style={[styles.recentTime, { color: colors.textMuted }]}>
                  {formatRelativeTime(call.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {relatedConversation ? (
          <Pressable
            onPress={openRecentConversation}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Messages</Text>
            <View style={styles.messagePreview}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
              <View style={styles.messagePreviewText}>
                <Text style={[styles.recentMeta, { color: colors.text }]} numberOfLines={1}>
                  {relatedConversation.lastMessagePreview || 'Open conversation'}
                </Text>
                {relatedConversation.lastMessageAt ? (
                  <Text style={[styles.recentTime, { color: colors.textMuted }]}>
                    {formatMessagingTime(relatedConversation.lastMessageAt)}
                  </Text>
                ) : null}
              </View>
              {relatedConversation.unreadCount > 0 ? (
                <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.unreadText}>{relatedConversation.unreadCount}</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              )}
            </View>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => {}}
          disabled
          style={[styles.blockRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.5 }]}
        >
          <Ionicons name="ban-outline" size={20} color={colors.error} />
          <Text style={[styles.blockLabel, { color: colors.error }]}>Block (coming soon)</Text>
        </Pressable>
      </ScrollView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  name: { ...typography.title, marginTop: spacing.sm },
  phone: { ...typography.body },
  subtitle: { ...typography.caption },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
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
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
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
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  favoriteLabel: { ...typography.bodyMedium },
  sectionTitle: { ...typography.subtitle, paddingVertical: spacing.sm },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentMeta: { ...typography.caption },
  recentTime: { ...typography.caption },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  blockLabel: { ...typography.bodyMedium },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  messagePreviewText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  unreadBadge: {
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
});
