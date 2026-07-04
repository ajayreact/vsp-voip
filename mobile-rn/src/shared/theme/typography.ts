import { Platform, type TextStyle } from 'react-native';
import type { FontSizePreference } from '../../settings/types';

export const FONT_SIZE_MULTIPLIERS: Record<FontSizePreference, number> = {
  default: 1,
  large: 1.125,
  extraLarge: 1.25,
};

export function scaleTextStyle(style: TextStyle, scale: number): TextStyle {
  if (scale === 1 || style.fontSize == null) return style;
  const lineHeight =
    typeof style.lineHeight === 'number' ? Math.round(style.lineHeight * scale) : style.lineHeight;
  return {
    ...style,
    fontSize: Math.round(style.fontSize * scale),
    lineHeight,
  };
}

export const fontFamily = {
  regular: Platform.select({ ios: 'Inter_400Regular', android: 'Inter_400Regular', default: 'System' }),
  medium: Platform.select({ ios: 'Inter_500Medium', android: 'Inter_500Medium', default: 'System' }),
  semibold: Platform.select({ ios: 'Inter_600SemiBold', android: 'Inter_600SemiBold', default: 'System' }),
  bold: Platform.select({ ios: 'Inter_700Bold', android: 'Inter_700Bold', default: 'System' }),
} as const;

export const typography = {
  display: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 38,
    letterSpacing: -0.5,
    fontFamily: fontFamily.bold,
  },
  title: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 30,
    letterSpacing: -0.3,
    fontFamily: fontFamily.semibold,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
    fontFamily: fontFamily.semibold,
  },
  section: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    fontFamily: fontFamily.semibold,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 22,
    fontFamily: fontFamily.regular,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 22,
    fontFamily: fontFamily.medium,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    fontFamily: fontFamily.regular,
  },
  label: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    fontFamily: fontFamily.medium,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 20,
    fontFamily: fontFamily.semibold,
  },
  mono: {
    fontSize: 28,
    fontWeight: '500' as const,
    lineHeight: 34,
    letterSpacing: 2,
    fontFamily: fontFamily.medium,
  },
};
