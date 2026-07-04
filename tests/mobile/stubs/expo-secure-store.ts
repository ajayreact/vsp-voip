const secureStore = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return secureStore.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  secureStore.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  secureStore.delete(key);
}

export function __resetSecureStoreForTests(): void {
  secureStore.clear();
}

export const WHEN_UNLOCKED = 'WHEN_UNLOCKED';
export const AFTER_FIRST_UNLOCK = 'AFTER_FIRST_UNLOCK';
