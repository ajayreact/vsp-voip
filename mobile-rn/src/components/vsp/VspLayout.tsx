import { LinearGradient } from 'expo-linear-gradient';
import React, { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../shared/theme';
import { spacing, tokens, typography } from '../../shared/theme';

type VspHeroProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  style?: ViewStyle;
};

/** Web portal hero-banner equivalent — indigo gradient, enterprise tone */
export function VspHero({ eyebrow, title, subtitle, trailing, style }: VspHeroProps) {
  const { colors } = useTheme();

  return (
    <LinearGradient
      colors={[colors.heroStart, colors.heroMid, colors.heroEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, tokens.shadow.hero, style]}
    >
      <View style={styles.heroContent}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </LinearGradient>
  );
}

type VspPanelProps = {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
};

/** Web panel-card equivalent */
export function VspPanel({ children, style, padded = true }: VspPanelProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.panel,
        tokens.shadow.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        padded && styles.panelPadded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

type VspSectionHeaderProps = {
  title: string;
  action?: ReactNode;
};

export function VspSectionHeader({ title, action }: VspSectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: tokens.radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 120,
  },
  heroContent: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.label,
    color: '#c7d2fe',
  },
  title: {
    ...typography.title,
    color: '#ffffff',
  },
  subtitle: {
    ...typography.body,
    color: '#e0e7ff',
  },
  panel: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  panelPadded: {
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.section,
    fontSize: 12,
  },
});
