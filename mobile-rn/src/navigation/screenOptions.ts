import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { ThemeColors } from '../shared/theme/colors';
import { MOTION } from '../lib/animations';

export function createStackScreenOptions(colors: ThemeColors): NativeStackNavigationOptions {
  return {
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
    animation: 'slide_from_right',
    animationDuration: MOTION.screenTransitionMs,
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
    freezeOnBlur: true,
  };
}

/** Push transitions for detail screens — target under 200ms. */
export const DETAIL_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  animation: 'slide_from_right',
  animationDuration: MOTION.screenTransitionMs,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
};

/** Modal-style transitions for thread / search flows. */
export const MODAL_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  animation: 'fade_from_bottom',
  animationDuration: MOTION.screenTransitionMs,
  gestureEnabled: true,
};

export const TAB_SCREEN_OPTIONS = {
  lazy: true,
  freezeOnBlur: true,
} as const;
