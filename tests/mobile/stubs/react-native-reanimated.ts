export default {
  View: 'Animated.View',
  createAnimatedComponent: (component: unknown) => component,
};

export const useSharedValue = (value: unknown) => ({ value });

export const useAnimatedStyle = (factory: () => Record<string, unknown>) => factory();

export const withTiming = (value: unknown) => value;
