const STORAGE_KEY = 'softphone-v2-caller-id';

export function resolveStoredCallerId(
  numbers: { number: string }[],
  fallback: string,
): string {
  if (typeof window === 'undefined') return fallback;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && numbers.some((entry) => entry.number === stored)) {
      return stored;
    }
  } catch {
    /* ignore storage errors */
  }

  return fallback;
}

export function persistStoredCallerId(number: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, number);
  } catch {
    /* ignore storage errors */
  }
}
