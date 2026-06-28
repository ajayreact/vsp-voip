import Constants from 'expo-constants';
import * as Application from 'expo-application';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../shared/theme';
import { env } from '../../shared/config/env';
import { spacing, typography } from '../../shared/theme';

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export function AboutScreen() {
  const { colors } = useTheme();
  const version = Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0';
  const build = Application.nativeBuildVersion || 'dev';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoText}>VSP</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>VSP Phone</Text>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>
          Cloud communications for your organization
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Row label="Version" value={version} />
        <Row label="Build" value={build} />
        <Row label="API" value={env.apiBaseUrl} />
        <Row label="Platform" value={`Expo ${Constants.expoConfig?.sdkVersion || '56'}`} />
      </View>

      <Text style={[styles.legal, { color: colors.textMuted }]}>
        Telephony powered by Telnyx. Messaging and calling features are rolled out in phased releases.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  hero: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    ...typography.title,
    color: '#fff',
    fontWeight: '800',
  },
  title: { ...typography.title },
  tagline: { ...typography.body, textAlign: 'center' },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  label: { ...typography.body },
  value: { ...typography.body, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  legal: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
