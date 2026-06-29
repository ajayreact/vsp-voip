import { useReduceMotionEnabled } from '../providers/ReduceMotionProvider';

/** Respects system Reduce Motion via a single app-wide listener. */
export function useReducedMotion(): boolean {
  return useReduceMotionEnabled();
}
