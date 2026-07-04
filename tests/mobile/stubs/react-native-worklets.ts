export const runOnUI = (fn: () => void) => fn;

export const runOnJS = (fn: (...args: unknown[]) => unknown) => fn;
