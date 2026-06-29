/** Shared motion constants — keep transitions under 200ms for snappy navigation. */
import { LayoutAnimation, Platform, UIManager } from 'react-native';

export const MOTION = {
  pressScale: 0.98,
  pressInMs: 80,
  pressOutMs: 120,
  screenTransitionMs: 200,
  imageTransitionMs: 150,
  fadeMs: 180,
  skeletonPulseMs: 900,
} as const;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function configureLayoutAnimation(reduceMotion: boolean): void {
  if (reduceMotion) return;
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}
