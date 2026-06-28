import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { FadeInView } from './ui/FadeInView';
import { useTheme } from '../shared/theme';
import { callerInitials } from '../utils/format';
import { MOTION } from '../lib/animations';
import { typography } from '../shared/theme';

type AvatarProps = {
  name: string;
  size?: number;
  online?: boolean;
  uri?: string | null;
};

function AvatarComponent({ name, size = 44, online, uri }: AvatarProps) {
  const { colors } = useTheme();
  const fontSize = size * 0.36;

  return (
    <FadeInView style={styles.wrap}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: `${colors.primary}22`,
          },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={MOTION.imageTransitionMs}
            accessibilityLabel={`Avatar for ${name}`}
          />
        ) : (
          <Text style={[styles.initials, { color: colors.primary, fontSize }]}>
            {callerInitials(name)}
          </Text>
        )}
      </View>
      {online !== undefined ? (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: online ? colors.online : colors.offline,
              borderColor: colors.surface,
            },
          ]}
        />
      ) : null}
    </FadeInView>
  );
}

export const Avatar = memo(AvatarComponent);

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    ...typography.subtitle,
    fontWeight: '700',
  },
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});
