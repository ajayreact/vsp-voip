import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components';
import { ConnectionBadge } from '../ui/ConnectionBadge';
import { FadeInView } from '../ui/FadeInView';
import { getTimeGreeting } from '../../intelligence/greeting';
import { VSP_AI_BRANDING } from '../../ai/vspAiBranding';
import { useTheme } from '../../shared/theme';
import { formatPhone } from '../../utils/format';
import { spacing, tokens, typography } from '../../shared/theme';

type IntelligenceHeaderProps = {
  name: string;
  tenantName?: string;
  extension?: string;
  businessDid?: string;
  registrationLabel: string;
  isRegistered: boolean;
};

export const IntelligenceHeader = memo(function IntelligenceHeader({
  name,
  tenantName,
  extension,
  businessDid,
  registrationLabel,
  isRegistered,
}: IntelligenceHeaderProps) {
  const { colors } = useTheme();
  const greeting = getTimeGreeting();

  return (
    <FadeInView style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{VSP_AI_BRANDING.productName}</Text>
          <Text style={[styles.greeting, { color: colors.text }]}>{greeting}</Text>
          <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
        </View>
        <ConnectionBadge connected={isRegistered} label={registrationLabel} />
      </View>

      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Avatar name={name} size={56} />
        <View style={styles.meta}>
          {tenantName ? (
            <Text style={[styles.metaLine, { color: colors.text }]} numberOfLines={1}>
              {tenantName}
            </Text>
          ) : null}
          {extension ? (
            <Text style={[styles.metaSub, { color: colors.textSecondary }]}>Ext {extension}</Text>
          ) : null}
          {businessDid ? (
            <Text style={[styles.metaDid, { color: colors.primary }]}>{formatPhone(businessDid)}</Text>
          ) : null}
        </View>
      </View>
    </FadeInView>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  eyebrow: { ...typography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  greeting: { ...typography.title, marginTop: spacing.xs },
  name: { ...typography.subtitle, marginTop: 2 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: tokens.radius.xl,
    padding: spacing.md,
    ...tokens.shadow.card,
  },
  meta: { flex: 1, gap: 2 },
  metaLine: { ...typography.bodyMedium, fontWeight: '600' },
  metaSub: { ...typography.caption },
  metaDid: { ...typography.bodySmall, fontWeight: '600', marginTop: 2 },
});
