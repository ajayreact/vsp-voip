import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../shared/theme';
import { callerInitials } from '../utils/format';
import { typography } from '../shared/theme';

type AvatarProps = {
  name: string;
  size?: number;
  online?: boolean;
};

export function Avatar({ name, size = 44, online }: AvatarProps) {
  const { colors } = useTheme();
  const fontSize = size * 0.36;

  return (
    <View style={{ position: 'relative' }}>
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
        <Text style={[styles.initials, { color: colors.primary, fontSize }]}>
          {callerInitials(name)}
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
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
