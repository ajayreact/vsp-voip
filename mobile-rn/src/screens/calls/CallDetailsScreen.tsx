import React, { useMemo } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, VspBadge, VspPanel } from '../../components';
import { placeOutboundCall, getFriendlyCallError } from '../../calling/callingController';
import { useRecentCalls } from '../../hooks/useRecentCalls';
import { useTheme } from '../../shared/theme';
import { formatPhone, formatRelativeTime } from '../../utils/format';
import { getFriendlyErrorMessage } from '../../utils/friendlyError';
import { spacing, tokens, typography } from '../../shared/theme';
import type { RecentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RecentStackParamList, 'CallDetails'>;

export function CallDetailsScreen({ route, navigation }: Props) {
  const { callId, call: paramCall } = route.params;
  const { colors } = useTheme();
  const { data: calls = [] } = useRecentCalls();
  const tabNavigation = navigation.getParent()?.getParent();

  const call = useMemo(
    () => paramCall ?? calls.find((c) => c.id === callId) ?? null,
    [paramCall, calls, callId],
  );

  if (!call) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>Call details unavailable</Text>
        <Button label="Go back" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const number = call.direction === 'inbound' ? call.from : call.to;
  const displayName = formatPhone(number);

  async function handleCall() {
    try {
      await placeOutboundCall(number);
    } catch (err) {
      Alert.alert('Call failed', getFriendlyCallError(err));
    }
  }

  function handleCopy() {
    void Share.share({ message: number });
  }

  function handleDelete() {
    Alert.alert('Delete call log', 'This removes the entry from your recent activity on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Avatar name={displayName} size={88} />
        <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>
        <Text style={[styles.number, { color: colors.textMuted }]}>{number}</Text>
        <VspBadge
          label={call.status}
          tone={call.status?.toLowerCase().includes('miss') ? 'warning' : 'primary'}
        />
      </View>

      <VspPanel>
        <DetailRow label="Date" value={formatRelativeTime(call.createdAt)} />
        <DetailRow label="Duration" value={call.durationLabel || `${call.durationSeconds ?? 0}s`} />
        <DetailRow label="Type" value={call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} />
        <DetailRow label="Status" value={call.status} />
      </VspPanel>

      <View style={styles.actions}>
        <ActionButton icon="call" label="Call" onPress={handleCall} />
        <ActionButton icon="chatbubble-ellipses" label="Message" onPress={() => {}} />
        <ActionButton icon="person-add" label="Add contact" onPress={() => {}} />
        <ActionButton icon="copy" label="Copy" onPress={handleCopy} />
        <ActionButton icon="trash" label="Delete" onPress={handleDelete} destructive />
      </View>

      {call.callType?.includes('voicemail') ? (
        <VspPanel>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Voicemail</Text>
          <Text style={{ color: colors.textMuted }}>Open voicemail tab to listen to recordings.</Text>
          <Button
            label="Open voicemail"
            variant="secondary"
            onPress={() => tabNavigation?.navigate('You', { screen: 'VoicemailList' })}
            style={{ marginTop: spacing.sm }}
          />
        </VspPanel>
      ) : null}
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  const tone = destructive ? colors.error : colors.primary;
  return (
    <Button label={label} variant={destructive ? 'ghost' : 'secondary'} onPress={onPress} style={styles.actionBtn} />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  name: { ...typography.title },
  number: { ...typography.body },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  detailLabel: { ...typography.caption },
  detailValue: { ...typography.bodyMedium },
  actions: { gap: spacing.sm },
  actionBtn: { width: '100%' },
  sectionTitle: { ...typography.subtitle, marginBottom: spacing.xs },
});
