import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/theme';
import { spacing, tokens, typography } from '../../shared/theme';

type Props = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  destructive?: boolean;
  right?: ReactNode;
  showChevron?: boolean;
};

export function SettingsRow({
  title,
  subtitle,
  icon,
  onPress,
  destructive,
  right,
  showChevron = true,
}: Props) {
  const { colors } = useTheme();
  const titleColor = destructive ? colors.error : colors.text;

  const content = (
    <>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={icon} size={20} color={destructive ? colors.error : colors.primary} />
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress && showChevron && !right ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed ? colors.backgroundAlt : colors.surface },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.row, { backgroundColor: colors.surface }]}>{content}</View>;
}

export function SettingsGroup({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginHorizontal: spacing.lg,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: tokens.touchTarget + 4,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, minWidth: 0 },
  title: { ...typography.bodyMedium },
  subtitle: { ...typography.caption, marginTop: 2 },
});
