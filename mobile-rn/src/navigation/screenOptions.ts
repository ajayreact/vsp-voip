import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { ThemeColors } from '../shared/theme/colors';
import { MOTION } from '../lib/animations';

type StackOptionsConfig = {
  reduceMotion?: boolean;
};

export function createStackScreenOptions(
  colors: ThemeColors,
  config: StackOptionsConfig = {},
): NativeStackNavigationOptions {
  const { reduceMotion = false } = config;
  return {
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
    animation: reduceMotion ? 'none' : 'slide_from_right',
    animationDuration: reduceMotion ? 0 : MOTION.screenTransitionMs,
    gestureEnabled: !reduceMotion,
    fullScreenGestureEnabled: !reduceMotion,
    freezeOnBlur: true,
  };
}

/** Push transitions for detail screens — target under 200ms. */
export function detailScreenOptions(reduceMotion = false): NativeStackNavigationOptions {
  return {
    animation: reduceMotion ? 'none' : 'slide_from_right',
    animationDuration: reduceMotion ? 0 : MOTION.screenTransitionMs,
    gestureEnabled: !reduceMotion,
    fullScreenGestureEnabled: !reduceMotion,
  };
}

/** @deprecated Use detailScreenOptions() */
export const DETAIL_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  animation: 'slide_from_right',
  animationDuration: MOTION.screenTransitionMs,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
};

/** Modal-style transitions for thread / search flows. */
export function modalScreenOptions(reduceMotion = false): NativeStackNavigationOptions {
  return {
    animation: reduceMotion ? 'none' : 'fade_from_bottom',
    animationDuration: reduceMotion ? 0 : MOTION.screenTransitionMs,
    gestureEnabled: !reduceMotion,
  };
}

/** @deprecated Use modalScreenOptions() */
export const MODAL_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  animation: 'fade_from_bottom',
  animationDuration: MOTION.screenTransitionMs,
  gestureEnabled: true,
};

export const TAB_SCREEN_OPTIONS = {
  lazy: true,
  freezeOnBlur: true,
} as const;
