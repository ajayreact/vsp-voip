import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = {
  title: string;
  tooltipKey?: string;
  tooltipText?: string;
  children: React.ReactNode;
  collapsed?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onToggle?: (expanded: boolean) => void;
};

export function SipSectionCard({
  title,
  tooltipKey,
  tooltipText,
  children,
  collapsed,
  collapsible,
  defaultCollapsed = false,
  onToggle,
}: Props) {
  const { colors } = useTheme();
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsed ?? internalCollapsed;
  const canCollapse = collapsible ?? defaultCollapsed;

  const showTooltip = () => {
    if (!tooltipText) return;
    Alert.alert(title, tooltipText);
  };

  const toggle = () => {
    if (!canCollapse) return;
    const next = !isCollapsed;
    setInternalCollapsed(next);
    onToggle?.(next);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        onPress={canCollapse ? toggle : undefined}
        style={styles.header}
        accessibilityRole="header"
      >
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <View style={styles.headerActions}>
          {tooltipText ? (
            <Pressable
              onPress={showTooltip}
              hitSlop={8}
              accessibilityLabel={`About ${title}`}
              accessibilityHint={tooltipKey}
            >
              <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
          {canCollapse ? (
            <Ionicons
              name={isCollapsed ? 'chevron-down' : 'chevron-up'}
              size={18}
              color={colors.textMuted}
            />
          ) : null}
        </View>
      </Pressable>
      {!isCollapsed ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  title: { ...typography.subtitle },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
});
