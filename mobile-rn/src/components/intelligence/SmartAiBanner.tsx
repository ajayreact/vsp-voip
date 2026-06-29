import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VSP_AI_BRANDING } from '../../ai/vspAiBranding';
import type { SmartBanner } from '../../intelligence/types';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type SmartAiBannerProps = {
  banner: SmartBanner;
  onPress?: () => void;
};

export const SmartAiBanner = memo(function SmartAiBanner({ banner, onPress }: SmartAiBannerProps) {
  const { colors } = useTheme();
  const [label, ...rest] = banner.message.split('\n');
  const body = rest.join('\n').trim();

  const content = (
    <>
      <Ionicons name="sparkles" size={16} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: colors.primary }]}>{label || VSP_AI_BRANDING.recommendedBy}</Text>
        {body ? <Text style={[styles.body, { color: colors.text }]}>{body}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[
          styles.banner,
          {
            backgroundColor: banner.priority === 'high' ? colors.primarySoft : colors.surface,
            borderColor: colors.border,
          },
        ]}
        accessibilityRole="text"
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.banner,
        {
          backgroundColor: banner.priority === 'high' ? colors.primarySoft : colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={body || label}
    >
      {content}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    minHeight: 44,
  },
  label: { ...typography.caption, fontWeight: '700' },
  body: { ...typography.bodySmall, marginTop: 2 },
});
