import React, { memo, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { AudioRouteKind } from '../../calling/callDisplay';
import { getAudioRouteLabel } from '../../calling/callDisplay';
import { selectCallAudioRoute, syncCallAudioRoute } from '../../calling/audioRoute';
import { useCallingStore } from '../../store/callingStore';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

const ROUTES: AudioRouteKind[] = ['phone', 'speaker', 'bluetooth', 'wired'];

const ROUTE_ICONS: Record<AudioRouteKind, keyof typeof Ionicons.glyphMap> = {
  phone: 'phone-portrait-outline',
  speaker: 'volume-high-outline',
  bluetooth: 'bluetooth-outline',
  wired: 'headset-outline',
};

type Props = {
  visible: boolean;
  currentRoute: AudioRouteKind;
  availableRoutes: AudioRouteKind[];
  onClose: () => void;
  onRouteSelected: (route: AudioRouteKind) => void;
};

function AudioRoutePickerComponent({
  visible,
  currentRoute,
  availableRoutes,
  onClose,
  onRouteSelected,
}: Props) {
  const { colors } = useTheme();

  const options = useMemo(
    () => ROUTES.filter((route) => availableRoutes.includes(route)),
    [availableRoutes],
  );

  const handleSelect = (route: AudioRouteKind) => {
    selectCallAudioRoute(route);
    const speakerOn = route === 'speaker';
    syncCallAudioRoute(speakerOn);
    useCallingStore.getState().patchActiveCall({ speakerOn });
    onRouteSelected(route);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.title, { color: colors.text }]}>Audio</Text>
          {options.map((route) => {
            const selected = route === currentRoute;
            return (
              <Pressable
                key={route}
                onPress={() => handleSelect(route)}
                style={[
                  styles.option,
                  {
                    backgroundColor: selected ? colors.primarySoft : 'transparent',
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={ROUTE_ICONS[route]}
                  size={22}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.optionLabel, { color: selected ? colors.primary : colors.text }]}>
                  {getAudioRouteLabel(route)}
                </Text>
                {selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export const AudioRoutePicker = memo(AudioRoutePickerComponent);

export function useAvailableAudioRoutes(
  currentRoute: AudioRouteKind,
  detected: AudioRouteKind[] = [],
): AudioRouteKind[] {
  const [routes, setRoutes] = useState<AudioRouteKind[]>(['phone', 'speaker']);

  useEffect(() => {
    const merged = new Set<AudioRouteKind>(['phone', 'speaker', ...detected, currentRoute]);
    setRoutes([...merged]);
  }, [currentRoute, detected]);

  return routes;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  optionLabel: {
    ...typography.bodyMedium,
    flex: 1,
    fontWeight: '600',
  },
});
