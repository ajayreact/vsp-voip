/** Shared layout and interaction tokens */
export const tokens = {
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    pill: 999,
  },
  touchTarget: 48,
  iconButton: 52,
  dialKey: 76,
  shadow: {
    card: {
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    hero: {
      shadowColor: '#1976D2',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 4,
    },
    fab: {
      shadowColor: '#1976D2',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
      elevation: 6,
    },
  },
  animation: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
} as const;
