/** Shared motion constants — keep transitions under 200ms for snappy navigation. */
export const MOTION = {
  pressScale: 0.98,
  pressInMs: 80,
  pressOutMs: 120,
  screenTransitionMs: 200,
  imageTransitionMs: 150,
  fadeMs: 180,
  skeletonPulseMs: 900,
} as const;
