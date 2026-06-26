/** Shared layout and interaction tokens */
export const tokens = {
  radius: {
    sm: 8,
    md: 12,
    lg: 14,
    xl: 18,
    pill: 999,
  },
  touchTarget: 48,
  iconButton: 52,
  dialKey: 72,
  shadow: {
    card: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    hero: {
      shadowColor: '#4f46e5',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 16,
      elevation: 6,
    },
  },
  animation: {
    fast: 150,
    normal: 250,
  },
} as const;
